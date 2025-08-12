import { Router } from "express";
const router = Router();

router.get("/theme", (_req, res) => {
  res.json({
    brandName: process.env.APP_BRAND_NAME || "GeniusGrid",
    logoUrl: process.env.APP_LOGO_URL || null,
    primaryColor: process.env.APP_PRIMARY || "#3b82f6",
    darkMode: true,
    version: process.env.APP_VERSION || "v1",
  });
});

export default router;
