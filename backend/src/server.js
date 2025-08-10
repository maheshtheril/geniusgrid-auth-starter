// src/server.js
import express from "express";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import pgSimple from "connect-pg-simple";
import { pool } from "./db/pool.js";

// Routes
import auth from "./routes/auth.js";
import adminUsers from "./routes/adminUsers.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

const app = express();
const PgStore = pgSimple(session);

// --- Config ---
const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 4000;

// IMPORTANT: If your frontend is on a different domain, list it here.
// In prod, Render is HTTPS, so Secure + SameSite=None is required for cross-site cookies.
const ORIGINS = [
  "http://localhost:5173",
  "https://geniusgrid-web.onrender.com",
];

// --- Trust proxy (Render/Cloudflare) ---
app.set("trust proxy", 1);

// --- Security headers ---
app.use(
  helmet({
    contentSecurityPolicy: false,     // API-friendly
    crossOriginEmbedderPolicy: false,
  })
);

// --- Body parsing ---
app.use(express.json({ limit: "1mb" }));

// --- CORS (with credentials) ---
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser tools like curl (no Origin header)
      if (!origin) return cb(null, true);
      return ORIGINS.includes(origin) ? cb(null, true) : cb(new Error("CORS blocked"));
    },
    credentials: true,
  })
);

// Preflight helper (optional)
app.options("*", cors({ origin: ORIGINS, credentials: true }));

// --- Session (MUST come before routes) ---
app.use(
  session({
    store: new PgStore({
      pool,
      createTableIfMissing: true, // auto-creates "session" table
      // tableName: "session",
    }),
    name: "__erp_sid",
    secret: process.env.SESSION_SECRET || "CHANGE_ME",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Cross-site cookie rules:
      // - Local dev: not secure, SameSite=Lax (works on http://localhost)
      // - Prod (Render): secure, SameSite=None (allows cross-site from your frontend domain)
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 8, // 8h
    },
  })
);

// --- Per-request tenant scope (GUC) ---
// Ensures RLS sees the correct tenant for every request using the session tenantId
app.use(async (req, _res, next) => {
  try {
    const tid = req.session?.tenantId;
    if (tid) {
      await pool.query("SELECT set_config('app.tenant_id', $1, true)", [tid]);
    }
  } catch (e) {
    // Don't block the request on scope failure — your route handlers can handle errors
    console.error("[tenant-scope]", e?.message || e);
  } finally {
    next();
  }
});

// --- Health & Diagnostics (place BEFORE other routers) ---
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "GeniusGrid API",
    env: process.env.NODE_ENV || "development",
    time: new Date().toISOString(),
  });
});

// Session visibility debug (safe to remove later)
app.get("/api/session-debug", (req, res) => {
  res.json({
    hasSession: !!req.session,
    userId: req.session?.userId || null,
    tenantId: req.session?.tenantId || null,
  });
});

// Simple echo to test JSON body + CORS + session plumbing
app.post("/api/_echo", (req, res) => {
  res.json({
    got: req.body || null,
    sid: req.sessionID || null,
  });
});

// --- Mount your app routes (these need session above) ---
app.use("/api/auth", auth);
app.use("/api", dashboardRoutes);
app.use("/api/admin", adminUsers);

app.get("/", (_req, res) => {
  res.status(200).send("GeniusGrid API OK");
});

// --- 404 handler ---
app.use((_req, res) => res.status(404).json({ message: "Not Found" }));

// --- Error handler ---
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err?.message || err);
  res.status(500).json({ message: "Server error" });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`API listening on :${PORT} (${isProd ? "prod" : "dev"})`);
});
