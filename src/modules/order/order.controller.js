import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import { getMyOrdersService, getOrderByIdService, updateOrderStatusService, getAllOrdersService, cancelMyOrderService, adminArchiveOrderService, getReorderListService, reorderToCartService } from "./order.service.js";
import { createOrderTransactionalService } from "./checkout.service.js";

export const createOrder = async (req, res) => {
  try {
    const idempotencyKey = String(req.get("Idempotency-Key") || "").trim();
    const order = await createOrderTransactionalService(req.user._id, req.body, idempotencyKey);
    const reused = Boolean(idempotencyKey && order.checkoutIdempotencyKey === idempotencyKey);
    return sendResponse(res, reused ? 200 : 201, true, reused ? "Existing order returned" : "Order created successfully", order);
  } catch (error) {
    return sendError(res, error);
  }
};

export const getMyOrders = async (req, res) => {
  try { return sendResponse(res, 200, true, "Orders fetched successfully", await getMyOrdersService(req.user._id, req.query)); }
  catch (error) { return sendError(res, error); }
};

export const getOrderById = async (req, res) => {
  try { return sendResponse(res, 200, true, "Order fetched successfully", await getOrderByIdService(req.params.id, req.user._id)); }
  catch (error) { return sendError(res, error); }
};

export const updateOrderStatus = async (req, res) => {
  try { return sendResponse(res, 200, true, "Order updated successfully", await updateOrderStatusService(req.params.id, req.user._id, req.body.orderStatus)); }
  catch (error) { return sendError(res, error); }
};

export const getAllOrders = async (req, res) => {
  try { return sendResponse(res, 200, true, "Orders fetched successfully", await getAllOrdersService(req.query)); }
  catch (error) { return sendError(res, error); }
};

export const cancelMyOrder = async (req, res) => {
  try { return sendResponse(res, 200, true, "Order cancelled successfully", await cancelMyOrderService(req.params.id, req.user._id)); }
  catch (error) { return sendError(res, error); }
};

export const archiveOrder = async (req, res) => {
  try { return sendResponse(res, 200, true, "Order archived successfully", await adminArchiveOrderService(req.params.id, req.user._id)); }
  catch (error) { return sendError(res, error); }
};

export const getReorderList = async (req, res) => {
  try { return sendResponse(res, 200, true, "Reorder list fetched successfully", await getReorderListService(req.user._id, req.query)); }
  catch (error) { return sendError(res, error); }
};

export const reorderToCart = async (req, res) => {
  try { return sendResponse(res, 200, true, "Items added to cart", await reorderToCartService(req.user._id, req.body)); }
  catch (error) { return sendError(res, error); }
};
