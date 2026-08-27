import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import { uploadMultipleImages } from "../../middleware/upload.middleware.js";
import { createSupportValidation, updateSupportStatusValidation } from "./support.validation.js";
import {
  createSupportTicket,
  addSupportMessage,
  deleteMySupportTicket,
  deleteAdminSupportTicket,
  getAllSupportTickets,
  getMySupportTickets,
  getSupportTicketById,
  updateSupportTicketStatus,
} from "./support.controller.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", authorize("ADMIN", "SUPER_ADMIN"), getAllSupportTickets);
router.get("/my-tickets", authorize("CUSTOMER"), getMySupportTickets);
router.get("/:id", getSupportTicketById);
router.post("/", authorize("CUSTOMER"), uploadMultipleImages, createSupportValidation, validateRequest, createSupportTicket);
router.post("/:id/messages", addSupportMessage);
router.patch("/:id/status", authorize("ADMIN", "SUPER_ADMIN"), updateSupportStatusValidation, validateRequest, updateSupportTicketStatus);
router.delete("/:id", authorize("CUSTOMER"), deleteMySupportTicket);
router.delete("/admin/:id", authorize("ADMIN", "SUPER_ADMIN"), deleteAdminSupportTicket);

export default router;
