import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import RefundWebhookEvent from "./refund-webhook-event.model.js";
import {
  getMyRefundsService,
  getRefundByIdService,
  getAdminRefundsService,
} from "./refund.service.js";
import {
  createRefundRequestWithConcurrency,
  processRefundWithConcurrency,
  rejectRefundWithConcurrency,
  completeManualRefundWithConcurrency,
  handleRefundWebhookWithConcurrency,
} from "./order-refund-concurrency.service.js";
import { verifyRazorpayWebhookSignature } from "./refund.service.js";

export const createRefundRequest = async (req, res) => {
  try { return sendResponse(res, 201, true, "Refund request created", await createRefundRequestWithConcurrency(req.user._id, req.body)); }
  catch (error) { return sendError(res, error); }
};

export const getMyRefunds = async (req, res) => {
  try { return sendResponse(res, 200, true, "Refunds fetched successfully", await getMyRefundsService(req.user._id)); }
  catch (error) { return sendError(res, error); }
};

export const getMyRefund = async (req, res) => {
  try { return sendResponse(res, 200, true, "Refund fetched successfully", await getRefundByIdService(req.user._id, req.params.refundId)); }
  catch (error) { return sendError(res, error); }
};

export const getAdminRefunds = async (req, res) => {
  try { return sendResponse(res, 200, true, "Refunds fetched successfully", await getAdminRefundsService(req.query)); }
  catch (error) { return sendError(res, error); }
};

export const processRefund = async (req, res) => {
  try { return sendResponse(res, 200, true, "Refund processing started", await processRefundWithConcurrency(req.user._id, req.params.refundId)); }
  catch (error) { return sendError(res, error); }
};

export const rejectRefund = async (req, res) => {
  try { return sendResponse(res, 200, true, "Refund rejected", await rejectRefundWithConcurrency(req.user._id, req.params.refundId, req.body.reason)); }
  catch (error) { return sendError(res, error); }
};

export const completeManualRefund = async (req, res) => {
  try { return sendResponse(res, 200, true, "Manual refund completed", await completeManualRefundWithConcurrency(req.user._id, req.params.refundId, req.body.reference)); }
  catch (error) { return sendError(res, error); }
};

export const razorpayRefundWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!verifyRazorpayWebhookSignature(req.rawBody, signature)) {
      return res.status(401).json({ success: false, message: "Invalid webhook signature", code: "INVALID_WEBHOOK_SIGNATURE", data: null, errors: [] });
    }
    const eventId = String(req.headers["x-razorpay-event-id"] || "").trim();
    if (eventId) {
      try {
        await RefundWebhookEvent.create({
          eventId,
          event: JSON.parse(req.rawBody.toString("utf8"))?.event || "",
        });
      } catch (error) {
        if (error?.code === 11000) {
          return res.status(200).json({ success: true, message: "Webhook already processed", code: "DUPLICATE_WEBHOOK", data: null, errors: [] });
        }
        throw error;
      }
    }
    await handleRefundWebhookWithConcurrency(JSON.parse(req.rawBody.toString("utf8")));
    return res.status(200).json({ success: true, message: "Webhook processed", code: "OK", data: null, errors: [] });
  } catch (error) {
    return sendError(res, error);
  }
};
