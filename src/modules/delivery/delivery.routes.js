import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import { uploadSingleImage } from "../../middleware/upload.middleware.js";
import {
  assignRiderValidation,
  createDeliveryValidation,
  updateDeliveryStatusValidation,
  verifyDeliveryOtpValidation,
  uploadDeliveryProofValidation,
  failDeliveryValidation,
} from "./delivery.validation.js";
import {
  assignRider,
  collectCodPayment,
  createDelivery,
  deleteDelivery,
  getAllDeliveries,
  getAvailableRiders,
  getDeliveryById,
  getMyActiveDelivery,
  getMyDeliveries,
  updateDeliveryStatus,
  getCustomerDeliveryByOrder,
  getDeliveryRoute,
  getCustomerDeliveryOtp,
  verifyDeliveryOtp,
  customerConfirmDelivery,
  uploadDeliveryProof,
  failDelivery,
} from "./delivery.controller.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/my/active", authorize("PARTNER"), getMyActiveDelivery);
router.get("/my", authorize("PARTNER"), getMyDeliveries);

router.get("/", authorize("ADMIN", "SUPER_ADMIN"), getAllDeliveries);
router.get("/available-riders", authorize("ADMIN", "SUPER_ADMIN"), getAvailableRiders);

router.post("/", authorize("ADMIN", "SUPER_ADMIN"), createDeliveryValidation, validateRequest, createDelivery);
router.patch("/:id/assign", authorize("ADMIN", "SUPER_ADMIN"), assignRiderValidation, validateRequest, assignRider);

router.post("/:id/cod-payment", authorize("PARTNER"), collectCodPayment);

router.get("/order/:orderId/otp", authorize("CUSTOMER"), getCustomerDeliveryOtp);
router.post("/:id/verify-otp", authorize("PARTNER"), verifyDeliveryOtpValidation, validateRequest, verifyDeliveryOtp);
router.post("/:id/customer-confirm", authorize("CUSTOMER"), customerConfirmDelivery);
router.post("/:id/proof", authorize("PARTNER"), uploadSingleImage, uploadDeliveryProofValidation, validateRequest, uploadDeliveryProof);
router.post("/:id/fail", authorize("PARTNER"), failDeliveryValidation, validateRequest, failDelivery);

router.patch("/:id/status", authorize("ADMIN", "SUPER_ADMIN", "PARTNER"), updateDeliveryStatusValidation, validateRequest, updateDeliveryStatus);

router.get("/order/:orderId", authorize("CUSTOMER"), getCustomerDeliveryByOrder);
router.get("/:id/route", authorize("ADMIN", "SUPER_ADMIN", "PARTNER", "CUSTOMER"), getDeliveryRoute);
router.get("/:id", authorize("ADMIN", "SUPER_ADMIN", "PARTNER"), getDeliveryById);
router.delete("/:id", authorize("ADMIN", "SUPER_ADMIN"), deleteDelivery);

export default router;
