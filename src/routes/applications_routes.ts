import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { applications, properties } from "../db/schema/app.js";
import { and, eq } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";
import { verifyOwnership } from "../middlewares/verifyOwnership.js";

const router = Router();

/**
 * Helper: Validate ID
 */
import { parseId } from "../utils/parseId.js";

// DB Error Handler
import { isConstraintViolation } from "../utils/dbErrorHandler.js";

// GET /api/applications — Admin: get all applications
router.get("/", async (_req: Request, res: Response) => {
    try {
        const all = await db.select().from(applications);
        return res.status(200).json(all);
    } catch (error) {
        console.error("GET /applications error:", error);
        return res.status(500).json({ error: "Failed to fetch applications" });
    }
});

// GET /api/applications/tenant/:tenantId — Tenant: my applications
router.get(
    "/tenant/:tenantId",
    authenticate,
    verifyOwnership("tenantId"),
    async (req: Request, res: Response) => {
        const tenantId = parseId(req.params.tenantId);
        if (!tenantId) {
            return res.status(400).json({ error: "Invalid tenant ID" });
        }

        try {
            const tenantApps = await db
                .select()
                .from(applications)
                .where(eq(applications.applicant_id, tenantId));

            return res.status(200).json(tenantApps);
        } catch (error) {
            console.error(`GET /applications/tenant/${tenantId} error:`, error);
            return res.status(500).json({ error: "Failed to fetch tenant applications" });
        }
    }
);

// GET /api/applications/property/:propertyId — Owner: applications for property
router.get("/property/:propertyId", authenticate, async (req: Request, res: Response) => {
    const propertyId = parseId(req.params.propertyId);
    if (!propertyId) {
        return res.status(400).json({ error: "Invalid property ID" });
    }

    try {
        // 🔒 Ownership check
        const property = await db
            .select()
            .from(properties)
            .where(eq(properties.id, propertyId));

        if (!property.length) {
            return res.status(404).json({ error: "Property not found" });
        }

        const propertyData = property[0];

        if (!propertyData) {
            return res.status(404).json({ error: "Property not found" });
        }

        if (req.user?.role !== "admin" && propertyData.owner_id !== req.user?.id) {
            return res.status(403).json({ error: "Forbidden: Not your property" });
        }

        const propertyApps = await db
            .select()
            .from(applications)
            .where(eq(applications.property_id, propertyId));

        return res.status(200).json(propertyApps);
    } catch (error) {
        console.error(`GET /applications/property/${propertyId} error:`, error);
        return res.status(500).json({ error: "Failed to fetch property applications" });
    }
});

// GET /api/applications/:id — Get single application
router.get("/:id", authenticate, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid application ID" });
    }

    try {
        const app = await db
            .select()
            .from(applications)
            .where(eq(applications.id, id));

        if (!app.length) {
            return res.status(404).json({ error: "Application not found" });
        }

        const application = app[0];

        // 🔒 Ownership check

        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }

        if (
            req.user?.role !== "admin" &&
            application.applicant_id !== req.user?.id
        ) {
            return res.status(403).json({ error: "Forbidden: Not your application" });
        }

        return res.status(200).json(application);
    } catch (error) {
        console.error(`GET /applications/${id} error:`, error);
        return res.status(500).json({ error: "Failed to fetch application" });
    }
});

