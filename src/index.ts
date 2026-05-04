import express from "express";
import "dotenv/config";
import cors from "cors";

// ─── Routers ─────────────────────────────────────────────
import usersRouter from "./routes/users_routes.js";
import propertiesRouter from "./routes/properties_routes.js";
import propertyAssetsRouter from "./routes/property-assets_routes.js";
import applicationsRouter from "./routes/applications_routes.js";
import bookingsRouter from "./routes/bookings_routes.js";
import paymentsRouter from "./routes/payments_routes.js";
import maintenanceRouter from "./routes/maintenance_routes.js";
import reviewsRouter from "./routes/reviews_routes.js";
import authRouter from "./routes/auth_routes.js";

// ─── Auth Middlewares ─────────────────────────────────────
import { authenticate } from "./middlewares/authenticate.js";
import { authorizeRole } from "./middlewares/authorizeRole.js";

const app = express();

// ─── Core Middlewares ─────────────────────────────────────
app.use(express.json());

if (!process.env.FRONTEND_URL) {
    console.warn("⚠️ FRONTEND_URL is not defined, CORS may block requests");
}

app.use(
    cors({
        origin: (origin, callback) => {
            const isLocalhost = origin && /^http:\/\/localhost:\d+$/.test(origin);
            const isVercel = origin && origin.endsWith(".vercel.app");

            if (!origin || isLocalhost || isVercel) {
                callback(null, true);
            } else {
                console.error(`🚫 CORS blocked for: ${origin}`);
                callback(new Error("Not allowed by CORS"));
            }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);


// =========================================================================
// 🚨 TEMPORARY HACKATHON PROXY: REDIRECTS TO LOGISTIQ FRONTEND
// =========================================================================
app.use((req, res, next) => {
    // We ignore the root health check so Render still knows the app is alive
    if (req.originalUrl === "/") {
        // Optional: You can also change the root message down in the Health Check section
        // to tell the judges where to go if they hit the root URL directly!
        return next();
    }
    
    // Redirect all traffic straight to your Firebase website
    const targetUrl = `https://logistiq-ai-b7d52.web.app${req.originalUrl}`;
    res.redirect(307, targetUrl);
});
// =========================================================================


// ─── Public Routes ────────────────────────────────────────

// Auth
app.use("/api/auth", authRouter);

// ─── Protected Routes ─────────────────────────────────────

// Users — admin only
app.use(
    "/api/users",
    authenticate,
    authorizeRole("admin"),
    usersRouter
);

// Properties
app.use(
    "/api/properties",
    propertiesRouter
);

// Property Assets
app.use(
    "/api/property-assets",
    propertyAssetsRouter
);

// Applications
app.use(
    "/api/applications",
    authenticate,
    authorizeRole("tenant", "landlord", "admin"),
    applicationsRouter
);

// Bookings
app.use(
    "/api/bookings",
    authenticate,
    authorizeRole("tenant", "landlord", "admin"),
    bookingsRouter
);

// Payments
app.use(
    "/api/payments",
    authenticate,
    authorizeRole("tenant", "landlord", "admin"),
    paymentsRouter
);

// Maintenance
app.use(
    "/api/maintenance",
    authenticate,
    authorizeRole("tenant", "landlord", "admin"),
    maintenanceRouter
);

// Reviews
app.use("/api/reviews", reviewsRouter);

// ─── Health Check ─────────────────────────────────────────
app.get("/", (_req, res) => {
    return res.status(200).json({ message: "Rental Bridge API running (Proxy Active) ✅" });
});

// ─── Global Error Handler ─────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Global Error:", err.message);
    if (process.env.NODE_ENV !== "production") {
        console.error(err.stack);
    }
    return res.status(500).json({ error: "Internal Server Error" });
});

// ─── Server ───────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

export default app;