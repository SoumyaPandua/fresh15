
import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import { redisActionRateLimit } from "../../middleware/rateLimit.middleware.js";
import {
  getTemplate,
  preview,
  commit,
  listImports,
  getImport,
  getReport,
  retryFailed,
  overview,
  quality,
} from "./catalog-operations.controller.js";

const router = express.Router();
router.use(authMiddleware);
router.use(authorize("ADMIN", "SUPER_ADMIN"));

router.get("/template.csv", getTemplate);
router.get("/overview", overview);
router.get("/quality", quality);
router.get("/imports", listImports);
router.get("/imports/:id/report.csv", getReport);
router.post("/imports/preview", redisActionRateLimit({ name: "catalog-import-preview", max: 10, windowSeconds: 60 }), express.text({ type: ["text/csv", "text/plain"], limit: "2mb" }), preview);
router.post("/imports", redisActionRateLimit({ name: "catalog-import", max: 3, windowSeconds: 3600 }), express.text({ type: ["text/csv", "text/plain"], limit: "2mb" }), commit);
router.post("/imports/:id/retry-failed", redisActionRateLimit({ name: "catalog-import-retry", max: 5, windowSeconds: 3600 }), retryFailed);
router.get("/imports/:id", getImport);

export default router;
