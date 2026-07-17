import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { properties, propertyListings } from "../db/schema/app.js";
import { eq, sql, and, or, gte, lte, inArray, ilike, desc, asc } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";
import { verifyOwnership } from "../middlewares/verifyOwnership.js";
import google from "googlethis";

const photoCache = new Map<number, string[]>();

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
// GET /api/properties/featured
// Public. Returns all featured properties joined with their
// linked property_listings id so the frontend can open ListingDetailView.
// Supports pagination (page, limit)
// ─────────────────────────────────────────────
router.get("/featured", async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const bhk = req.query.bhk as string;
        const rent_min = req.query.rent_min as string;
        const rent_max = req.query.rent_max as string;
        const price_min = req.query.price_min as string;
        const price_max = req.query.price_max as string;
        const locality = req.query.locality as string;
        const purpose = req.query.purpose as string;
        const sort_by = req.query.sort_by as string;
        const sort_order = req.query.sort_order as string;

        const conditions = [];

        // BHK filter
        if (bhk) {
            const bhkList = bhk.split(",").map(Number).filter(n => !isNaN(n));
            if (bhkList.length > 0) {
                if (bhkList.includes(5)) {
                    conditions.push(or(inArray(properties.bedrooms, bhkList), gte(properties.bedrooms, 5)));
                } else {
                    conditions.push(inArray(properties.bedrooms, bhkList));
                }
            }
        }

        // Rent filter
        if (rent_min) {
            conditions.push(sql`${properties.monthly_rent} >= ${parseFloat(rent_min)}`);
        }
        if (rent_max) {
            conditions.push(sql`${properties.monthly_rent} <= ${parseFloat(rent_max)}`);
        }

        // Sale price filter
        if (price_min) {
            conditions.push(sql`${propertyListings.price_in_cr} >= ${price_min}`);
        }
        if (price_max) {
            conditions.push(sql`${propertyListings.price_in_cr} <= ${price_max}`);
        }

        // Locality filter
        if (locality && locality.trim()) {
            conditions.push(or(
                ilike(properties.address, `%${locality.trim()}%`),
                ilike(propertyListings.locality, `%${locality.trim()}%`)
            ));
        }

        // Purpose filter
        if (purpose) {
            const purposeList = purpose.split(",").map(p => p.trim()).filter(Boolean) as Array<"rent" | "sale" | "both">;
            if (purposeList.length > 0) {
                conditions.push(inArray(propertyListings.listing_purpose, purposeList));
            }
        }

        // Order mapping
        let orderByClause = [asc(properties.id)];
        if (sort_by) {
            const isDesc = sort_order?.toLowerCase() === "desc";
            if (sort_by === "rent") {
                orderByClause = [isDesc ? desc(properties.monthly_rent) : asc(properties.monthly_rent)];
            } else if (sort_by === "price") {
                orderByClause = [isDesc ? desc(propertyListings.price_in_cr) : asc(propertyListings.price_in_cr)];
            } else if (sort_by === "area") {
                orderByClause = [isDesc ? desc(properties.area_sqft) : asc(properties.area_sqft)];
            } else if (sort_by === "bhk") {
                orderByClause = [isDesc ? desc(properties.bedrooms) : asc(properties.bedrooms)];
            }
        }

        const [rows, totalRes] = await Promise.all([
            db
                .select({
                    id: properties.id,
                    title: properties.title,
                    description: properties.description,
                    property_type: properties.property_type,
                    address: properties.address,
                    city: properties.city,
                    state: properties.state,
                    zip_code: properties.zip_code,
                    latitude: properties.latitude,
                    longitude: properties.longitude,
                    bedrooms: properties.bedrooms,
                    bathrooms: properties.bathrooms,
                    area_sqft: properties.area_sqft,
                    monthly_rent: properties.monthly_rent,
                    security_deposit: properties.security_deposit,
                    is_furnished: properties.is_furnished,
                    parking_available: properties.parking_available,
                    status: properties.status,
                    available_from: properties.available_from,
                    listing_id: propertyListings.id,
                })
                .from(properties)
                .leftJoin(propertyListings, eq(propertyListings.linked_property_id, properties.id))
                .where(and(...conditions))
                .orderBy(...orderByClause)
                .limit(limit)
                .offset(offset),

            db
                .select({ count: sql<number>`count(*)` })
                .from(properties)
                .leftJoin(propertyListings, eq(propertyListings.linked_property_id, properties.id))
                .where(and(...conditions))
        ]);

        const total = totalRes[0]?.count ?? 0;

        return res.status(200).json({ data: rows, total });
    } catch (error) {
        console.error("GET /properties/featured error:", error);
        return res.status(500).json({ error: "Failed to fetch featured properties" });
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
// GET /api/properties/:id/photos — Fetch photos by property name via Google Images
// Only fetches for flat/apartment types.
// Frontend sends name, city, propertyType as query params to avoid an extra DB round-trip.
// ─────────────────────────────────────────────
router.get("/:id/photos", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid property ID" });
    }

    // Only flat/apartment should have photos fetched
    const propertyType = (req.query.propertyType as string || "").toLowerCase();
    if (propertyType !== "flat" && propertyType !== "apartment") {
        return res.status(200).json([]);
    }

    if (photoCache.has(id)) {
        return res.status(200).json(photoCache.get(id));
    }

    try {
        // Use name and city from query params if provided (fast path — no DB lookup needed)
        // Fall back to DB lookup if not provided
        let name = (req.query.name as string || "").trim();
        let city = (req.query.city as string || "").trim();

        if (!name) {
            const property = await db
                .select()
                .from(properties)
                .where(eq(properties.id, id));

            if (!property.length) {
                return res.status(404).json({ error: "Property not found" });
            }

            name = property[0].title || "";
            city = property[0].city || "";
        }

        const searchQuery = `${name} ${city} apartment`.trim();
        if (!name) {
            return res.status(200).json([]);
        }

        console.log(`[photos] Searching Google Images for: "${searchQuery}"`);
        const imagesResult = await google.image(searchQuery, { safe: false });

        // Filter to only URLs that are valid images (not SVGs or data URIs)
        const imageUrls = imagesResult
            .map(img => img.url)
            .filter(url => url && url.startsWith("http") && !url.endsWith(".svg"));

        const finalImages = imageUrls.slice(0, 4);

        // Cache so re-visiting the same property is instant
        photoCache.set(id, finalImages);
        return res.status(200).json(finalImages);

    } catch (error) {
        console.error(`GET /properties/${id}/photos error:`, error);
        return res.status(500).json({ error: "Failed to fetch property photos" });
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