import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import {
  createOrderService,
  getMyOrdersService,
  getOrderByIdService,
  getAllOrdersService,
  updateOrderStatusService,
  cancelMyOrderService,
  adminArchiveOrderService,
} from "./order.service.js";

export const getMyOrders = async (req, res) => {
  try { return sendResponse(res, 200, true, "Orders fetched successfully", await getMyOrdersService(req.user._id, req.query)); }
  catch (error) { return sendError(res, error); }
};

export const getOrderById = async (req, res) => {
  try { return sendResponse(res, 200, true, "Order fetched successfully", await getOrderByIdService(req.params.id, req.user._id)); }
  catch (error) { return sendError(res, error); }
};

export const createOrder = async (req, res) => {
  try { return sendResponse(res, 201, true, "Order placed successfully", await createOrderService(req.user._id, req.body)); }
  catch (error) { return sendError(res, error); }
};

export const updateOrderStatus = async (req, res) => {
  try { return sendResponse(res, 200, true, "Order status updated successfully", await updateOrderStatusService(req.params.id, req.user._id, req.body.orderStatus)); }
  catch (error) { return sendError(res, error); }
};

export const cancelMyOrder = async (req, res) => {
  try { return sendResponse(res, 200, true, "Order cancelled successfully", await cancelMyOrderService(req.params.id, req.user._id)); }
  catch (error) { return sendError(res, error); }
};

export const archiveOrder = async (req, res) => {
  try {
    await adminArchiveOrderService(req.params.id, req.user._id);
    return res.status(204).send();
  } catch (error) { return sendError(res, error); }
};

export const getAllOrders = async (req, res) => {
  try { return sendResponse(res, 200, true, "Orders fetched successfully", await getAllOrdersService(req.query)); }
  catch (error) { return sendError(res, error); }
};
