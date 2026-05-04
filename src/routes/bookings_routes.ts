import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { bookings } from "../db/schema/app.js";
import { and, eq, lt, gt, ne } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";
import { verifyOwnership } from "../middlewares/verifyOwnership.js";

const router = Router();

/**
 * Helper: Validate ID
 */
import { parseId } from "../utils/parseId.js";

// DB Error Handler
import  { isConstraintViolation } from "../utils/dbErrorHandler.js";

// GET /api/bookings — Admin: get all bookings
router.get("/", async (_req: Request, res: Response) => {
    try {
        const all = await db.select().from(bookings);
        return res.status(200).json(all);
    } catch (error) {
        console.error("GET /bookings error:", error);
        return res.status(500).json({ error: "Failed to fetch bookings" });
    }
});

// GET /api/bookings/tenant/:tenantId — Tenant: my bookings
router.get("/tenant/:tenantId", authenticate, verifyOwnership("tenantId"), async (req: Request, res: Response) => {
    const tenantId = parseId(req.params.tenantId);
    if (!tenantId) {
        return res.status(400).json({ error: "Invalid tenant ID" });
    }

    try {
        const tenantBookings = await db
            .select()
            .from(bookings)
            .where(eq(bookings.tenant_id, tenantId));

        return res.status(200).json(tenantBookings);
    } catch (error) {
        console.error(`GET /bookings/tenant/${tenantId} error:`, error);
        return res.status(500).json({ error: "Failed to fetch tenant bookings" });
    }
});

// GET /api/bookings/property/:propertyId — Owner: bookings for property
router.get("/property/:propertyId", async (req: Request, res: Response) => {
    const propertyId = parseId(req.params.propertyId);
    if (!propertyId) {
        return res.status(400).json({ error: "Invalid property ID" });
    }

    try {
        const propertyBookings = await db
            .select()
            .from(bookings)
            .where(eq(bookings.property_id, propertyId));

        return res.status(200).json(propertyBookings);
    } catch (error) {
        console.error(`GET /bookings/property/${propertyId} error:`, error);
        return res.status(500).json({ error: "Failed to fetch property bookings" });
    }
});

// GET /api/bookings/:id — Get single booking
router.get("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid booking ID" });
    }

    try {
        const booking = await db
            .select()
            .from(bookings)
            .where(eq(bookings.id, id));

        if (!booking.length) {
            return res.status(404).json({ error: "Booking not found" });
        }

        return res.status(200).json(booking[0]);
    } catch (error) {
        console.error(`GET /bookings/${id} error:`, error);
        return res.status(500).json({ error: "Failed to fetch booking" });
    }
});

// POST /api/bookings — Create booking
router.post("/", async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        if (!req.body.start_date) {
            return res.status(400).json({ error: "start_date is required" });
        }
        if (!req.body.end_date) {
            return res.status(400).json({ error: "end_date is required" });
        }

        const start_date = new Date(req.body.start_date);
        const end_date = new Date(req.body.end_date);

        if (isNaN(start_date.getTime())) {
            return res.status(400).json({ error: "start_date is invalid" });
        }
        if (isNaN(end_date.getTime())) {
            return res.status(400).json({ error: "end_date is invalid" });
        }

        const property_id = parseId(req.body.property_id);
        if (!property_id) {
            return res.status(400).json({ error: "Invalid property ID" });
        }

        // 🔒 Transactional overlap guard — serializable isolation prevents
        //    concurrent inserts from racing past this check simultaneously.
        const newBooking = await db.transaction(async (tx) => {
            // Allen interval overlap: existing.start_date < req.end_date AND existing.end_date > req.start_date
            // Exclude cancelled bookings from overlap check to match DB EXCLUDE constraint
            const overlapping = await tx
                .select({ id: bookings.id })
                .from(bookings)
                .where(
                    and(
                        eq(bookings.property_id, property_id),
                        ne(bookings.status, 'cancelled'),
                        lt(bookings.start_date, end_date),
                        gt(bookings.end_date, start_date),
                    )
                )
                .for("update");

            if (overlapping.length > 0) {
                throw Object.assign(new Error("Booking dates overlap with an existing booking"), { code: "OVERLAP" });
            }

            const [created] = await tx
                .insert(bookings)
                .values({
                    property_id,
                    tenant_id: req.body.tenant_id,
                    start_date,
                    end_date,
                    monthly_rent: req.body.monthly_rent,
                    security_deposit: req.body.security_deposit,
                    total_amount: req.body.total_amount,
                    ...(req.body.payment_status !== undefined && { payment_status: req.body.payment_status }),
                    ...(req.body.lease_document !== undefined && { lease_document: req.body.lease_document }),
                })
                .returning();

            return created;
        }, { isolationLevel: "serializable" });

        return res.status(201).json(newBooking);
    } catch (error: any) {
        if (error?.code === "OVERLAP") {
            return res.status(409).json({ error: "Booking dates overlap with an existing booking for this property" });
        }
        console.error("POST /bookings error:", error);
        return res.status(500).json({ error: "Failed to create booking" });
    }
});

// PUT /api/bookings/:id — Update booking
router.put("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid booking ID" });
    }

    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const updated = await db
            .update(bookings)
            .set({ ...req.body, updated_at: new Date() })
            .where(eq(bookings.id, id))
            .returning();

        if (!updated.length) {
            return res.status(404).json({ error: "Booking not found" });
        }

        return res.status(200).json(updated[0]);
    } catch (error) {
        console.error(`PUT /bookings/${id} error:`, error);
        return res.status(500).json({ error: "Failed to update booking" });
    }
});

// DELETE /api/bookings/:id — Delete booking
router.delete("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid booking ID" });
    }

    try {
        const deleted = await db
            .delete(bookings)
            .where(eq(bookings.id, id))
            .returning();

        if (!deleted.length) {
            return res.status(404).json({ error: "Booking not found" });
        }

        return res.status(200).json({
            message: "Booking deleted successfully",
        });
    } catch (error: any) {
        console.error(`DELETE /bookings/${id} error:`, error);

        if (isConstraintViolation(error)) {
            return res.status(409).json({
                error: "Cannot delete booking due to existing dependencies",
            });
        }

        return res.status(500).json({
            error: "Failed to delete booking",
        });
    }
});

export default router;