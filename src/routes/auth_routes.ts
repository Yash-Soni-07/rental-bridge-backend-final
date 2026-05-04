import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema/app.js";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { comparePassword, hashPassword } from "../utils/hash.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
}

const JWT_EXPIRES_IN = "7d";

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const result = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

        if (!result.length) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = result[0]!;

        if (!user.is_active) {
            return res.status(403).json({ error: "Account is deactivated" });
        }

        const isMatch = await comparePassword(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
                is_verified: user.is_verified,
                profile_image: user.profile_image,
            },
        });
    } catch (error) {
        console.error("POST /auth/login error:", error);
        return res.status(500).json({ error: "Login failed" });
    }
});

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
router.post("/register", async (req: Request, res: Response) => {
    try {
        const { email, username, full_name, phone, password, role, address, date_of_birth } = req.body;

        if (!email || !username || !full_name || !password || !role) {
            return res.status(400).json({
                error: "email, username, full_name, password, and role are required",
            });
        }

        const validRoles = ["admin", "landlord", "tenant"] as const;

        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const password_hash = await hashPassword(password);

        const newUser = await db
            .insert(users)
            .values({
                email,
                username,
                full_name,
                phone: phone ?? null,
                password_hash,
                role,
                address: address ?? null,
                date_of_birth: date_of_birth ?? null,
            })
            .returning();

        const user = newUser[0]!;

        const token = jwt.sign(
            { id: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.status(201).json({
            message: "Registration successful",
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
            },
        });
    } catch (error: any) {
        console.error("POST /auth/register error:", error);

        if (error?.code === "23505") {
            return res.status(409).json({ error: "Email or username already exists" });
        }

        return res.status(500).json({ error: "Registration failed" });
    }
});

export default router;