import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import { getAdminAuditLogs } from "./audit.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/admin", authorize("ADMIN", "SUPER_ADMIN"), getAdminAuditLogs);

export default router;
