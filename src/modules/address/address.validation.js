import { body } from "express-validator";

export const createAddressValidation = [
  body("fullName").notEmpty().withMessage("Full name is required"),

  body("phone").notEmpty().withMessage("Phone is required"),

  body("addressLine1").notEmpty().withMessage("Address Line 1 is required"),

  body("city").notEmpty().withMessage("City is required"),

  body("state").notEmpty().withMessage("State is required"),

  body("country").optional(),

  body("pincode").notEmpty().withMessage("Pincode is required"),

  body("latitude")
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90"),

  body("longitude")
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180"),

  body().custom((body) => {
    const latitude = body.latitude;
    const longitude = body.longitude;

    const hasLatitude =
      latitude !== undefined &&
      latitude !== null &&
      latitude !== "";

    const hasLongitude =
      longitude !== undefined &&
      longitude !== null &&
      longitude !== "";

    if (hasLatitude !== hasLongitude) {
      throw new Error(
        "Latitude and longitude must be provided together"
      );
    }

    if (
      hasLatitude &&
      hasLongitude &&
      Number(latitude) === 0 &&
      Number(longitude) === 0
    ) {
      throw new Error(
        "Address coordinates cannot be 0,0"
      );
    }

    return true;
  }),

  body("addressType")
    .optional()
    .isIn(["HOME", "WORK", "OTHER"])
    .withMessage("Invalid address type"),
];

export const updateAddressValidation = createAddressValidation;