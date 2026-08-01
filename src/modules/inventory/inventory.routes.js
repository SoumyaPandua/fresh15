import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";

import {
  createInventoryValidation,
  updateInventoryValidation,
  updateStockValidation,
} from "./inventory.validation.js";

import {
  createInventory,
  deleteInventory,
  getAllInventory,
  getInventoryByProduct,
  updateInventory,
  updateInventoryStock,
} from "./inventory.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getAllInventory);

router.get("/:productId", getInventoryByProduct);

router.post(
  "/",
  createInventoryValidation,
  validateRequest,
  createInventory
);

router.put(
  "/:id",
  updateInventoryValidation,
  validateRequest,
  updateInventory
);

router.patch(
  "/:id/stock",
  updateStockValidation,
  validateRequest,
  updateInventoryStock
);

router.delete("/:id", deleteInventory);

export default router;