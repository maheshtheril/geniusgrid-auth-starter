import express from "express";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import pgSimple from "connect-pg-simple";
import { pool } from "./db/pool.js";

import auth from "./routes/auth.js";
import adminUsers from "./routes/adminUsers.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

const app = express();
const PgStore = pgSimple(session);

const ORIGINS = [
  "http://localhost:5173",
  "https://geniusgrid-web.onrender.com"
];

const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1); // needed if behind a proxy (Render/NGINX)

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// CORS must allow credentials + exact origins
app.use(cors({
  origin: ORIGINS,
  credentials: true
}));

// --- SESSION FIRST ---
app.use(session({
  store: new PgStore({
    pool,
    // optional: create the 'session' table if missing
    createTableIfMissing: true
  }),
  name: "__erp_sid",
  secret: process.env.SESSION_SECRET || "CHANGE_ME",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,                  // false on localhost, true in prod
    maxAge: 1000 * 60 * 60 * 8       // 8 hours
  }
}));

// --- THEN ROUTES ---
app.use("/api/auth", auth);          // login/logout uses session
app.use("/api", dashboardRoutes);    // uses requireAuth -> needs session above
app.use("/api/admin", adminUsers);   // uses requireAuth/permissions -> needs session

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// after other app.use(...) and before 404 handler:
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "GeniusGrid API", time: new Date().toISOString() })
);
app.post("/api/_echo", (req, res) => res.json({ got: req.body })); // debug


// Optional: basic 404 + error handler
app.use((_req, res) => res.status(404).json({ message: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

app.listen(process.env.PORT || 4000, () => console.log("API up"));
