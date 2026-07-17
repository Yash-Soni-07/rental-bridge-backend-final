/**
 * seed_featured.mjs
 *
 * One-time script to:
 *  1. Delete all dependent rows for existing mocked properties (in safe order)
 *  2. Delete all existing properties
 *  3. Seed top 50 geocoded flat/apartment listings from property_listings
 *     as real properties owned by the landlord (id: 2)
 *  4. Seed property_amenities for each new property
 *  5. Link each property_listings row back via linked_property_id
 *
 * Run: node scripts/seed_featured.mjs
 * Revert: everything is wrapped in a transaction — on failure it auto-rolls back.
 */

import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Common Ahmedabad property amenities ──────────────────────────────────────
const AMENITY_NAMES = [
    "Lift / Elevator",
    "24/7 Security",
    "Covered Parking",
    "Power Backup",
    "Gym / Fitness Centre",
    "Swimming Pool",
    "Children's Play Area",
    "Visitor Parking",
    "CCTV Surveillance",
    "Intercom",
    "Rainwater Harvesting",
    "Gated Society",
    "Garden / Landscaping",
    "Clubhouse",
    "Maintenance Staff",
];

// Assign 5-8 amenities per property deterministically (based on index so it's consistent)
function amenitiesForIndex(propIndex, amenityIds) {
    const count = 5 + (propIndex % 4); // cycles: 5, 6, 7, 8
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(amenityIds[(propIndex + i) % amenityIds.length]);
    }
    return [...new Set(result)];
}

// Build a realistic description from listing data
function buildDescription(row) {
    if (row.description && row.description.trim().length > 20) {
        return row.description.trim();
    }
    const bhk = row.bhk_type ? `${row.bhk_type} BHK ` : "";
    const type = row.property_type.charAt(0).toUpperCase() + row.property_type.slice(1);
    const locality = row.locality || row.city;
    const area = row.area_sqft_super ? ` with ${Math.round(parseFloat(row.area_sqft_super))} sq.ft super built-up area` : "";
    const price = row.price_in_cr ? ` priced at ₹${parseFloat(row.price_in_cr).toFixed(2)} Cr` : "";
    return `${bhk}${type} in ${locality}, Ahmedabad${area}${price}. Well-connected locality with easy access to major roads, schools, and commercial hubs. Available for rent with 11-month lease.`;
}

