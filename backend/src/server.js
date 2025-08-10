// src/server.js
import express from "express";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import pgSimple from "connect-pg-simple";
import { pool } from "./db/pool.js";

// Routes
import healthRoutes from "./routes/health.routes.js";
import csrfRoutes from "./routes/csrf.routes.js";
import bootstrapRoutes from "./routes/bootstrap.routes.js";
import auth from "./routes/auth.js";
import authMe from "./routes/auth.me.js";
import adminUsers from "./routes/adminUsers.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

const app = express();
const PgStore = pgSimple(session);

const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 4000;

// Frontend origins allowed to send credentials
const ORIGINS = [
  "http://localhost:5173",
  "https://geniusgrid-web.onrender.com"
];

// Trust proxy (Render/Cloudflare) so secure cookies work
app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// JSON body
app.use(express.json({ limit: "1mb" }));

// CORS (must be before routes + session usage)
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/Postman/no Origin
      return ORIGINS.includes(origin) ? cb(null, true) : cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "X-Requested-With",
      "X-Company-ID",
      "X-CSRF-Token",
      "Authorization"
    ]
  })
);
// Preflight helper
app.options("*", cors({ origin: ORIGINS, credentials: true }));

// Session (must be before any route that reads/writes req.session)
app.use(
  session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    name: "__erp_sid",
    secret: process.env.SESSION_SECRET || "CHANGE_ME",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,                 // Render uses HTTPS
      sameSite: isProd ? "none" : "lax", // allow cross-site in prod
      maxAge: 1000 * 60 * 60 * 8      // 8h
    }
  })
);

// Per-request tenant scope (optional helper)
app.use(async (req, _res, next) => {
  try {
    const tid = req.session?.tenantId || req.session?.tenant_id;
    if (tid) {
      await pool.query("SELECT set_config('app.tenant_id', $1, true)", [tid]);
    }
  } catch (e) {
    console.error("[tenant-scope]", e?.message || e);
  } finally {
    next();
  }
});

/* ---------- Health & diagnostics ---------- */
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "GeniusGrid API",
    env: process.env.NODE_ENV || "development",
    time: new Date().toISOString()
  });
});

app.get("/api/session-debug", (req, res) => {
  res.json({
    hasSession: !!req.session,
    userId: req.session?.userId ?? req.session?.user_id ?? null,
    tenantId: req.session?.tenantId ?? req.session?.tenant_id ?? null,
    sid: req.sessionID || null
  });
});

app.post("/api/_echo", (req, res) => {
  res.json({ got: req.body || null, sid: req.sessionID || null });
});

/* ---------- Mount routes (after CORS + session!) ---------- */
app.use("/api/auth", auth);           // login/reset/etc (sets req.session.*)
app.use("/api/auth", authMe);         // /api/auth/me
app.use("/api", dashboardRoutes);
app.use("/api/admin", adminUsers);
app.use("/api/csrf", csrfRoutes);
app.use("/api/bootstrap", bootstrapRoutes);
app.use("/api", healthRoutes);        // also fine here

// Root
app.get("/", (_req, res) => res.status(200).send("GeniusGrid API OK"));

// 404
app.use((_req, res) => res.status(404).json({ message: "Not Found" }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err?.message || err);
  res.status(500).json({ message: "Server error" });
});

// Start
app.listen(PORT, () => {
  console.log(`API listening on :${PORT} (${isProd ? "prod" : "dev"})`);
});
