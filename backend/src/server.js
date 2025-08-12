// src/server.js
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import session from "express-session";
import pgSimple from "connect-pg-simple";
import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { pool } from "./db/pool.js";
import { requireAuth } from "./middleware/requireAuth.js";
// src/server.js
import metaRoutes from "./routes/meta.routes.js";


// --- Routes ---
import healthRoutes from "./routes/health.routes.js";
import csrfRoutes from "./routes/csrf.routes.js";
import bootstrapRoutes from "./routes/bootstrap.routes.js";
import auth from "./routes/auth.js";
import authMe from "./routes/auth.me.js";
import adminUsers from "./routes/adminUsers.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import leadsRoutes from "./routes/leads.routes.js";
import leadsModule from "./routes/leadsModule.routes.js";
import rateLimit from "express-rate-limit";

// --- Config ---
const app = express();
const PgStore = pgSimple(session);
const isProd = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 4000);
const APP_URL =
  process.env.APP_URL ||
  (isProd ? "https://your-api.onrender.com" : "http://localhost:4000");

// Allowed frontend origins (add more via FRONTEND_ORIGINS=csv)
const ORIGINS = [
  "http://localhost:5173",
  "https://geniusgrid-web.onrender.com",
  ...(process.env.FRONTEND_ORIGINS ? process.env.FRONTEND_ORIGINS.split(",") : []),
]
  .map((s) => s.trim())
  .filter(Boolean);

// --- Logger (pino) ---
const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  base: { service: "geniusgrid-api", env: process.env.NODE_ENV || "dev" },
});
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers["x-request-id"] || randomUUID(),
    customLogLevel: (res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  })
);

app.use("/api/meta", metaRoutes);



// Trust proxy (Render/Cloudflare) so secure cookies work
app.set("trust proxy", 1);

// Security & perf
app.use(
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })
);
app.use(compression());

// Parsers
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ---------------- PUBLIC HEALTH FIRST (no auth, no rate-limit) ----------------
app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});
app.head("/api/health", (_req, res) => res.sendStatus(200)); // Render sometimes probes HEAD

// Public root ping (optional)
app.head("/", (_req, res) => res.sendStatus(200));
app.get("/", (_req, res) => res.status(200).send("GeniusGrid API OK"));

// ---------------- CORS ----------------
app.use(
  cors({
    origin: ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "X-Requested-With",
      "X-CSRF-Token",
      "Authorization",
      // allow both casings for company header
      "X-Company-ID",
      "X-Company-Id",
      "x-company-id",
    ],
    exposedHeaders: ["X-Request-Id", "X-Version"],
  })
);
app.options("*", cors({ origin: ORIGINS, credentials: true }));

// Attach response headers (versioning & request id surfaced)
app.use((req, res, next) => {
  res.setHeader("X-Version", process.env.APP_VERSION || "v1");
  res.setHeader("X-Request-Id", req.id);
  next();
});

// ---------------- Session (PG store) ----------------
app.use(
  session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    name: "__erp_sid",
    secret: process.env.SESSION_SECRET || "CHANGE_ME",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd, // HTTPS in prod, HTTP locally
      sameSite: isProd ? "none" : "lax",
      maxAge: Number(process.env.SESSION_TTL_HOURS || 12) * 60 * 60 * 1000,
    },
  })
);

// Tenant scope helper (safe no-op if no session)
app.use(async (req, _res, next) => {
  try {
    const tid = req.session?.tenantId || req.session?.tenant_id;
    if (tid) {
      // IMPORTANT: set_config(..., false) so it persists on the connection
      await pool.query("SELECT set_config('app.tenant_id', $1, false)", [tid]);
    }
  } catch (e) {
    req.log?.warn({ err: e }, "tenant-scope set_config failed");
  } finally {
    next();
  }
});

// ---------------- Rate limiting (after public health; before the rest) ----------------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT || 900),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

// ---------------- Other PUBLIC routes ----------------
app.use("/api/ready", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});
app.use("/api/csrf", csrfRoutes);
app.use("/api/bootstrap", bootstrapRoutes);
app.use("/api/auth", auth);
app.use("/api/auth", authMe); // /api/auth/me (reads session if exists)

// Public leads ping so you can verify router exists without a cookie
app.get("/api/leads/ping", (_req, res) => res.json({ ok: true }));

// ---------------- PROTECTED routes ----------------
app.use("/api/admin", requireAuth, adminUsers);
app.use("/api", requireAuth, dashboardRoutes);
app.use("/api/leads", requireAuth, leadsRoutes);
app.use("/api", requireAuth, leadsModule);

// ---------------- 404 & Errors ----------------
app.use((_req, res) => res.status(404).json({ message: "Not Found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  req.log?.error({ err }, "Unhandled error");
  const status = err.status || 500;
  res.status(status).json({
    type: "about:blank",
    title: status >= 500 ? "Server Error" : "Request Error",
    status,
    detail: err.message || "Unexpected error",
  });
});

// ---------------- Start & Graceful Shutdown ----------------
const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info(
    { port: PORT, deploy_env: isProd ? "prod" : "dev", url: APP_URL },
    "API listening"
  );
});

function shutdown(sig) {
  logger.warn({ sig }, "Shutting down...");
  server.close(async () => {
    try {
      await pool.end();
    } catch {}
    logger.warn("Closed HTTP & PG pool. Bye.");
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
