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
import rateLimit from "express-rate-limit";

import { pool } from "./db/pool.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { attachCtx } from "./middleware/ctx.middleware.js";

/* ---------- Routes ---------- */
import uiRoutes from "./routes/ui.routes.js";
import metaRoutes from "./routes/meta.routes.js";
import countriesRouter from "./routes/countries.js";
import csrfRoutes from "./routes/csrf.routes.js";
import bootstrapRoutes from "./routes/bootstrap.routes.js";
import auth from "./routes/auth.js";
import authMe from "./routes/auth.me.js";
import adminUsers from "./routes/adminUsers.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import leadsRoutes from "./routes/leads.routes.js";
import leadsModule from "./routes/leadsModule.routes.js";
import customFieldsRoutes from "./routes/customFields.routes.js";
import leadsCheckMobile from "./routes/leads.checkMobile.js";
import leadsAiRoutes from "./routes/leads.ai.routes.js";
import leadsDupRoutes from "./routes/leads.duplicates.routes.js";
import leadsAssignRoutes from "./routes/leads.assign.routes.js";
import leadsMergeRoutes from "./routes/leads.merge.routes.js";
import calendarLeadsRouter from "./routes/calendar.leads.routes.js";

/* ✅ AI Prospect + Imports (store namespace) */
import aiProspectRoutes from "./store/ai.prospect.routes.js";
import leadsImportsRoutes from "./store/leads.imports.routes.js";

/* ✅ Custom fields (leads) */
import leadsCustomFieldsRoutes from "./routes/leadsCustomFields.routes.js";
import tenantMenusRoutes from "./routes/tenantMenus.routes.js";

/* ✅ Public custom-fields endpoint for the drawer */
import customFields from "./routes/customFields.js";

/* 🔧 Dev diagnostics (header-gated) */
import devDiag from "./routes/dev.diag.js";

/* ---------- App init ---------- */
const app = express();
const PgStore = pgSimple(session);
const isProd = process.env.NODE_ENV === "production";

// Port comes from env, default 3000 in dev, 8080 in prod
const PORT = Number(process.env.PORT || (isProd ? 8080 : 3000));

// APP_URL comes from env; if not set, build from PORT
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

/* ---------- CORS allowlist ---------- */
const ORIGINS = [
  process.env.FRONTEND_ORIGIN,
  "http://localhost:5173",
  "https://geniusgrid.onrender.com",
  ...(process.env.FRONTEND_ORIGINS ? process.env.FRONTEND_ORIGINS.split(",") : []),
]
  .filter(Boolean)
  .map((s) => s.trim());
const ALLOW = new Set(ORIGINS);

/* ---------- Logger ---------- */
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

/* ---------- Security & Perf ---------- */
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());

/* ---------- Parsers ---------- */
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

/* ---------- CORS (must be before routes) ---------- */
const corsOpts = {
  origin(origin, cb) {
    // allow server-to-server, curl, same-origin (no Origin header)
    if (!origin) return cb(null, true);
    return cb(null, ALLOW.has(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "X-Requested-With",
    "X-CSRF-Token",
    "Authorization",
    "X-Company-ID",
    "X-Company-Id",
    "x-company-id",
    // ✅ allow tenant header variants
    "X-Tenant-ID",
    "X-Tenant-Id",
    "x-tenant-id",
  ],
  exposedHeaders: ["X-Request-Id", "X-Version"],
  maxAge: 86400, // cache preflight for a day
};
app.use(cors(corsOpts));
app.options("*", cors(corsOpts)); // preflight responder
app.use((req, res, next) => {
  res.header("Vary", "Origin"); // play nice with caches/CDNs
  next();
});

/* ---------- Version headers ---------- */
app.use((req, res, next) => {
  res.setHeader("X-Version", process.env.APP_VERSION || "v1");
  res.setHeader("X-Request-Id", req.id);
  next();
});

/* ---------- Mount calendar routes early (public) ---------- */
// Keep these public so the FE can call with headers or query params.
app.use("/api/calendar", calendarLeadsRouter);

/* ---------- Early utility routes ---------- */
app.use("/api", leadsCheckMobile);

/* ---------- Public health ---------- */
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/api/health", (_req, res) =>
  res.status(200).json({ ok: true, ts: new Date().toISOString() })
);
app.head("/api/health", (_req, res) => res.sendStatus(200));
app.head("/", (_req, res) => res.sendStatus(200));
app.get("/", (_req, res) => res.status(200).send("GeniusGrid API OK"));

/* ---------- Session ---------- */
// For cross-site requests (FE on a different domain), cookies must be SameSite=None; Secure
app.use(
  session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    name: "__erp_sid",
    secret: process.env.SESSION_SECRET || "CHANGE_ME",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,          // required for SameSite=None
      sameSite: isProd ? "none" : "lax",
      maxAge: Number(process.env.SESSION_TTL_HOURS || 12) * 60 * 60 * 1000,
    },
  })
);

/* ---------- Attach req.ctx for downstream routes ---------- */
app.use(attachCtx);

/* ---------- Rate limiting ---------- */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT || 900),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

/* ---------- DEV DIAG (public but header-gated, BEFORE protected) ---------- */
const DIAG_KEY = process.env.DIAG_KEY || "dev-diag";
app.use("/api/dev", (req, res, next) => {
  if (req.get("x-diag-key") === DIAG_KEY) return next();
  return res.status(401).json({ message: "Unauthorized" });
});
app.use("/api/dev", devDiag); // GET /api/dev/diag

/* ---------- PUBLIC routes (no auth) ---------- */
app.use("/api/ui", uiRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/countries", countriesRouter);
app.use("/api/csrf", csrfRoutes);
app.use("/api/bootstrap", bootstrapRoutes);

// Public pings
app.get("/api/leads/ping", (_req, res) => res.json({ ok: true }));

// ✅ PUBLIC custom-fields for the drawer (requires tenant via session/header/query)
app.use("/api/custom-fields", customFields);

/* ---------- AUTH routes ---------- */
app.use("/api/auth", auth);
app.use("/api/auth", authMe);
// Alias to support frontend calling /auth/*
app.use("/auth", auth);
app.use("/auth", authMe);

/* ✅ PROTECTED: AI prospect namespace (requires auth) */
app.use("/api/ai/prospect", requireAuth, aiProspectRoutes);

/* ---------- PROTECTED routes ---------- */
app.use("/api/admin", requireAuth, adminUsers);
app.use("/api/dashboard", requireAuth, dashboardRoutes);

// This is the CRM custom-fields admin surface; keep protected
app.use("/api/crm", requireAuth, customFieldsRoutes);

// Leads-related (protected)
app.use("/api", requireAuth, leadsCustomFieldsRoutes);
app.use("/api/leads", requireAuth, leadsRoutes);
app.use("/api/leads", requireAuth, leadsAiRoutes);
app.use("/api/leads", requireAuth, leadsDupRoutes);
app.use("/api/leads", requireAuth, leadsAssignRoutes);
app.use("/api/leads", requireAuth, leadsMergeRoutes);
app.use("/api/leads/imports", requireAuth, leadsImportsRoutes);
app.use("/api/leads-module", requireAuth, leadsModule);

// Tenant menus (protected)
app.use("/api", requireAuth, tenantMenusRoutes);

// ❌ removed old protected mount of /api/custom-fields
// app.use("/api/custom-fields", requireAuth, customFields);

/* ---------- 404 & Errors ---------- */
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

/* ---------- Start & Shutdown ---------- */
const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info(
    { port: PORT, deploy_env: isProd ? "prod" : "dev", url: APP_URL, cors_allow: [...ALLOW] },
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
