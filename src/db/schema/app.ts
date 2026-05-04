import {
    pgTable,
    serial,
    varchar,
    text,
    boolean,
    integer,
    real,
    timestamp,
    pgEnum,
    uniqueIndex,
    check,
    date,
    numeric,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ─── Enums ─────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["admin", "landlord", "tenant"]);

export const propertyTypeEnum = pgEnum("property_type", [
    "apartment",
    "house",
    "condo",
    "studio",
    "townhouse",
    "villa",
]);

export const propertyStatusEnum = pgEnum("property_status", [
    "available",
    "rented",
    "maintenance",
    "pending",
]);

export const applicationStatusEnum = pgEnum("application_status", [
    "pending",
    "approved",
    "rejected",
    "withdrawn",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
    "pending",
    "confirmed",
    "cancelled",
    "completed",
]);

// ─── 1. Users ─────────────────────────────────────

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    username: varchar("username", { length: 100 }).notNull().unique(),
    full_name: varchar("full_name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    password_hash: varchar("password_hash", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull(),
    is_active: boolean("is_active").default(true).notNull(),
    is_verified: boolean("is_verified").default(false).notNull(),
    profile_image: varchar("profile_image", { length: 255 }),
    address: text("address"),
    date_of_birth: date("date_of_birth"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ─── 2. Properties ─────────────────────────────────

export const properties = pgTable("properties", {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    property_type: propertyTypeEnum("property_type").notNull(),
    address: text("address").notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 100 }).notNull(),
    zip_code: varchar("zip_code", { length: 20 }).notNull(),
    country: varchar("country", { length: 100 }).default("India"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    bedrooms: integer("bedrooms").notNull(),
    bathrooms: integer("bathrooms").notNull(),
    area_sqft: real("area_sqft").notNull(),
    monthly_rent: numeric("monthly_rent", { precision: 12, scale: 2 }).notNull(),
    security_deposit: numeric("security_deposit", { precision: 12, scale: 2 }).notNull(),
    is_furnished: boolean("is_furnished").default(false).notNull(),
    pets_allowed: boolean("pets_allowed").default(false).notNull(),
    smoking_allowed: boolean("smoking_allowed").default(false).notNull(),
    parking_available: boolean("parking_available").default(false).notNull(),
    status: propertyStatusEnum("status").default("available").notNull(),
    available_from: timestamp("available_from").notNull(),
    lease_duration_months: integer("lease_duration_months").default(12),

    // 🔥 FIX: Prevent accidental owner deletion
    owner_id: integer("owner_id")
        .references(() => users.id, { onDelete: "restrict" })
        .notNull(),

    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    check("rent_positive", sql`${table.monthly_rent} >= 0`),
    check("deposit_positive", sql`${table.security_deposit} >= 0`),
    check("area_positive", sql`${table.area_sqft} > 0`),
    check("bedrooms_valid", sql`${table.bedrooms} >= 0`),
    check("bathrooms_valid", sql`${table.bathrooms} >= 0`),
    check("lease_valid", sql`${table.lease_duration_months} > 0`)
]);

// ─── 3. Property Images ────────────────────────────

export const propertyImages = pgTable("property_images", {
    id: serial("id").primaryKey(),

    // ✅ Safe cascade (dependent data only)
    property_id: integer("property_id")
        .references(() => properties.id, { onDelete: "cascade" })
        .notNull(),

    image_url: varchar("image_url", { length: 512 }).notNull(),
    is_primary: boolean("is_primary").default(false).notNull(),
    caption: varchar("caption", { length: 255 }),
    created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    uniquePrimaryImage: uniqueIndex("unique_primary_image_per_property")
        .on(table.property_id)
        .where(sql`${table.is_primary} = true`)
}));

// ─── 4. Amenities ─────────────────────────────────

