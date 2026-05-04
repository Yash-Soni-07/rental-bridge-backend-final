import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { properties } from "../db/schema/app.js";
import { eq } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";
import { verifyOwnership } from "../middlewares/verifyOwnership.js";

const router = Router();

/**
 * Helper: Validate ID
 */
import { parseId } from "../utils/parseId.js";

// DB Error Handler
import {isConstraintViolation } from "../utils/dbErrorHandler.js";

// ─────────────────────────────────────────────
// GET /api/properties — List all properties
// ─────────────────────────────────────────────
router.get("/", async (_req: Request, res: Response) => {
    try {
        const allProperties = await db.select().from(properties);
        return res.status(200).json(allProperties);
    } catch (error) {
        console.error("GET /properties error:", error);
        return res.status(500).json({ error: "Failed to fetch properties" });
    }
});

// ─────────────────────────────────────────────
// GET /api/properties/owner/:ownerId — Owner properties
// ─────────────────────────────────────────────
router.get("/owner/:ownerId", authenticate, verifyOwnership("ownerId"), async (req: Request, res: Response) => {
    const ownerId = parseId(req.params.ownerId);
    if (!ownerId) {
        return res.status(400).json({ error: "Invalid owner ID" });
    }

    try {
        const ownerProperties = await db
            .select()
            .from(properties)
            .where(eq(properties.owner_id, ownerId));

        return res.status(200).json(ownerProperties);
    } catch (error) {
        console.error(`GET /properties/owner/${ownerId} error:`, error);
        return res.status(500).json({ error: "Failed to fetch owner properties" });
    }
});

// ─────────────────────────────────────────────
// GET /api/properties/:id — Get property by ID
// ─────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid property ID" });
    }

    try {
        const property = await db
            .select()
            .from(properties)
            .where(eq(properties.id, id));

        if (!property.length) {
            return res.status(404).json({ error: "Property not found" });
        }

        return res.status(200).json(property[0]);
    } catch (error) {
        console.error(`GET /properties/${id} error:`, error);
        return res.status(500).json({ error: "Failed to fetch property" });
    }
});

// ─────────────────────────────────────────────
// POST /api/properties — Create property
// ─────────────────────────────────────────────
router.post("/", authenticate, async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const availableFrom = new Date(req.body.available_from);
        if (isNaN(availableFrom.getTime())) {
            return res.status(400).json({ error: "Invalid available_from date" });
        }

        const newProperty = await db
            .insert(properties)
            .values({
                title: req.body.title,
                description: req.body.description,
                property_type: req.body.property_type,
                address: req.body.address,
                city: req.body.city,
                state: req.body.state,
                zip_code: req.body.zip_code,
                country: req.body.country,
                latitude: req.body.latitude,
                longitude: req.body.longitude,
                bedrooms: req.body.bedrooms,
                bathrooms: req.body.bathrooms,
                area_sqft: req.body.area_sqft,
                monthly_rent: req.body.monthly_rent,
                security_deposit: req.body.security_deposit,
                is_furnished: req.body.is_furnished,
                pets_allowed: req.body.pets_allowed,
                smoking_allowed: req.body.smoking_allowed,
                parking_available: req.body.parking_available,
                lease_duration_months: req.body.lease_duration_months,
                available_from: availableFrom,
                owner_id: (req as any).user.id, // derived from auth, never from client
            })
            .returning();

        return res.status(201).json(newProperty[0]);
    } catch (error) {
        console.error("POST /properties error:", error);
        return res.status(500).json({ error: "Failed to create property" });
    }
});

// ─────────────────────────────────────────────
// PUT /api/properties/:id — Update property
// ─────────────────────────────────────────────
router.put("/:id", authenticate, verifyOwnership("id"), async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid property ID" });
    }

    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const allowedUpdate: Record<string, any> = {};

        if (req.body.title !== undefined) allowedUpdate.title = req.body.title;
        if (req.body.description !== undefined) allowedUpdate.description = req.body.description;
        if (req.body.property_type !== undefined) allowedUpdate.property_type = req.body.property_type;
        if (req.body.address !== undefined) allowedUpdate.address = req.body.address;
        if (req.body.city !== undefined) allowedUpdate.city = req.body.city;
        if (req.body.state !== undefined) allowedUpdate.state = req.body.state;
        if (req.body.zip_code !== undefined) allowedUpdate.zip_code = req.body.zip_code;
        if (req.body.country !== undefined) allowedUpdate.country = req.body.country;
        if (req.body.latitude !== undefined) allowedUpdate.latitude = req.body.latitude;
        if (req.body.longitude !== undefined) allowedUpdate.longitude = req.body.longitude;
        if (req.body.bedrooms !== undefined) allowedUpdate.bedrooms = req.body.bedrooms;
        if (req.body.bathrooms !== undefined) allowedUpdate.bathrooms = req.body.bathrooms;
        if (req.body.area_sqft !== undefined) allowedUpdate.area_sqft = req.body.area_sqft;
        if (req.body.monthly_rent !== undefined) allowedUpdate.monthly_rent = req.body.monthly_rent;
        if (req.body.security_deposit !== undefined) allowedUpdate.security_deposit = req.body.security_deposit;
        if (req.body.is_furnished !== undefined) allowedUpdate.is_furnished = req.body.is_furnished;
        if (req.body.pets_allowed !== undefined) allowedUpdate.pets_allowed = req.body.pets_allowed;
        if (req.body.smoking_allowed !== undefined) allowedUpdate.smoking_allowed = req.body.smoking_allowed;
        if (req.body.parking_available !== undefined) allowedUpdate.parking_available = req.body.parking_available;
        if (req.body.lease_duration_months !== undefined) allowedUpdate.lease_duration_months = req.body.lease_duration_months;
        if (req.body.available_from !== undefined) {
            const availableFrom = new Date(req.body.available_from);
            if (isNaN(availableFrom.getTime())) {
                return res.status(400).json({ error: "Invalid available_from date" });
            }
            allowedUpdate.available_from = availableFrom;
        }

        // owner_id, status, created_at are never accepted from client
        allowedUpdate.updated_at = new Date();

        const updated = await db
            .update(properties)
            .set(allowedUpdate)
            .where(eq(properties.id, id))
            .returning();

        if (!updated.length) {
            return res.status(404).json({ error: "Property not found" });
        }

        return res.status(200).json(updated[0]);
    } catch (error) {
        console.error(`PUT /properties/${id} error:`, error);
        return res.status(500).json({ error: "Failed to update property" });
    }
});

// ─────────────────────────────────────────────
// DELETE /api/properties/:id — Delete property
// ─────────────────────────────────────────────
router.delete("/:id", authenticate, verifyOwnership("id"), async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid property ID" });
    }

    try {
        const deleted = await db
            .delete(properties)
            .where(eq(properties.id, id))
            .returning();

        if (!deleted.length) {
            return res.status(404).json({ error: "Property not found" });
        }

        return res.status(200).json({
            message: "Property deleted successfully",
        });
    } catch (error: any) {
        console.error(`DELETE /properties/${id} error:`, error);

        if (isConstraintViolation(error)) {
            return res.status(409).json({
                error: "Cannot delete property due to existing dependencies",
            });
        }

        return res.status(500).json({
            error: "Failed to delete property",
        });
    }
});

export default router;