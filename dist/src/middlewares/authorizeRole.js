/**
 * Middleware: Allow only specified roles
 * Usage: authorizeRole("admin", "landlord")
 */
export function authorizeRole(...roles) {
    return (req, res, next) => {
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
//# sourceMappingURL=authorizeRole.js.map