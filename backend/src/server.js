// src/server.js
import express from "express";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import pgSimple from "connect-pg-simple";
import { pool } from "./db/pool.js";

import authRoutes from "./routes/auth.js";
import leadsRoutes from "./routes/leads.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import adminUsers from "./routes/adminUsers.js";

const app = express();
const PgStore = pgSimple(session);

app.set("trust proxy", 1);

// --- Security / parsers first ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// --- CORS BEFORE routes (with credentials) ---
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://geniusgrid-web.onrender.com",
      "https://geniusgrid-landing.onrender.com",
    ],
    credentials: true,
  })
);

// --- Session BEFORE routes ---
app.use(
  session({
    store: new PgStore({ pool }),
    name: "__erp_sid",
    secret: process.env.SESSION_SECRET || "CHANGE_ME",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,        // required for SameSite=None over HTTPS
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 8, // 8h
    },
  })
);

// --- Now mount routes (order doesn’t matter after the above) ---
app.use("/api/auth", authRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", leadsRoutes);       // contains GET /api/leads
app.use("/api/admin", adminUsers);

app.get("/api/health", (req, res) => res.json({ ok: true }));

export default app;
