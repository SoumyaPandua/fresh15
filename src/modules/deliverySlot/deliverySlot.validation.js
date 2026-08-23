import { body, param, query } from "express-validator";

const minutes = (field) => body(field).isInt({ min: 0, max: 1440 }).withMessage(`${field} must be between 0 and 1440`);
const positive = (field) => body(field).isInt({ min: 1, max: 100000 }).withMessage(`${field} must be a positive integer`);

export const getAvailableSlotsValidation = [
  param("addressId").isMongoId().withMessage("Invalid address ID"),
];

export const serviceabilityValidation = [
  query("pincode").optional().trim().matches(/^\d{6}$/).withMessage("Pincode must be 6 digits"),
  query("latitude").optional().isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
  query("longitude").optional().isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
];

export const createSlotValidation = [
  body("label").trim().notEmpty().isLength({ max: 80 }),
  body("type").optional().isIn(["ASAP", "FIXED"]),
  minutes("fromMinutes"),
  body("toMinutes").isInt({ min: 1, max: 1440 }),
  body("leadTimeMinutes").optional().isInt({ min: 0, max: 1440 }),
  body("cutoffMinutesBeforeStart").optional().isInt({ min: 0, max: 1440 }),
  positive("capacity"),
  body("active").optional().isBoolean(),
  body("sortOrder").optional().isInt({ min: 0 }),
];

export const updateSlotValidation = [
  param("id").isMongoId(),
  body("label").optional().trim().notEmpty().isLength({ max: 80 }),
  body("type").optional().isIn(["ASAP", "FIXED"]),
  body("fromMinutes").optional().isInt({ min: 0, max: 1440 }),
  body("toMinutes").optional().isInt({ min: 1, max: 1440 }),
  body("leadTimeMinutes").optional().isInt({ min: 0, max: 1440 }),
  body("cutoffMinutesBeforeStart").optional().isInt({ min: 0, max: 1440 }),
  body("capacity").optional().isInt({ min: 1, max: 100000 }),
  body("active").optional().isBoolean(),
  body("sortOrder").optional().isInt({ min: 0 }),
];

export const idValidation = [param("id").isMongoId()];
export const zoneValidation = [
  body("name").optional().trim().notEmpty().isLength({ max: 100 }),
  body("pincodes").optional().isArray({ max: 500 }),
  body("pincodes.*").optional().trim().matches(/^\d{5,6}$/),
  body("latitude").optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body("longitude").optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body("serviceRadiusKm").optional().isFloat({ min: 0, max: 100 }),
  body("fee").optional().isFloat({ min: 0 }),
  body("minOrder").optional().isFloat({ min: 0 }),
  body("maxConcurrentOrders").optional().isInt({ min: 1 }),
  body("travelMinutes").optional().isInt({ min: 0 }),
  body("workloadDelayMinutes").optional().isInt({ min: 0, max: 60 }),
  body("active").optional().isBoolean(),
];
export const storeValidation = [
  body("name").optional().trim().notEmpty().isLength({ max: 120 }),
  body("code").optional().trim().notEmpty().isLength({ max: 30 }),
  body("latitude").optional().isFloat({ min: -90, max: 90 }),
  body("longitude").optional().isFloat({ min: -180, max: 180 }),
  body("serviceRadiusKm").optional().isFloat({ min: 0 }),
  body("maxConcurrentOrders").optional().isInt({ min: 1 }),
  body("prepMinutes").optional().isInt({ min: 0 }),
  body("active").optional().isBoolean(),
];