// POST /api/applications — Submit application
router.post("/", authenticate, async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        if (!req.body.move_in_date) {
            return res.status(400).json({ error: "move_in_date is required" });
        }

        const parsedMoveInDate = new Date(req.body.move_in_date);
        if (isNaN(parsedMoveInDate.getTime())) {
            return res.status(400).json({ error: "move_in_date is invalid" });
        }

        const property_id = parseId(req.body.property_id);
        if (!property_id) {
            return res.status(400).json({ error: "Invalid property ID" });
        }

        if (!req.body.monthly_income) {
            return res.status(400).json({ error: "monthly_income is required" });
        }

        if (!req.body.employment_status) {
            return res.status(400).json({ error: "employment_status is required" });
        }

        // Validate unit_id if provided
        let unit_id = undefined;
        if (req.body.unit_id !== undefined) {
            const parsedUnitId = parseId(req.body.unit_id);
            if (parsedUnitId === null) {
                return res.status(400).json({ error: "Invalid unit_id" });
            }
            unit_id = parsedUnitId;
        }

        const newApp = await db
            .insert(applications)
            .values({
                property_id,
                ...(unit_id !== undefined && { unit_id }),
                applicant_id: req.user!.id,
                move_in_date: parsedMoveInDate,
                monthly_income: req.body.monthly_income,
                employment_status: req.body.employment_status,
                ...(req.body.references !== undefined && { references: req.body.references }),
            })
            .returning();

        return res.status(201).json(newApp[0]);
    } catch (error) {
        console.error("POST /applications error:", error);
        return res.status(500).json({ error: "Failed to submit application" });
    }
});

// PUT /api/applications/:id — Update application
router.put("/:id", authenticate, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid application ID" });
    }

    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const allowedFields: any = {}; // Using any here prevents deep type-checking issues with Drizzle's set
        if (req.body.status !== undefined) allowedFields.status = req.body.status;
        if (req.body.notes !== undefined) allowedFields.notes = req.body.notes;
        if (req.body.move_in_date !== undefined) {
            const parsedMoveInDate = new Date(req.body.move_in_date);
            if (isNaN(parsedMoveInDate.getTime())) {
                return res.status(400).json({ error: "move_in_date is invalid" });
            }
            allowedFields.move_in_date = parsedMoveInDate;
        }
        if (req.body.monthly_income !== undefined) allowedFields.monthly_income = req.body.monthly_income;
        if (req.body.employment_status !== undefined) allowedFields.employment_status = req.body.employment_status;
        if (req.body.references !== undefined) allowedFields.references = req.body.references;

        if (Object.keys(allowedFields).length === 0) {
            return res.status(400).json({ error: "No updatable fields provided" });
        }

        // 1. Fetch application
        const appResults = await db.select().from(applications).where(eq(applications.id, id)).limit(1);

        if (appResults.length === 0) {
            return res.status(404).json({ error: "Application not found" });
        }

        const application = appResults[0]!; // Use the '!' non-null assertion here

        // 2. Fetch property to identify the owner
        const propResults = await db.select().from(properties).where(eq(properties.id, application.property_id)).limit(1);
        const property = propResults[0];

        // 3. Authorization Check
        const isAdmin = req.user?.role === "admin";
        const isApplicant = application.applicant_id === req.user?.id;
        const isOwner = property && property.owner_id === req.user?.id;

        if (!isAdmin && !isApplicant && !isOwner) {
            return res.status(403).json({ error: "Forbidden: You do not have access to update this application" });
        }

        // 4. Perform Update
        const updated = await db
            .update(applications)
            .set({ ...allowedFields, updated_at: new Date() })
            .where(eq(applications.id, id))
            .returning();

        return res.status(200).json(updated[0]);
    } catch (error) {
        console.error(`PUT /applications/${id} error:`, error);
        return res.status(500).json({ error: "Failed to update application" });
    }
});

// DELETE /api/applications/:id — Withdraw application
router.delete("/:id", authenticate, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid application ID" });
    }

    try {
        // 🔒 Ownership folded atomically into the WHERE predicate (eliminates TOCTOU)
        const whereClause =
            req.user?.role === "admin"
                ? eq(applications.id, id)
                : and(eq(applications.id, id), eq(applications.applicant_id, req.user!.id));

        const deleted = await db
            .delete(applications)
            .where(whereClause)
            .returning();

        if (!deleted.length) {
            return res.status(404).json({ error: "Application not found" });
        }

        return res.status(200).json({ message: "Application withdrawn" });
    } catch (error: any) {
        console.error(`DELETE /applications/${id} error:`, error);

        if (isConstraintViolation(error)) {
            return res.status(409).json({
                error: "Cannot delete application due to existing dependencies",
            });
        }

        return res.status(500).json({
            error: "Failed to delete application",
        });
    }
});

export default router;