import Payment from "./payment.model.js";
import Order from "../order/order.model.js";
import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import { verifyPaymentAuthoritatively } from "./payment-authoritative.service.js";
import {
  createPaymentOrderService,
  getPaymentByOrderService,
  paymentFailureService,
  reconcilePendingOnlinePaymentService,
  getCodReportService,
  getRazorpayReportService,
} from "./payment.service.js";

export const createPaymentOrder = async (req, res) => {
  try {
    const orderId = req.body.orderId;
    const order = await Order.findOne({ _id: orderId, userId: req.user._id, isDeleted: false });
    if (!order) return sendResponse(res, 404, false, "Order not found", null);
    const existing = await Payment.findOne({ orderId: order._id, userId: req.user._id });
    const expiresAt = existing?.expiresAt ? new Date(existing.expiresAt).getTime() : 0;
    const reusable = existing?.razorpayOrderId && ["CREATED", "PENDING"].includes(existing.status) && (!expiresAt || expiresAt > Date.now()) && Number(existing.amount) === Number(order.grandTotal);
    if (reusable) {
      return sendResponse(res, 200, true, "Existing payment order returned", {
        key: process.env.RAZORPAY_KEY_ID,
        orderId: existing.razorpayOrderId,
        amount: Math.round(Number(existing.amount) * 100),
        currency: existing.currency || "INR",
        receipt: order.orderNumber,
      });
    }
    return sendResponse(res, 201, true, "Payment order created successfully", await createPaymentOrderService(req.user._id, orderId));
  } catch (error) {
    return sendError(res, error);
  }
};

export const verifyPayment = async (req, res) => {
  try { return sendResponse(res, 200, true, "Payment verified successfully", await verifyPaymentAuthoritatively(req.user._id, req.body)); }
  catch (error) { return sendError(res, error); }
};

export const paymentFailure = async (req, res) => {
  try { return sendResponse(res, 200, true, "Payment failure recorded successfully", await paymentFailureService(req.user._id, req.body)); }
  catch (error) { return sendError(res, error); }
};

export const getPaymentByOrder = async (req, res) => {
  try { return sendResponse(res, 200, true, "Payment fetched successfully", await getPaymentByOrderService(req.params.orderId, req.user._id)); }
  catch (error) { return sendError(res, error); }
};

export const getCodReport = async (req, res) => {
  try { return sendResponse(res, 200, true, "COD report fetched successfully", await getCodReportService(req.query)); }
  catch (error) { return sendError(res, error); }
};

export const getRazorpayReport = async (req, res) => {
  try { return sendResponse(res, 200, true, "Razorpay report fetched successfully", await getRazorpayReportService(req.query)); }
  catch (error) { return sendError(res, error); }
};

export const reconcilePayment = async (req, res) => {
  try {
    const data = await reconcilePendingOnlinePaymentService(req.user._id, req.body.orderId);
    return sendResponse(res, 200, true, data.paymentStatus === "PAID" ? "Payment recovered successfully" : "Payment status checked", data);
  } catch (error) {
    return sendError(res, error);
  }
};
