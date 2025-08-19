// api/index.js
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { attachTenantGUC } from "./middleware/tenant.js";
import customFieldsRouter from "./routes/customFields.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Attach tenant/user (adapt to your auth/session)
app.use(attachTenantGUC);

// Routes
app.use("/api/custom-fields", customFieldsRouter);

// Health
app.get("/healthz", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on :${port}`));
