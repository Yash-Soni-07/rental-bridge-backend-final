CREATE TYPE "public"."area_type" AS ENUM('carpet', 'built_up', 'super');--> statement-breakpoint
CREATE TYPE "public"."listing_purpose" AS ENUM('rent', 'sale', 'both');--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'flat';--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'plot';--> statement-breakpoint
CREATE TABLE "property_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" varchar(100),
	"source" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"property_title" varchar(255),
	"description" text,
	"location_raw" text,
	"locality" varchar(150),
	"city" varchar(100) DEFAULT 'Ahmedabad' NOT NULL,
	"state" varchar(100) DEFAULT 'Gujarat' NOT NULL,
	"country" varchar(100) DEFAULT 'India' NOT NULL,
	"property_type" "property_type" NOT NULL,
	"listing_purpose" "listing_purpose" DEFAULT 'both' NOT NULL,
	"bhk_type" integer,
	"area_sqft_raw" real,
	"area_type" "area_type",
	"area_sqft_super" real,
	"price_in_cr" numeric(10, 4),
	"price_in_inr" numeric(16, 2),
	"rate_per_sqft" numeric(10, 2),
	"rate_per_sqft_super" numeric(10, 2),
	"est_monthly_rent" numeric(12, 2),
	"est_monthly_rent_min" numeric(12, 2),
	"est_monthly_rent_max" numeric(12, 2),
	"rent_per_sqft" numeric(10, 2),
	"latitude" real,
	"longitude" real,
	"is_geocoded" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"added_by" integer,
	"linked_property_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "property_listings_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "bhk_type_valid" CHECK ("property_listings"."bhk_type" BETWEEN 1 AND 6),
	CONSTRAINT "area_raw_positive" CHECK ("property_listings"."area_sqft_raw" > 0),
	CONSTRAINT "area_super_positive" CHECK ("property_listings"."area_sqft_super" > 0),
	CONSTRAINT "price_inr_positive" CHECK ("property_listings"."price_in_inr" >= 0),
	CONSTRAINT "rent_positive" CHECK ("property_listings"."est_monthly_rent" >= 0)
);
--> statement-breakpoint
ALTER TABLE "property_listings" ADD CONSTRAINT "property_listings_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_listings" ADD CONSTRAINT "property_listings_linked_property_id_properties_id_fk" FOREIGN KEY ("linked_property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;