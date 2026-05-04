import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { reviews } from "../db/schema/app.js";
import { eq } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";
import { verifyOwnership } from "../middlewares/verifyOwnership.js";

const router = Router();

/**
 * Helper: Validate ID
 */
import { parseId } from "../utils/parseId.js";

// DB Error handler
import { isConstraintViolation } from "../utils/dbErrorHandler.js";

// GET /api/reviews — Admin: get all reviews
router.get("/", async (_req: Request, res: Response) => {
    try {
        const all = await db.select().from(reviews);
        return res.status(200).json(all);
    } catch (error) {
        console.error("GET /reviews error:", error);
        return res.status(500).json({ error: "Failed to fetch reviews" });
    }
});

// GET /api/reviews/property/:propertyId — Reviews for property
router.get("/property/:propertyId", async (req: Request, res: Response) => {
    const propertyId = parseId(req.params.propertyId);
    if (!propertyId) {
        return res.status(400).json({ error: "Invalid property ID" });
    }

    try {
        const propertyReviews = await db
            .select()
            .from(reviews)
            .where(eq(reviews.property_id, propertyId));

        return res.status(200).json(propertyReviews);
    } catch (error) {
        console.error(`GET /reviews/property/${propertyId} error:`, error);
        return res.status(500).json({ error: "Failed to fetch property reviews" });
    }
});

// GET /api/reviews/reviewer/:reviewerId — Reviews by user
router.get("/reviewer/:reviewerId", authenticate, verifyOwnership("reviewerId"), async (req: Request, res: Response) => {
    const reviewerId = parseId(req.params.reviewerId);
    if (!reviewerId) {
        return res.status(400).json({ error: "Invalid reviewer ID" });
    }

    try {
        const userReviews = await db
            .select()
            .from(reviews)
            .where(eq(reviews.reviewer_id, reviewerId));

        return res.status(200).json(userReviews);
    } catch (error) {
        console.error(`GET /reviews/reviewer/${reviewerId} error:`, error);
        return res.status(500).json({ error: "Failed to fetch user reviews" });
    }
});

// POST /api/reviews — Submit review
router.post("/", async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const newReview = await db
            .insert(reviews)
            .values(req.body)
            .returning();

        return res.status(201).json(newReview[0]);
    } catch (error) {
        console.error("POST /reviews error:", error);
        return res.status(500).json({ error: "Failed to submit review" });
    }
});

// PUT /api/reviews/:id — Update review
router.put("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid review ID" });
    }

    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const updated = await db
            .update(reviews)
            .set(req.body)
            .where(eq(reviews.id, id))
            .returning();

        if (!updated.length) {
            return res.status(404).json({ error: "Review not found" });
        }

        return res.status(200).json(updated[0]);
    } catch (error) {
        console.error(`PUT /reviews/${id} error:`, error);
        return res.status(500).json({ error: "Failed to update review" });
    }
});

// DELETE /api/reviews/:id — Delete review
router.delete("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid review ID" });
    }

    try {
        const deleted = await db
            .delete(reviews)
            .where(eq(reviews.id, id))
            .returning();

        if (!deleted.length) {
            return res.status(404).json({ error: "Review not found" });
        }

        return res.status(200).json({
            message: "Review deleted successfully",
        });
    } catch (error: any) {
        console.error(`DELETE /reviews/${id} error:`, error);

        if (isConstraintViolation(error)) {
            return res.status(409).json({
                error: "Cannot delete review due to existing dependencies",
            });
        }

        return res.status(500).json({
            error: "Failed to delete review",
        });
    }
});

export default router;