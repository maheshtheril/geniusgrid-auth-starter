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

/* ✅ AI Prospect + Imports (store namespace) */
import aiProspectRoutes from "./store/ai.prospect.routes.js";
import leadsImportsRoutes from "./store/leads.imports.routes.js";

const app = express();
const PgStore = pgSimple(session);
const isProd = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 4000);
const APP_URL =
  process.env.APP_URL ||
  (isProd ? "https://your-api.onrender.com" : "http://localhost:4000");

/* ---------- CORS ---------- */
const ORIGINS = [
  "http://localhost:5173",
  "https://geniusgrid-web.onrender.com",
  ...(process.env.FRONTEND_ORIGINS ? process.env.FRONTEND_ORIGINS.split(",") : []),
].map((s) => s.trim()).filter(Boolean);

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

/* ---------- CORS (before routes) ---------- */
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
      "X-Company-ID",
      "X-Company-Id",
      "x-company-id",
    ],
    exposedHeaders: ["X-Request-Id", "X-Version"],
  })
);
app.use((req, res, next) => { res.header("Vary", "Origin"); next(); });
app.options("*", cors({ origin: ORIGINS, credentials: true }));

/* ---------- Version headers ---------- */
app.use((req, res, next) => {
  res.setHeader("X-Version", process.env.APP_VERSION || "v1");
  res.setHeader("X-Request-Id", req.id);
  next();
});

/* ---------- Early utility routes ---------- */
app.use("/api", leadsCheckMobile);

/* ---------- Public health ---------- */
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/api/health", (_req, res) => res.status(200).json({ ok: true, ts: new Date().toISOString() }));
app.head("/api/health", (_req, res) => res.sendStatus(200));
app.head("/", (_req, res) => res.sendStatus(200));
app.get("/", (_req, res) => res.status(200).send("GeniusGrid API OK"));

/* ---------- Session ---------- */
app.use(
  session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    name: "__erp_sid",
    secret: process.env.SESSION_SECRET || "CHANGE_ME",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: Number(process.env.SESSION_TTL_HOURS || 12) * 60 * 60 * 1000,
    },
  })
);

/* ---------- Tenant GUC helper ---------- */
app.use(async (req, _res, next) => {
  try {
    const tid = req.session?.tenantId || req.session?.tenant_id;
    if (tid) {
      await pool.query("SELECT set_config('app.tenant_id', $1, false)", [tid]);
    }
  } catch (e) {
    req.log?.warn({ err: e }, "tenant-scope set_config failed");
  } finally {
    next();
  }
});

/* ---------- Rate limiting ---------- */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT || 900),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

/* ---------- PUBLIC routes (no auth) ---------- */
app.use("/api/ui", uiRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/countries", countriesRouter);
app.use("/api/csrf", csrfRoutes);
app.use("/api/bootstrap", bootstrapRoutes);
app.use("/api/auth", auth);
app.use("/api/auth", authMe);
app.get("/api/leads/ping", (_req, res) => res.json({ ok: true }));

/* ✅ PUBLIC: AI prospect namespace (correct path & order) */
app.use("/api/ai/prospect",requireAuth, aiProspectRoutes);          // -> /api/ai/prospect/ping, /api/ai/prospect/jobs

/* ---------- PROTECTED routes (scoped; no broad '/api' wall) ---------- */
app.use("/api/admin", requireAuth, adminUsers);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/crm", requireAuth, customFieldsRoutes);

/* Leads core + utilities */
app.use("/api/leads", requireAuth, leadsRoutes);
app.use("/api/leads", requireAuth, leadsAiRoutes);
app.use("/api/leads", requireAuth, leadsDupRoutes);
app.use("/api/leads", requireAuth, leadsAssignRoutes);
app.use("/api/leads", requireAuth, leadsMergeRoutes);

/* Imports (scoped) */
app.use("/api/leads/imports", requireAuth, leadsImportsRoutes);

/* Other modules (scoped) */
app.use("/api/leads-module", requireAuth, leadsModule);

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
  logger.info({ port: PORT, deploy_env: isProd ? "prod" : "dev", url: APP_URL }, "API listening");
});
function shutdown(sig) {
  logger.warn({ sig }, "Shutting down...");
  server.close(async () => {
    try { await pool.end(); } catch {}
    logger.warn("Closed HTTP & PG pool. Bye.");
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
