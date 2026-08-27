import { body } from "express-validator";

export const registerValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

export const partnerRegisterValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("phone").trim().matches(/^[0-9+() -]{10,20}$/).withMessage("Valid phone number is required"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("vehicleType").isIn(["BIKE", "SCOOTER", "CAR", "EV_BIKE", "OTHER"]).withMessage("Valid vehicle type is required"),
  body("vehicleRegistrationNumber").trim().matches(/^[A-Za-z0-9 -]{6,20}$/).withMessage("Valid vehicle registration number is required"),
  body("vehicleMakeModel").optional({ values: "falsy" }).trim().isLength({ max: 100 }).withMessage("Vehicle make/model is too long"),
];
