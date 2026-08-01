import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import upload from "../../middleware/upload.middleware.js";

import {
  createSupportValidation,
  updateSupportStatusValidation,
} from "./support.validation.js";

import {
  createSupportTicket,
  deleteSupportTicket,
  getAllSupportTickets,
  getMySupportTickets,
  getSupportTicketById,
  updateSupportTicketStatus,
} from "./support.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/",
  authorize("ADMIN"),
  getAllSupportTickets
);

router.get(
  "/my-tickets",
  authorize("CUSTOMER"),
  getMySupportTickets
);

router.get(
  "/:id",
  getSupportTicketById
);

router.post(
  "/",
  authorize("CUSTOMER"),
  upload.array("attachments", 5),
  createSupportValidation,
  validateRequest,
  createSupportTicket
);

router.patch(
  "/:id/status",
  authorize("ADMIN"),
  updateSupportStatusValidation,
  validateRequest,
  updateSupportTicketStatus
);

router.delete(
  "/:id",
  authorize("ADMIN", "CUSTOMER"),
  deleteSupportTicket
);

export default router;