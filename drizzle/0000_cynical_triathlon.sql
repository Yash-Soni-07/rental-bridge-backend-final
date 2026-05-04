CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('available', 'rented', 'maintenance', 'pending');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('apartment', 'house', 'condo', 'studio', 'townhouse', 'villa');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'landlord', 'tenant');--> statement-breakpoint
CREATE TABLE "amenities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"icon" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "amenities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"applicant_id" integer NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"monthly_income" numeric(12, 2) NOT NULL,
	"employment_status" varchar(100) NOT NULL,
	"previous_address" text,
	"references" text,
	"move_in_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "income_positive" CHECK ("applications"."monthly_income" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"tenant_id" integer NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"monthly_rent" numeric(12, 2) NOT NULL,
	"security_deposit" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"payment_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"lease_document" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_dates_valid" CHECK ("bookings"."end_date" > "bookings"."start_date"),
	CONSTRAINT "rent_positive" CHECK ("bookings"."monthly_rent" >= 0),
	CONSTRAINT "deposit_positive" CHECK ("bookings"."security_deposit" >= 0),
	CONSTRAINT "total_positive" CHECK ("bookings"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "maintenance_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"tenant_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"status" varchar(50) DEFAULT 'open',
	"estimated_cost" numeric(12, 2),
	"actual_cost" numeric(12, 2),
	"assigned_to" varchar(255),
	"completed_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "estimated_cost_positive" CHECK ("maintenance_requests"."estimated_cost" >= 0),
	CONSTRAINT "actual_cost_positive" CHECK ("maintenance_requests"."actual_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_type" varchar(50) NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"transaction_id" varchar(255),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "amount_positive" CHECK ("payments"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"property_type" "property_type" NOT NULL,
	"address" text NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"zip_code" varchar(20) NOT NULL,
	"country" varchar(100) DEFAULT 'India',
	"latitude" real,
	"longitude" real,
	"bedrooms" integer NOT NULL,
	"bathrooms" integer NOT NULL,
	"area_sqft" real NOT NULL,
	"monthly_rent" numeric(12, 2) NOT NULL,
	"security_deposit" numeric(12, 2) NOT NULL,
	"is_furnished" boolean DEFAULT false NOT NULL,
	"pets_allowed" boolean DEFAULT false NOT NULL,
	"smoking_allowed" boolean DEFAULT false NOT NULL,
	"parking_available" boolean DEFAULT false NOT NULL,
	"status" "property_status" DEFAULT 'available' NOT NULL,
	"available_from" timestamp NOT NULL,
	"lease_duration_months" integer DEFAULT 12,
	"owner_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rent_positive" CHECK ("properties"."monthly_rent" >= 0),
	CONSTRAINT "deposit_positive" CHECK ("properties"."security_deposit" >= 0),
	CONSTRAINT "area_positive" CHECK ("properties"."area_sqft" > 0),
	CONSTRAINT "bedrooms_valid" CHECK ("properties"."bedrooms" >= 0),
	CONSTRAINT "bathrooms_valid" CHECK ("properties"."bathrooms" >= 0),
	CONSTRAINT "lease_valid" CHECK ("properties"."lease_duration_months" > 0)
);
--> statement-breakpoint
CREATE TABLE "property_amenities" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"amenity_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"image_url" varchar(512) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"caption" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"reviewer_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"comment" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rating_check" CHECK ("reviews"."rating" >= 1 AND "reviews"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(100) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"phone" varchar(20),
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"profile_image" varchar(255),
	"address" text,
	"date_of_birth" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_property_amenity" ON "property_amenities" USING btree ("property_id","amenity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_primary_image_per_property" ON "property_images" USING btree ("property_id") WHERE "property_images"."is_primary" = true;

CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_no_overlap"
    EXCLUDE USING gist (
      "property_id" WITH =,
      tsrange("start_date", "end_date", '[)') WITH &&
    )
    WHERE ("status" <> 'cancelled');--> statement-breakpoint