async function main() {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        console.log("── Step 1: Clearing dependent tables ──");

        const { rowCount: pmDel } = await client.query("DELETE FROM payments");
        console.log(`  payments deleted: ${pmDel}`);

        const { rowCount: mrDel } = await client.query("DELETE FROM maintenance_requests");
        console.log(`  maintenance_requests deleted: ${mrDel}`);

        const { rowCount: appDel } = await client.query("DELETE FROM applications");
        console.log(`  applications deleted: ${appDel}`);

        const { rowCount: bkDel } = await client.query("DELETE FROM bookings");
        console.log(`  bookings deleted: ${bkDel}`);

        // Unlink property_listings before deleting properties (avoids FK issues)
        await client.query("UPDATE property_listings SET linked_property_id = NULL WHERE linked_property_id IS NOT NULL");
        console.log("  property_listings unlinked");

        // property_images, property_amenities, reviews are CASCADE — auto-deleted with properties
        const { rowCount: propDel } = await client.query("DELETE FROM properties");
        console.log(`  properties deleted: ${propDel} (images, amenities, reviews cascaded)`);

        console.log("\n── Step 2: Upserting amenities ──");

        const amenityIds = [];
        for (const name of AMENITY_NAMES) {
            const res = await client.query(
                `INSERT INTO amenities (name) VALUES ($1)
                 ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                 RETURNING id`,
                [name]
            );
            amenityIds.push(res.rows[0].id);
        }
        console.log(`  ${amenityIds.length} amenities ready`);

        console.log("\n── Step 3: Fetching top 50 flat/apartment listings ──");

        const listingsRes = await client.query(`
            SELECT
                id, name, property_title, description, location_raw,
                locality, city, state, property_type, bhk_type,
                area_sqft_raw, area_sqft_super,
                price_in_cr, price_in_inr, est_monthly_rent,
                latitude, longitude
            FROM property_listings
            WHERE is_geocoded = true
              AND property_type IN ('flat', 'apartment')
              AND linked_property_id IS NULL
            ORDER BY RANDOM()
            LIMIT 500
        `);

        const listings = listingsRes.rows;
        console.log(`  Found ${listings.length} listings to seed`);

        if (listings.length === 0) {
            throw new Error("No suitable listings found — aborting.");
        }

        const LANDLORD_ID = 2;
        const availableFrom = new Date();
        availableFrom.setDate(availableFrom.getDate() + 7);

        console.log("\n── Step 4: Inserting properties + amenities ──");

        for (let i = 0; i < listings.length; i++) {
            const l = listings[i];

            const title = ((l.property_title || l.name || "").trim()) ||
                `${l.bhk_type || 2} BHK ${l.property_type} in ${l.locality || l.city}`;

            const description = buildDescription(l);

            const address = (l.location_raw || [l.locality, l.city].filter(Boolean).join(", ")).trim() || l.city;

            const city = l.city || "Ahmedabad";
            const state = l.state || "Gujarat";
            const bedrooms = parseInt(l.bhk_type) || 2;
            const bathrooms = Math.max(1, bedrooms - 1);
            const areaSqft = parseFloat(l.area_sqft_super || l.area_sqft_raw || "1000");

            let monthlyRent;
            if (l.est_monthly_rent && parseFloat(l.est_monthly_rent) > 0) {
                // Add a small randomized variation (-5% to +5%) for realism based on property age/amenities
                const baseRent = parseFloat(l.est_monthly_rent);
                const variation = (Math.random() * 0.1) - 0.05; 
                monthlyRent = Math.round(baseRent * (1 + variation) / 500) * 500; // Round to nearest 500
            } else if (l.price_in_inr && parseFloat(l.price_in_inr) > 0) {
                monthlyRent = Math.round((parseFloat(l.price_in_inr) * 0.03) / 12 / 500) * 500;
            } else {
                monthlyRent = bedrooms * 7000;
            }
            monthlyRent = Math.max(5000, monthlyRent);
            const securityDeposit = monthlyRent * 2;

            const propRes = await client.query(
                `INSERT INTO properties (
                    title, description, property_type, address, city, state, zip_code,
                    latitude, longitude, bedrooms, bathrooms, area_sqft,
                    monthly_rent, security_deposit, owner_id, available_from,
                    lease_duration_months, is_furnished, parking_available
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, '380001',
                    $7, $8, $9, $10, $11,
                    $12, $13, $14, $15,
                    11, false, true
                ) RETURNING id`,
                [
                    title, description, l.property_type, address, city, state,
                    l.latitude, l.longitude, bedrooms, bathrooms, areaSqft,
                    monthlyRent, securityDeposit, LANDLORD_ID, availableFrom,
                ]
            );

            const newPropertyId = propRes.rows[0].id;

            // Link property_listings → properties
            await client.query(
                "UPDATE property_listings SET linked_property_id = $1 WHERE id = $2",
                [newPropertyId, l.id]
            );

            // Assign amenities
            const thisAmenities = amenitiesForIndex(i, amenityIds);
            for (const amenityId of thisAmenities) {
                await client.query(
                    `INSERT INTO property_amenities (property_id, amenity_id)
                     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [newPropertyId, amenityId]
                );
            }

            if ((i + 1) % 10 === 0 || i === listings.length - 1) {
                console.log(`  [${i + 1}/${listings.length}] Inserted property ID ${newPropertyId}: "${title.substring(0, 50)}"`);
            }
        }

        await client.query("COMMIT");
        console.log(`\n✅ Seed complete! ${listings.length} featured properties inserted and linked.`);

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("\n❌ Seed failed — all changes rolled back.\n", err.message || err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