export const amenities = pgTable("amenities", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    icon: varchar("icon", { length: 100 }),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

// ─── 5. Property Amenities ────────────────────────

export const propertyAmenities = pgTable(
    "property_amenities",
    {
        id: serial("id").primaryKey(),
        property_id: integer("property_id")
            .references(() => properties.id, { onDelete: "cascade" })
            .notNull(),
        amenity_id: integer("amenity_id")
            .references(() => amenities.id, { onDelete: "cascade" })
            .notNull(),
    },
    (table) => ({
        uniquePropertyAmenity: uniqueIndex("unique_property_amenity").on(
            table.property_id,
            table.amenity_id
        ),
    })
);

// ─── 6. Applications ──────────────────────────────

export const applications = pgTable("applications", {
    id: serial("id").primaryKey(),

    // 🔥 FIX: prevent data loss
    property_id: integer("property_id")
        .references(() => properties.id, { onDelete: "restrict" })
        .notNull(),

    applicant_id: integer("applicant_id")
        .references(() => users.id, { onDelete: "restrict" })
        .notNull(),

    status: applicationStatusEnum("status").default("pending").notNull(),
    message: text("message"),
    monthly_income: numeric("monthly_income", { precision: 12, scale: 2 }).notNull(),
    employment_status: varchar("employment_status", { length: 100 }).notNull(),
    previous_address: text("previous_address"),
    references: text("references"),
    move_in_date: timestamp("move_in_date").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    check("income_positive", sql`${table.monthly_income} >= 0`)
]);

// ─── 7. Bookings ─────────────────────────────────

export const bookings = pgTable("bookings", {
    id: serial("id").primaryKey(),

    // 🔥 CRITICAL FIX
    property_id: integer("property_id")
        .references(() => properties.id, { onDelete: "restrict" })
        .notNull(),

    tenant_id: integer("tenant_id")
        .references(() => users.id, { onDelete: "restrict" })
        .notNull(),

    status: bookingStatusEnum("status").default("pending").notNull(),
    start_date: timestamp("start_date").notNull(),
    end_date: timestamp("end_date").notNull(),
    monthly_rent: numeric("monthly_rent", { precision: 12, scale: 2 }).notNull(),
    security_deposit: numeric("security_deposit", { precision: 12, scale: 2 }).notNull(),
    total_amount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    payment_status: varchar("payment_status", { length: 50 }).default("pending").notNull(),
    lease_document: varchar("lease_document", { length: 255 }),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    check("booking_dates_valid", sql`${table.end_date} > ${table.start_date}`),
    check("rent_positive", sql`${table.monthly_rent} >= 0`),
    check("deposit_positive", sql`${table.security_deposit} >= 0`),
    check("total_positive", sql`${table.total_amount} >= 0`)
]);

// ─── 8. Payments ─────────────────────────────────

export const payments = pgTable("payments", {
    id: serial("id").primaryKey(),

    // ✅ cascade OK (financial tied to booking)
    booking_id: integer("booking_id")
        .references(() => bookings.id, { onDelete: "restrict" })
        .notNull(),

    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    payment_type: varchar("payment_type", { length: 50 }).notNull(),
    payment_method: varchar("payment_method", { length: 50 }).notNull(),
    transaction_id: varchar("transaction_id", { length: 255 }),
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    due_date: timestamp("due_date").notNull(),
    paid_date: timestamp("paid_date"),
    created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    check("amount_positive", sql`${table.amount} >= 0`)
]);

// ─── 9. Maintenance Requests ─────────────────────

export const maintenanceRequests = pgTable("maintenance_requests", {
    id: serial("id").primaryKey(),

    property_id: integer("property_id")
        .references(() => properties.id, { onDelete: "restrict" })
        .notNull(),

    tenant_id: integer("tenant_id")
        .references(() => users.id, { onDelete: "restrict" })
        .notNull(),

    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    priority: varchar("priority", { length: 20 }).default("medium").notNull(),
    status: varchar("status", { length: 50 }).default("open"),
    estimated_cost: numeric("estimated_cost", { precision: 12, scale: 2 }),
    actual_cost: numeric("actual_cost", { precision: 12, scale: 2 }),
    assigned_to: varchar("assigned_to", { length: 255 }),
    completed_date: timestamp("completed_date"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    check("estimated_cost_positive", sql`${table.estimated_cost} >= 0`),
    check("actual_cost_positive", sql`${table.actual_cost} >= 0`)
]);

// ─── 10. Reviews ─────────────────────────────────

export const reviews = pgTable(
    "reviews",
    {
        id: serial("id").primaryKey(),

        property_id: integer("property_id")
            .references(() => properties.id, { onDelete: "cascade" }) // OK
            .notNull(),

        reviewer_id: integer("reviewer_id")
            .references(() => users.id, { onDelete: "restrict" })
            .notNull(),

        rating: integer("rating").notNull(),
        title: varchar("title", { length: 255 }).notNull(),
        comment: text("comment"),
        is_verified: boolean("is_verified").default(false).notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        check("rating_check", sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
    ]
);

// ─── Relations (UNCHANGED — already correct) ─────

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
    properties: many(properties),
    applications: many(applications),
    bookings: many(bookings),
    maintenanceRequests: many(maintenanceRequests),
    reviews: many(reviews),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
    owner: one(users, {
        fields: [properties.owner_id],
        references: [users.id],
    }),
    images: many(propertyImages),
    amenities: many(propertyAmenities),
    applications: many(applications),
    bookings: many(bookings),
    maintenanceRequests: many(maintenanceRequests),
    reviews: many(reviews),
}));

export const propertyImagesRelations = relations(propertyImages, ({ one }) => ({
    property: one(properties, {
        fields: [propertyImages.property_id],
        references: [properties.id],
    }),
}));

export const amenitiesRelations = relations(amenities, ({ many }) => ({
    properties: many(propertyAmenities),
}));

export const propertyAmenitiesRelations = relations(propertyAmenities, ({ one }) => ({
    property: one(properties, {
        fields: [propertyAmenities.property_id],
        references: [properties.id],
    }),
    amenity: one(amenities, {
        fields: [propertyAmenities.amenity_id],
        references: [amenities.id],
    }),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
    property: one(properties, {
        fields: [applications.property_id],
        references: [properties.id],
    }),
    applicant: one(users, {
        fields: [applications.applicant_id],
        references: [users.id],
    }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
    property: one(properties, {
        fields: [bookings.property_id],
        references: [properties.id],
    }),
    tenant: one(users, {
        fields: [bookings.tenant_id],
        references: [users.id],
    }),
    payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
    booking: one(bookings, {
        fields: [payments.booking_id],
        references: [bookings.id],
    }),
}));

export const maintenanceRequestsRelations = relations(maintenanceRequests, ({ one }) => ({
    property: one(properties, {
        fields: [maintenanceRequests.property_id],
        references: [properties.id],
    }),
    tenant: one(users, {
        fields: [maintenanceRequests.tenant_id],
        references: [users.id],
    }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
    property: one(properties, {
        fields: [reviews.property_id],
        references: [properties.id],
    }),
    reviewer: one(users, {
        fields: [reviews.reviewer_id],
        references: [users.id],
    }),
}));