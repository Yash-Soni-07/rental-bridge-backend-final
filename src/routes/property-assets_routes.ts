import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { propertyImages, amenities, propertyAmenities } from "../db/schema/app.js";
import { eq } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";

const router = Router();

/**
 * Helper: Validate ID
 */
import { parseId } from "../utils/parseId.js";

// DB Error handler
import { isConstraintViolation } from "../utils/dbErrorHandler.js";

// ─── Property Images ─────────────────────────────

// GET /api/property-images/:propertyId
router.get("/images/:propertyId", async (req: Request, res: Response) => {
    const propertyId = parseId(req.params.propertyId);
    if (!propertyId) {
        return res.status(400).json({ error: "Invalid property ID" });
    }

    try {
        const images = await db
            .select()
            .from(propertyImages)
            .where(eq(propertyImages.property_id, propertyId));

        return res.status(200).json(images);
    } catch (error) {
        console.error(`GET /images/${propertyId} error:`, error);
        return res.status(500).json({ error: "Failed to fetch images" });
    }
});

// POST /api/property-images
router.post("/images", authenticate, async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const newImage = await db
            .insert(propertyImages)
            .values(req.body)
            .returning();

        return res.status(201).json(newImage[0]);
    } catch (error) {
        console.error("POST /images error:", error);
        return res.status(500).json({ error: "Failed to add image" });
    }
});

// DELETE /api/property-images/:id
router.delete("/images/:id", authenticate, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid image ID" });
    }

    try {
        const deleted = await db
            .delete(propertyImages)
            .where(eq(propertyImages.id, id))
            .returning();

        if (!deleted.length) {
            return res.status(404).json({ error: "Image not found" });
        }

        return res.status(200).json({ message: "Image deleted successfully" });
    } catch (error: any) {
        console.error(`DELETE /images/${id} error:`, error);

        if (isConstraintViolation(error)) {
            return res.status(409).json({
                error: "Cannot delete image due to existing dependencies",
            });
        }

        return res.status(500).json({
            error: "Failed to delete image",
        });
    }
});

// ─── Amenities ───────────────────────────────────

// GET /api/amenities
router.get("/amenities", async (_req: Request, res: Response) => {
    try {
        const allAmenities = await db.select().from(amenities);
        return res.status(200).json(allAmenities);
    } catch (error) {
        console.error("GET /amenities error:", error);
        return res.status(500).json({ error: "Failed to fetch amenities" });
    }
});

// POST /api/amenities
router.post("/amenities", authenticate, async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const newAmenity = await db
            .insert(amenities)
            .values(req.body)
            .returning();

        return res.status(201).json(newAmenity[0]);
    } catch (error) {
        console.error("POST /amenities error:", error);
        return res.status(500).json({ error: "Failed to create amenity" });
    }
});

// DELETE /api/amenities/:id
router.delete("/amenities/:id", authenticate, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid amenity ID" });
    }

    try {
        const deleted = await db
            .delete(amenities)
            .where(eq(amenities.id, id))
            .returning();

        if (!deleted.length) {
            return res.status(404).json({ error: "Amenity not found" });
        }

        return res.status(200).json({ message: "Amenity deleted successfully" });
    } catch (error: any) {
        console.error(`DELETE /amenities/${id} error:`, error);

        if (isConstraintViolation(error)) {
            return res.status(409).json({
                error: "Cannot delete amenity due to existing dependencies",
            });
        }

        return res.status(500).json({
            error: "Failed to delete amenities",
        });
    }
});

// ─── Property Amenities ──────────────────────────

// GET /api/property-amenities/:propertyId
router.get("/property-amenities/:propertyId", async (req: Request, res: Response) => {
    const propertyId = parseId(req.params.propertyId);
    if (!propertyId) {
        return res.status(400).json({ error: "Invalid property ID" });
    }

    try {
        const result = await db
            .select()
            .from(propertyAmenities)
            .where(eq(propertyAmenities.property_id, propertyId));

        return res.status(200).json(result);
    } catch (error) {
        console.error(`GET /property-amenities/${propertyId} error:`, error);
        return res.status(500).json({ error: "Failed to fetch property amenities" });
    }
});

// POST /api/property-amenities
router.post("/property-amenities", authenticate, async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const result = await db
            .insert(propertyAmenities)
            .values(req.body)
            .returning();

        return res.status(201).json(result[0]);
    } catch (error) {
        console.error("POST /property-amenities error:", error);
        return res.status(500).json({ error: "Failed to assign amenity" });
    }
});

// DELETE /api/property-amenities/:id
router.delete("/property-amenities/:id", authenticate, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid property amenity ID" });
    }

    try {
        const deleted = await db
            .delete(propertyAmenities)
            .where(eq(propertyAmenities.id, id))
            .returning();

        if (!deleted.length) {
            return res.status(404).json({ error: "Property amenity not found" });
        }

        return res.status(200).json({
            message: "Amenity removed from property",
        });
    } catch (error: any) {
        console.error(`DELETE /property-amenities/${id} error:`, error);

        if (isConstraintViolation(error)) {
            return res.status(409).json({
                error: "Cannot delete property-amenity due to existing dependencies",
            });
        }

        return res.status(500).json({
            error: "Failed to delete property-amenity",
        });
    }
});

export default router;