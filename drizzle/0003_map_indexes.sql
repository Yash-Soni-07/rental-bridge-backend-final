-- Map performance indexes for property_listings
-- Created for Phase 2 — map discovery feature
-- Uses IF NOT EXISTS so this migration is safe to re-run

CREATE INDEX IF NOT EXISTS idx_listings_geo      ON property_listings (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_listings_geo_bhk  ON property_listings (latitude, longitude, bhk_type);
CREATE INDEX IF NOT EXISTS idx_listings_purpose  ON property_listings (listing_purpose);
CREATE INDEX IF NOT EXISTS idx_listings_bhk      ON property_listings (bhk_type);
CREATE INDEX IF NOT EXISTS idx_listings_rent     ON property_listings (est_monthly_rent);
CREATE INDEX IF NOT EXISTS idx_listings_price    ON property_listings (price_in_cr);
CREATE INDEX IF NOT EXISTS idx_listings_locality ON property_listings (locality);
