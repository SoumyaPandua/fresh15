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
import { reconcilePendingOnlinePaymentService } from "../payment/payment.service.js";
import { getReorderListService, reorderToCartService } from "./reorder.service.js";

export const getMyOrders = async (req, res) => {
  try { return sendResponse(res, 200, true, "Orders fetched successfully", await getMyOrdersService(req.user._id, req.query)); }
  catch (error) { return sendError(res, error); }
};

export const getReorderList = async (req, res) => {
  try {
    return sendResponse(res, 200, true, "Reorder list fetched successfully", await getReorderListService(req.user._id, req.query));
  } catch (error) {
    return sendError(res, error);
  }
};

export const reorderToCart = async (req, res) => {
  try {
    return sendResponse(res, 200, true, "Items added to cart", await reorderToCartService(req.user._id, req.body));
  } catch (error) {
    return sendError(res, error);
  }
};

export const getOrderById = async (req, res) => {
  try {
    let order = await getOrderByIdService(req.params.id, req.user._id);
    if (order.paymentMethod === "ONLINE" && order.paymentStatus !== "PAID") {
      await reconcilePendingOnlinePaymentService(req.user._id, req.params.id);
      order = await getOrderByIdService(req.params.id, req.user._id);
    }
    return sendResponse(res, 200, true, "Order fetched successfully", order);
  }
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
  try {
    const data = await getAllOrdersService(req.query);
    const orders = Array.isArray(data) ? data : (data?.items ?? []);
    await Promise.all(orders.filter((o) => o.paymentMethod === "ONLINE" && o.paymentStatus !== "PAID").map((o) =>
      reconcilePendingOnlinePaymentService(o.userId?._id ?? o.userId, o._id).catch((error) => console.error("Admin payment reconciliation failed:", error.message))
    ));
    return sendResponse(res, 200, true, "Orders fetched successfully", await getAllOrdersService(req.query));
  }
  catch (error) { return sendError(res, error); }
};
