import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";

import {
  createAddressValidation,
  updateAddressValidation,
} from "./address.validation.js";

import {
  createAddress,
  deleteAddress,
  getAddressById,
  getAllAddresses,
  setDefaultAddress,
  updateAddress,
} from "./address.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getAllAddresses);

router.get("/:id", getAddressById);

router.post(
  "/",
  createAddressValidation,
  validateRequest,
  createAddress
);

router.put(
  "/:id",
  updateAddressValidation,
  validateRequest,
  updateAddress
);

router.delete("/:id", deleteAddress);

router.patch("/:id/default", setDefaultAddress);

export default router;