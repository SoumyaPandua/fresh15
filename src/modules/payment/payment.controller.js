import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import {
  createPaymentOrderService,
  getPaymentByOrderService,
  paymentFailureService,
  verifyPaymentService,
  reconcilePendingOnlinePaymentService,
  getCodReportService,
  getRazorpayReportService,
} from "./payment.service.js";

export const createPaymentOrder = async (req, res) => {
  try { return sendResponse(res, 201, true, "Payment order created successfully", await createPaymentOrderService(req.user._id, req.body.orderId)); }
  catch (error) { return sendError(res, error); }
};

export const verifyPayment = async (req, res) => {
  try { return sendResponse(res, 200, true, "Payment verified successfully", await verifyPaymentService(req.user._id, req.body)); }
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
  } catch (error) { return sendError(res, error); }
};
