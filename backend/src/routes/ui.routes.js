// backend/src/routes/ui.routes.js
import { Router } from "express";

const router = Router();

// Minimal theme payload your frontend expects.
// Tweak values / read from env as you like.
router.get("/theme", (req, res) => {
  res.json({
    brandName: process.env.APP_BRAND_NAME || "GeniusGrid",
    logoUrl: process.env.APP_LOGO_URL || null,
    primaryColor: process.env.APP_PRIMARY || "#3b82f6",
    darkMode: true,
    version: process.env.APP_VERSION || "v1",
  });
});

export default router;
