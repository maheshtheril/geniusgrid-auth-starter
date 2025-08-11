// src/server.js
import express from "express";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import pgSimple from "connect-pg-simple";
import { pool } from "./db/pool.js";

import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import leadsRoutes from "./routes/leads.routes.js";
import adminUsers from "./routes/adminUsers.js";

const app = express();
const PgStore = pgSimple(session);

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://geniusgrid-web.onrender.com",
    "https://geniusgrid-landing.onrender.com",
  ],
  credentials: true,
}));

app.use(session({
  store: new PgStore({ pool, tableName: "session", createTableIfMissing: true }),
  name: "__erp_sid",
  secret: process.env.SESSION_SECRET || "CHANGE_ME",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, sameSite: "none", maxAge: 1000*60*60*8 },
}));

// Mount routes AFTER CORS + session
app.use("/api/auth", authRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", leadsRoutes);
app.use("/api/admin", adminUsers);

// (optional) quick health
app.get("/api/health", (_,res)=>res.json({ok:true}));
