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
import rateLimit from "express-rate-limit";
import customFieldsRoutes from "./routes/customFields.routes.js";
import aiLeadsRoutes from "./routes/aiLeads.routes.js";
import leadsCheckMobile from "./routes/leads.checkMobile.js";
import leadsImportRoutes from "./routes/leadsImport.routes.js";

import leadsAiRoutes from "./routes/leads.ai.routes.js";
import leadsDupRoutes from "./routes/leads.duplicates.routes.js";
import leadsAssignRoutes from "./routes/leads.assign.routes.js";
import leadsMergeRoutes from "./routes/leads.merge.routes.js";
import adminCronRoutes from "./routes/admin.cron.routes.js";
import aiProspectRoutes from "./routes/aiProspect.routes.js";
  
import aiProspectRouter from "./routes/aiProspect.js";
import leadsImportsRouter from "./routes/leadsImports.js";
// NOTE: we won't import the mock router file; we inline the mock handler below.
// import mockAIProspect from "./routes/mock-ai-prospect.js";

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

// ---------------- INLINE PUBLIC MOCK (mounted BEFORE ANY /api middleware) ----------------
if (process.env.USE_MOCK_AI === "1") {
  app.post("/api/ai/prospect/jobs", (req, res) => {
    console.log("[MOCK] HIT /api/ai/prospect/jobs");
    const body = req.body || {};
    const prompt = String(body.prompt ?? "");
    const n = Math.max(1, Math.min(parseInt(body.count ?? 10, 10) || 10, 200));
    const filters = body.filters || {};

    const items = Array.from({ length: n }, (_, i) => ({
      id: randomUUID(),
      name: `Mock Lead ${i + 1}`,
      company_name: `Mock Company ${((i % 10) + 1)}`,
      email: `lead${i + 1}@example.com`,
      phone: `+1-555-000-${1000 + i}`,
      status: "new",
      stage: "Prospect",
      owner_name: "AI Bot",
      score: Math.floor(Math.random() * 100),
      created_at: new Date().toISOString(),
      _prompt: prompt,
      _filters: filters,
    }));

    return res.status(200).json({
      ok: true,
      jobId: randomUUID(),
      status: "completed",
      items,
      total: items.length,
    });
  });

  console.log("[MOCK] Public inline /api/ai/prospect/jobs is ENABLED");
}

// FIRST /api middleware after the mock
app.use("/api", leadsCheckMobile);

// ---------------- CORS (MUST be before any routes that need it) ----------------
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
// helps caches/proxies return the right variant
app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});
app.options("*", cors({ origin: ORIGINS, credentials: true }));

// Attach response headers (versioning & request id surfaced)
app.use((req, res, next) => {
  res.setHeader("X-Version", process.env.APP_VERSION || "v1");
  res.setHeader("X-Request-Id", req.id);
  next();
});

// ---------------- PUBLIC HEALTH (no auth, no rate-limit) ----------------
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});
app.head("/api/health", (_req, res) => res.sendStatus(200)); // Render sometimes probes HEAD
app.head("/", (_req, res) => res.sendStatus(200));
app.get("/", (_req, res) => res.status(200).send("GeniusGrid API OK"));

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

// ---------------- PUBLIC routes (after CORS; before 404) ----------------
app.use("/api/ui", uiRoutes);                 // <-- fixes /api/ui/theme 404
app.use("/api/meta", metaRoutes);
app.use("/api/countries", countriesRouter);   // CORS now applies ✅
app.use("/api/csrf", csrfRoutes);
app.use("/api/bootstrap", bootstrapRoutes);
app.use("/api/auth", auth);
app.use("/api/auth", authMe);                 // /api/auth/me (reads session if exists)
app.get("/api/leads/ping", (_req, res) => res.json({ ok: true }));
app.use("/api/crm", /* requireAuth, */ customFieldsRoutes); // CORS applies ✅
app.use("/api", requireAuth, leadsAiRoutes);

// ---------------- PROTECTED routes ----------------
app.use("/api/admin", requireAuth, adminUsers);
app.use("/api", requireAuth, dashboardRoutes);
app.use("/api/leads", requireAuth, leadsRoutes);
app.use("/api/leads", requireAuth, leadsAiRoutes);  
app.use("/api/leads", requireAuth, leadsDupRoutes);
app.use("/api/leads", requireAuth, leadsAssignRoutes);
app.use("/api", requireAuth, leadsModule);
app.use("/api", aiLeadsRoutes);
app.use("/api/leads", requireAuth, leadsMergeRoutes);
app.use("/api/admin/cron", adminCronRoutes);
app.use("/api/leads", requireAuth, leadsImportRoutes);
app.use("/api", requireAuth, leadsImportRoutes);
app.use("/api", aiProspectRoutes);    // AI prospecting endpoints
app.use("/api", aiProspectRouter);
app.use("/api", leadsImportsRouter);

// (Removed the previous "mockAIProspect" mount at the bottom to prevent shadowing)

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
