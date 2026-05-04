import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { maintenanceRequests } from "../db/schema/app.js";
import { eq } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";
import { verifyOwnership } from "../middlewares/verifyOwnership.js";

const router = Router();

/**
 * Helper: Validate ID
 */
import { parseId } from "../utils/parseId.js";

// DB Error Handler
import { isConstraintViolation } from "../utils/dbErrorHandler.js";

// GET /api/maintenance — Admin: get all requests
router.get("/", async (_req: Request, res: Response) => {
    try {
        const all = await db.select().from(maintenanceRequests);
        return res.status(200).json(all);
    } catch (error) {
        console.error("GET /maintenance error:", error);
        return res.status(500).json({ error: "Failed to fetch maintenance requests" });
    }
});

// GET /api/maintenance/tenant/:tenantId — Tenant: my requests
router.get("/tenant/:tenantId", authenticate, verifyOwnership("tenantId"), async (req: Request, res: Response) => {
    const tenantId = parseId(req.params.tenantId);
    if (!tenantId) {
        return res.status(400).json({ error: "Invalid tenant ID" });
    }

    try {
        const tenantRequests = await db
            .select()
            .from(maintenanceRequests)
            .where(eq(maintenanceRequests.tenant_id, tenantId));

        return res.status(200).json(tenantRequests);
    } catch (error) {
        console.error(`GET /maintenance/tenant/${tenantId} error:`, error);
        return res.status(500).json({ error: "Failed to fetch tenant requests" });
    }
});

// GET /api/maintenance/property/:propertyId — Owner: property requests
router.get("/property/:propertyId", async (req: Request, res: Response) => {
    const propertyId = parseId(req.params.propertyId);
    if (!propertyId) {
        return res.status(400).json({ error: "Invalid property ID" });
    }

    try {
        const propertyRequests = await db
            .select()
            .from(maintenanceRequests)
            .where(eq(maintenanceRequests.property_id, propertyId));

        return res.status(200).json(propertyRequests);
    } catch (error) {
        console.error(`GET /maintenance/property/${propertyId} error:`, error);
        return res.status(500).json({ error: "Failed to fetch property requests" });
    }
});

// GET /api/maintenance/:id — Get single request
router.get("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid request ID" });
    }

    try {
        const request = await db
            .select()
            .from(maintenanceRequests)
            .where(eq(maintenanceRequests.id, id));

        if (!request.length) {
            return res.status(404).json({ error: "Request not found" });
        }

        return res.status(200).json(request[0]);
    } catch (error) {
        console.error(`GET /maintenance/${id} error:`, error);
        return res.status(500).json({ error: "Failed to fetch request" });
    }
});

// POST /api/maintenance — Create request
router.post("/", async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const newRequest = await db
            .insert(maintenanceRequests)
            .values(req.body)
            .returning();

        return res.status(201).json(newRequest[0]);
    } catch (error) {
        console.error("POST /maintenance error:", error);
        return res.status(500).json({ error: "Failed to create request" });
    }
});

// PUT /api/maintenance/:id — Update request
router.put("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid request ID" });
    }

    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const updated = await db
            .update(maintenanceRequests)
            .set({ ...req.body, updated_at: new Date() })
            .where(eq(maintenanceRequests.id, id))
            .returning();

        if (!updated.length) {
            return res.status(404).json({ error: "Request not found" });
        }

        return res.status(200).json(updated[0]);
    } catch (error) {
        console.error(`PUT /maintenance/${id} error:`, error);
        return res.status(500).json({ error: "Failed to update request" });
    }
});

// DELETE /api/maintenance/:id — Delete request
router.delete("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid request ID" });
    }

    try {
        const deleted = await db
            .delete(maintenanceRequests)
            .where(eq(maintenanceRequests.id, id))
            .returning();

        if (!deleted.length) {
            return res.status(404).json({ error: "Maintenance request not found" });
        }

        return res.status(200).json({
            message: "Maintenance request deleted",
        });
    } catch (error: any) {
        console.error(`DELETE /maintenance/${id} error:`, error);

        if (isConstraintViolation(error)) {
            return res.status(409).json({
                error: "Cannot delete request due to existing dependencies",
            });
        }

        return res.status(500).json({
            error: "Failed to delete request",
        });
    }
});

export default router;