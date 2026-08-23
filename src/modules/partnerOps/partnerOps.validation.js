
import { body, query, param } from "express-validator";

export const shiftValidation = [
  body("dateKey").matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("dateKey must be YYYY-MM-DD"),
  body("startAt").isISO8601().withMessage("Valid startAt is required"),
  body("endAt").isISO8601().withMessage("Valid endAt is required"),
  body("note").optional().trim().isLength({ max: 300 }).withMessage("Note cannot exceed 300 characters"),
];

export const incidentValidation = [
  body("type")
    .isIn(["SAFETY", "CUSTOMER", "VEHICLE", "PAYMENT", "APP", "ACCIDENT", "OTHER"])
    .withMessage("Invalid incident type"),
  body("severity")
    .optional()
    .isIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    .withMessage("Invalid incident severity"),
  body("description")
    .trim()
    .notEmpty()
    .isLength({ max: 2000 })
    .withMessage("Incident description is required and must be <= 2000 characters"),
  body("deliveryId").optional().isMongoId().withMessage("Invalid deliveryId"),
  body("orderId").optional().isMongoId().withMessage("Invalid orderId"),
  body("latitude").optional().isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
  body("longitude").optional().isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
];

export const documentValidation = [
  body("type")
    .isIn(["DRIVING_LICENSE", "RC", "INSURANCE", "PAN", "OTHER"])
    .withMessage("Invalid document type"),
  body("documentNumber").optional().trim().isLength({ max: 100 }),
  body("expiresAt").optional({ nullable: true }).isISO8601().withMessage("Invalid expiry date"),
  body("status").optional().isIn(["PENDING", "VERIFIED", "REJECTED"]),
  body("fileUrl").optional().isURL().withMessage("fileUrl must be a valid URL"),
  body("notes").optional().trim().isLength({ max: 500 }),
];

export const pauseValidation = [
  body("minutes").optional().isInt({ min: 5, max: 60 }).withMessage("Pause duration must be 5-60 minutes"),
  body("reason").optional().trim().isLength({ max: 200 }).withMessage("Reason cannot exceed 200 characters"),
];

export const reconcileValidation = [
  body("amount").isFloat({ min: 0.01 }).withMessage("Reconciliation amount must be greater than zero"),
  body("note").optional().trim().isLength({ max: 300 }),
];

export const incentiveValidation = [
  body("title").trim().notEmpty().isLength({ max: 120 }),
  body("description").optional().trim().isLength({ max: 500 }),
  body("amount").isFloat({ min: 0 }),
  body("targetDeliveries").isInt({ min: 1 }),
  body("startAt").isISO8601(),
  body("endAt").isISO8601(),
  body("partnerId").optional({ nullable: true }).isMongoId(),
];

export const idValidation = [
  param("id").isMongoId().withMessage("Invalid id"),
];
