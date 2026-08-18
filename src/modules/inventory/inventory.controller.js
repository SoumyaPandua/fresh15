import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";

import {
  createInventoryService,
  deleteInventoryService,
  getAllInventoryService,
  getInventoryByProductService,
  updateInventoryService,
  updateInventoryStockService,
} from "./inventory.service.js";

export const getAllInventory = async (req, res) => {
  try {
    const data = await getAllInventoryService(req.query);

    return sendResponse(res, 200, true, "Inventory fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const getInventoryByProduct = async (req, res) => {
  try {
    const data = await getInventoryByProductService(req.params.productId);

    return sendResponse(res, 200, true, "Inventory fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const createInventory = async (req, res) => {
  try {
    const data = await createInventoryService(req.user._id, req.body);

    return sendResponse(res, 201, true, "Inventory created successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateInventory = async (req, res) => {
  try {
    const data = await updateInventoryService(
      req.params.id,
      req.user._id,
      req.body
    );

    return sendResponse(res, 200, true, "Inventory updated successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateInventoryStock = async (req, res) => {
  try {
    const data = await updateInventoryStockService(
      req.params.id,
      req.user._id,
      req.body.currentStock
    );

    return sendResponse(
      res,
      200,
      true,
      "Stock updated successfully",
      data
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const deleteInventory = async (req, res) => {
  try {
    await deleteInventoryService(req.params.id);

    return sendResponse(
      res,
      200,
      true,
      "Inventory deleted successfully"
    );
  } catch (error) {
    return sendError(res, error);
  }
};