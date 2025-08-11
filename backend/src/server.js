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
import leadsRoutes from "./routes/leads.routes.js";
import leadsModule from "./routes/leadsModule.routes.js";

const app = express();
const PgStore = pgSimple(session);
const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 4000;

const ORIGINS = ["http://localhost:5173", "https://geniusgrid-web.onrender.com"];

app.set("trust proxy", 1);

app.use(
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })
);

app.use(express.json({ limit: "1mb" }));

app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log('> ', req.method, req.originalUrl);
    console.log('  cookie header:', req.headers.cookie ? req.headers.cookie.slice(0, 160) : '(none)');
    console.log('  sessionID:', req.sessionID);
    console.log('  session keys:', Object.keys(req.session || {}));
  }
  next();
});
// ✅ CORS FIRST
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
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
app.options("*", cors({ origin: ORIGINS, credentials: true }));

// ✅ SESSION SECOND
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
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

// (optional) tenant scope…
app.use(async (req, _res, next) => {
  try {
    const tid = req.session?.tenantId || req.session?.tenant_id;
    if (tid) {
      await pool.query("SELECT set_config('app.tenant_id', $1, true)", [tid]);
    }
  } catch {}
  next();
});

/* ---------- NOW mount routes ---------- */
app.use("/api/auth", auth);
app.use("/api/auth", authMe);
app.use("/api", dashboardRoutes);
app.use("/api/admin", adminUsers);
app.use("/api/csrf", csrfRoutes);
app.use("/api/bootstrap", bootstrapRoutes);
app.use("/api", healthRoutes);

// ✅ These two must be DOWN HERE (after CORS + session)
app.use("/api/leads", leadsRoutes);
app.use("/api", leadsModule);

app.get("/", (_req, res) => res.status(200).send("GeniusGrid API OK"));
app.use((_req, res) => res.status(404).json({ message: "Not Found" }));
app.use((err, _req, res, _next) => res.status(500).json({ message: "Server error" }));
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
