import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import {
  listPartnerApplications,
  approvePartnerApplication,
  rejectPartnerApplication,
} from "./partnerApplication.controller.js";

const router = express.Router();
router.use(authMiddleware, authorize("ADMIN", "SUPER_ADMIN"));
router.get("/", listPartnerApplications);
router.patch("/:id/approve", approvePartnerApplication);
router.patch("/:id/reject", rejectPartnerApplication);
export default router;
