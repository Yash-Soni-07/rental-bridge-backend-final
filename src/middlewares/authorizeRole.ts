import { Request, Response, NextFunction } from "express";

/**
 * Middleware: Allow only specified roles
 * Usage: authorizeRole("admin", "landlord")
 */
export function authorizeRole(...roles: Array<"admin" | "landlord" | "tenant">) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = req.user;

        if (!user) {
            res.status(401).json({ error: "Unauthorized: Not authenticated" });
            return;
        }

        if (!roles.includes(user.role)) {
            res.status(403).json({
                error: `Forbidden: Requires role(s): ${roles.join(", ")}`,
            });
            return;
        }

        next();
    };
}