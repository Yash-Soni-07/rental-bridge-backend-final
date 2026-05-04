import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export interface JwtPayload {
    id: number;
    role: "admin" | "landlord" | "tenant";
}

/**
 * Middleware: Verify Bearer JWT and attach user to req.user
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized: No token provided" });
        return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        res.status(401).json({ error: "Unauthorized: Invalid token format" });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // ✅ SAFE TYPE CHECK (no breaking change)
        if (typeof decoded !== "object" || decoded === null) {
            res.status(401).json({ error: "Unauthorized: Invalid token payload" });
            return;
        }

        const payload = decoded as JwtPayload;

        req.user = {
            id: payload.id,
            role: payload.role,
        };

        next();
    } catch (err) {
        res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
}