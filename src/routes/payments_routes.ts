import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { payments } from "../db/schema/app.js";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * Helper: Validate ID
 */
import { parseId } from "../utils/parseId.js";

// GET /api/payments/booking/:bookingId — Payments for a booking
router.get("/booking/:bookingId", async (req: Request, res: Response) => {
    const bookingId = parseId(req.params.bookingId);
    if (!bookingId) {
        return res.status(400).json({ error: "Invalid booking ID" });
    }

    try {
        const bookingPayments = await db
            .select()
            .from(payments)
            .where(eq(payments.booking_id, bookingId));

        return res.status(200).json(bookingPayments);
    } catch (error) {
        console.error(`GET /payments/booking/${bookingId} error:`, error);
        return res.status(500).json({ error: "Failed to fetch booking payments" });
    }
});

// GET /api/payments — Admin: get all payments
router.get("/", async (_req: Request, res: Response) => {
    try {
        const all = await db.select().from(payments);
        return res.status(200).json(all);
    } catch (error) {
        console.error("GET /payments error:", error);
        return res.status(500).json({ error: "Failed to fetch payments" });
    }
});

// GET /api/payments/:id — Get single payment
router.get("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid payment ID" });
    }

    try {
        const payment = await db
            .select()
            .from(payments)
            .where(eq(payments.id, id));

        if (!payment.length) {
            return res.status(404).json({ error: "Payment not found" });
        }

        return res.status(200).json(payment[0]);
    } catch (error) {
        console.error(`GET /payments/${id} error:`, error);
        return res.status(500).json({ error: "Failed to fetch payment" });
    }
});

// POST /api/payments — Create payment
router.post("/", async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        // Validate and parse due_date
        if (!req.body.due_date) {
            return res.status(400).json({ error: "due_date is required" });
        }

        const due_date = new Date(req.body.due_date);
        if (isNaN(due_date.getTime())) {
            return res.status(400).json({ error: "Invalid due_date" });
        }

        // Validate and parse paid_date if provided
        let paid_date = null;
        if (req.body.paid_date) {
            paid_date = new Date(req.body.paid_date);
            if (isNaN(paid_date.getTime())) {
                return res.status(400).json({ error: "Invalid paid_date" });
            }
        }

        const newPayment = await db
            .insert(payments)
            .values({
                ...req.body,
                due_date: due_date,
                paid_date: paid_date,
            })
            .returning();

        return res.status(201).json(newPayment[0]);
    } catch (error) {
        console.error("POST /payments error:", error);
        return res.status(500).json({ error: "Failed to create payment" });
    }
});

// PUT /api/payments/:id — Update payment
router.put("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid payment ID" });
    }

    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const updated = await db
            .update(payments)
            .set(req.body)
            .where(eq(payments.id, id))
            .returning();

        if (!updated.length) {
            return res.status(404).json({ error: "Payment not found" });
        }

        return res.status(200).json(updated[0]);
    } catch (error) {
        console.error(`PUT /payments/${id} error:`, error);
        return res.status(500).json({ error: "Failed to update payment" });
    }
});

export default router;