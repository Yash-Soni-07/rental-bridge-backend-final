import { Request, Response, NextFunction } from "express";

/**
 * Middleware: Verify the resource belongs to req.user.id
 */
export function verifyOwnership(fieldName: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = req.user;

        if (!user) {
            res.status(401).json({ error: "Unauthorized: Not authenticated" });
            return;
        }

        // Admin bypass
        if (user.role === "admin") {
            next();
            return;
        }

        const paramValue = req.params[fieldName];

        if (!paramValue) {
            res.status(400).json({ error: `Missing param: ${fieldName}` });
            return;
        }

        const resourceOwnerId = Number(paramValue);

        if (Number.isNaN(resourceOwnerId)) {
            res.status(400).json({ error: `Invalid param: ${fieldName}` });
            return;
        }

        if (user.id !== resourceOwnerId) {
            res.status(403).json({
                error: "Forbidden: You do not have access to this resource",
            });
            return;
        }

        next();
    };
}