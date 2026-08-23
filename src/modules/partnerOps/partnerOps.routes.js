
import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import {
  shiftValidation,
  incidentValidation,
  documentValidation,
  pauseValidation,
  reconcileValidation,
  incentiveValidation,
  idValidation,
} from "./partnerOps.validation.js";
import {
  getOverview,
  getQueue,
  getEarnings,
  getCash,
  reconcileCash,
  getShifts,
  createShift,
  cancelShift,
  getDocuments,
  upsertDocument,
  pause,
  resume,
  createIncident,
  getIncidents,
  adminOverview,
  adminIncidents,
  resolveIncident,
  adminShifts,
  adminCash,
  createIncentive,
} from "./partnerOps.controller.js";

const router = express.Router();

router.use(authMiddleware);

/* Partner */
router.get("/overview", authorize("PARTNER"), getOverview);
router.get("/queue", authorize("PARTNER"), getQueue);
router.get("/earnings", authorize("PARTNER"), getEarnings);
router.get("/cash", authorize("PARTNER"), getCash);
router.post("/cash/reconcile", authorize("PARTNER"), reconcileValidation, validateRequest, reconcileCash);

router.get("/shifts", authorize("PARTNER"), getShifts);
router.post("/shifts", authorize("PARTNER"), shiftValidation, validateRequest, createShift);
router.delete("/shifts/:id", authorize("PARTNER"), idValidation, validateRequest, cancelShift);

router.get("/documents", authorize("PARTNER"), getDocuments);
router.put("/documents", authorize("PARTNER"), documentValidation, validateRequest, upsertDocument);

router.post("/pause", authorize("PARTNER"), pauseValidation, validateRequest, pause);
router.post("/resume", authorize("PARTNER"), resume);

router.get("/incidents", authorize("PARTNER"), getIncidents);
router.post("/incidents", authorize("PARTNER"), incidentValidation, validateRequest, createIncident);

/* Platform/admin */
router.get("/admin/overview", authorize("ADMIN", "SUPER_ADMIN"), adminOverview);
router.get("/admin/incidents", authorize("ADMIN", "SUPER_ADMIN"), adminIncidents);
router.patch("/admin/incidents/:id", authorize("ADMIN", "SUPER_ADMIN"), idValidation, resolveIncident);
router.get("/admin/shifts", authorize("ADMIN", "SUPER_ADMIN"), adminShifts);
router.get("/admin/cash", authorize("ADMIN", "SUPER_ADMIN"), adminCash);
router.post("/admin/incentives", authorize("ADMIN", "SUPER_ADMIN"), incentiveValidation, validateRequest, createIncentive);

export default router;
