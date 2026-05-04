import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema/app.js";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * Helper: Validate ID param
 */
import { parseId } from "../utils/parseId.js";

// DB Error Handler
import { isConstraintViolation } from "../utils/dbErrorHandler.js";

// ─────────────────────────────────────────────
// GET /api/users — Get all users (Admin only)
// ─────────────────────────────────────────────
router.get("/", async (_req: Request, res: Response) => {
    try {
        const allUsers = await db.select().from(users);
        return res.status(200).json(allUsers);
    } catch (error) {
        console.error("GET /users error:", error);
        return res.status(500).json({ error: "Failed to fetch users" });
    }
});

// ─────────────────────────────────────────────
// GET /api/users/:id — Get user by ID
// ─────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid user ID" });
    }

    try {
        const user = await db.select().from(users).where(eq(users.id, id));

        if (!user.length) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json(user[0]);
    } catch (error) {
        console.error(`GET /users/${id} error:`, error);
        return res.status(500).json({ error: "Failed to fetch user" });
    }
});

// ─────────────────────────────────────────────
// POST /api/users — Register new user
// ─────────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
    try {
        // Basic body validation (non-breaking)
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const newUser = await db.insert(users).values(req.body).returning();

        return res.status(201).json(newUser[0]);
    } catch (error) {
        console.error("POST /users error:", error);
        return res.status(500).json({ error: "Failed to create user" });
    }
});

// ─────────────────────────────────────────────
// PUT /api/users/:id — Update user
// ─────────────────────────────────────────────
router.put("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid user ID" });
    }

    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const updated = await db
            .update(users)
            .set({ ...req.body, updated_at: new Date() })
            .where(eq(users.id, id))
            .returning();

        if (!updated.length) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json(updated[0]);
    } catch (error) {
        console.error(`PUT /users/${id} error:`, error);
        return res.status(500).json({ error: "Failed to update user" });
    }
});

// ─────────────────────────────────────────────
// DELETE /api/users/:id — Delete user (Admin only)
// ─────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ error: "Invalid user ID" });
    }

    try {
        const deleted = await db
            .delete(users)
            .where(eq(users.id, id))
            .returning();

        if (!deleted.length) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({ message: "User deleted successfully" });
    } catch (error: any) {
        console.error(`DELETE /users/${id} error:`, error);

        if (isConstraintViolation(error)) {
            return res.status(409).json({
                error: "Cannot delete user due to existing dependencies",
            });
        }

        return res.status(500).json({
            error: "Failed to delete user",
        });
    }
});

export default router;