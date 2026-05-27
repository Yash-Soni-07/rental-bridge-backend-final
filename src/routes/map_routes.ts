import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { propertyListings } from "../db/schema/app.js";
import { and, between, gte, lte, ilike, inArray, eq, sql } from "drizzle-orm";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseFloat_(v: unknown): number | null {
    const n = parseFloat(String(v));
    return isFinite(n) ? n : null;
}

function parseIntParam(v: unknown): number | null {
    const n = parseInt(String(v), 10);
    return isFinite(n) ? n : null;
}

function parseList(v: unknown): string[] {
    if (typeof v !== "string" || !v.trim()) return [];
    return v.split(",").map((s) => s.trim()).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/map/pins
// Public. Returns minimal pin data for all matching listings.
//
// Query params (all optional):
//   lat_min, lat_max, lng_min, lng_max  — viewport bounding box
//   bhk        — comma-sep BHK values e.g. "2,3"
//   purpose    — comma-sep listing_purpose values e.g. "rent,both"
//   rent_min, rent_max  — monthly rent range in INR
//   price_min, price_max — sale price range in Cr
//   locality   — case-insensitive partial match
//   limit      — max results (default 2000, max 5000)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/pins", async (req: Request, res: Response) => {
    try {
        const {
            lat_min, lat_max, lng_min, lng_max,
            bhk, purpose,
            rent_min, rent_max,
            price_min, price_max,
            locality,
            limit: limitParam,
        } = req.query;

        // Build WHERE conditions
        const conditions = [
            eq(propertyListings.is_geocoded, true),
        ];

        // Bounding box
        const latMin = parseFloat_(lat_min);
        const latMax = parseFloat_(lat_max);
        const lngMin = parseFloat_(lng_min);
        const lngMax = parseFloat_(lng_max);
        if (latMin !== null && latMax !== null) {
            conditions.push(between(propertyListings.latitude!, latMin, latMax));
        }
        if (lngMin !== null && lngMax !== null) {
            conditions.push(between(propertyListings.longitude!, lngMin, lngMax));
        }

        // BHK filter
        const bhkList = parseList(bhk).map(Number).filter((n) => n > 0);
        if (bhkList.length > 0) {
            conditions.push(inArray(propertyListings.bhk_type, bhkList));
        }

        // Listing purpose filter
        const purposeList = parseList(purpose) as Array<"rent" | "sale" | "both">;
        const validPurposes = purposeList.filter((p) =>
            ["rent", "sale", "both"].includes(p)
        );
        if (validPurposes.length > 0) {
            conditions.push(inArray(propertyListings.listing_purpose, validPurposes));
        }

        // Rent range
        const rentMin = parseFloat_(rent_min);
        const rentMax = parseFloat_(rent_max);
        if (rentMin !== null) {
            conditions.push(gte(propertyListings.est_monthly_rent, String(rentMin)));
        }
        if (rentMax !== null) {
            conditions.push(lte(propertyListings.est_monthly_rent, String(rentMax)));
        }

        // Price range (in Cr)
        const priceMin = parseFloat_(price_min);
        const priceMax = parseFloat_(price_max);
        if (priceMin !== null) {
            conditions.push(gte(propertyListings.price_in_cr, String(priceMin)));
        }
        if (priceMax !== null) {
            conditions.push(lte(propertyListings.price_in_cr, String(priceMax)));
        }

        // Locality search
        if (typeof locality === "string" && locality.trim()) {
            conditions.push(ilike(propertyListings.locality, `%${locality.trim()}%`));
        }

        // Ward filter — exact match on canonical ward name (set by backfill_wards.py)
        const { ward } = req.query;
        if (typeof ward === "string" && ward.trim()) {
            conditions.push(eq(propertyListings.ward, ward.trim().toUpperCase()));
        }

        // Viewport-based loading: the bounding box filters already limit results
        // naturally by zoom level. Cap at 3000 as a safety net for very wide viewports.
        const limit = Math.min(parseIntParam(limitParam) ?? 3000, 3000);

        const pins = await db
            .select({
                id:               propertyListings.id,
                latitude:         propertyListings.latitude,
                longitude:        propertyListings.longitude,
                name:             propertyListings.name,
                bhk_type:         propertyListings.bhk_type,
                property_type:    propertyListings.property_type,
                listing_purpose:  propertyListings.listing_purpose,
                est_monthly_rent: propertyListings.est_monthly_rent,
                price_in_cr:      propertyListings.price_in_cr,
                locality:         propertyListings.locality,
                ward:             propertyListings.ward,
            })
            .from(propertyListings)
            .where(and(...conditions))
            .limit(limit);

        return res.status(200).json(pins);
    } catch (error) {
        console.error("GET /api/map/pins error:", error);
        return res.status(500).json({ error: "Failed to fetch map pins" });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/map/listing/:id
// Public. Returns full detail for a single property_listings row.
// Loaded lazily only when a pin is clicked — keeps the pins payload minimal.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/listing/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) {
        return res.status(400).json({ error: "Invalid listing ID" });
    }

    try {
        const rows = await db
            .select()
            .from(propertyListings)
            .where(eq(propertyListings.id, id));

        if (rows.length === 0) {
            return res.status(404).json({ error: "Listing not found" });
        }

        return res.status(200).json(rows[0]);
    } catch (error) {
        console.error(`GET /api/map/listing/${id} error:`, error);
        return res.status(500).json({ error: "Failed to fetch listing" });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/map/ward-summary
// Public. Returns one row per AMC ward with count + centroid.
// Only wards that have at least one geocoded listing are returned.
// Frontend combines with the 48-ward ZONES config to show all wards.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/ward-summary", async (_req: Request, res: Response) => {
    try {
        const result = await db.execute(sql`
            SELECT
                ward,
                COUNT(*)::int        AS count,
                AVG(latitude)::float AS centroid_lat,
                AVG(longitude)::float AS centroid_lng
            FROM property_listings
            WHERE is_geocoded = true
              AND ward IS NOT NULL
            GROUP BY ward
            ORDER BY count DESC
        `);
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error("GET /api/map/ward-summary error:", error);
        return res.status(500).json({ error: "Failed to fetch ward summary" });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/map/locality-summary
// Public. Returns one row per locality with count + centroid.
// Used by the frontend to show area-based cluster markers at low zoom.
// Result: ~150-200 rows, very fast (uses idx_listings_locality).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/locality-summary", async (_req: Request, res: Response) => {
    try {
        const result = await db.execute(sql`
            SELECT
                locality,
                COUNT(*)::int        AS count,
                AVG(latitude)::float AS centroid_lat,
                AVG(longitude)::float AS centroid_lng
            FROM property_listings
            WHERE is_geocoded = true
              AND locality IS NOT NULL
            GROUP BY locality
            ORDER BY count DESC
        `);
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error("GET /api/map/locality-summary error:", error);
        return res.status(500).json({ error: "Failed to fetch locality summary" });
    }
});

export default router;

