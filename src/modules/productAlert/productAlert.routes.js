import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import {
  productIdParamValidation,
  upsertProductAlertValidation,
} from "./productAlert.validation.js";
import {
  deleteMyProductAlert,
  getMyProductAlertForProduct,
  getMyProductAlerts,
  upsertMyProductAlert,
  getAdminProductAlerts,
  getAdminProductAlertSummary,
} from "./productAlert.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/admin/summary",
  authorize("ADMIN", "SUPER_ADMIN"),
  getAdminProductAlertSummary
);

router.get(
  "/admin",
  authorize("ADMIN", "SUPER_ADMIN"),
  getAdminProductAlerts
);

router.get("/", getMyProductAlerts);

router.get(
  "/product/:productId",
  productIdParamValidation,
  validateRequest,
  getMyProductAlertForProduct
);

router.put(
  "/product/:productId",
  upsertProductAlertValidation,
  validateRequest,
  upsertMyProductAlert
);

router.delete(
  "/product/:productId",
  productIdParamValidation,
  validateRequest,
  deleteMyProductAlert
);

export default router;
