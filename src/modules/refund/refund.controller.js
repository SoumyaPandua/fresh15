import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import {
  createRefundRequestService,
  getMyRefundsService,
  getRefundByIdService,
  getAdminRefundsService,
  processRefundService,
  rejectRefundService,
  completeManualRefundService,
  handleRazorpayRefundWebhookService,
  verifyRazorpayWebhookSignature,
} from "./refund.service.js";

export const createRefundRequest = async (req, res) => {
  try {
    const data = await createRefundRequestService(req.user._id, req.body);
    return sendResponse(res, 201, true, "Refund request created", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const getMyRefunds = async (req, res) => {
  try {
    const data = await getMyRefundsService(req.user._id);
    return sendResponse(res, 200, true, "Refunds fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const getMyRefund = async (req, res) => {
  try {
    const data = await getRefundByIdService(req.user._id, req.params.refundId);
    return sendResponse(res, 200, true, "Refund fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const getAdminRefunds = async (req, res) => {
  try {
    const data = await getAdminRefundsService(req.query);
    return sendResponse(res, 200, true, "Refunds fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const processRefund = async (req, res) => {
  try {
    const data = await processRefundService(req.user._id, req.params.refundId);
    return sendResponse(res, 200, true, "Refund processing started", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const rejectRefund = async (req, res) => {
  try {
    const data = await rejectRefundService(
      req.user._id,
      req.params.refundId,
      req.body.reason
    );
    return sendResponse(res, 200, true, "Refund rejected", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const completeManualRefund = async (req, res) => {
  try {
    const data = await completeManualRefundService(
      req.user._id,
      req.params.refundId,
      req.body.reference
    );
    return sendResponse(res, 200, true, "Manual refund completed", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const razorpayRefundWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.rawBody;

    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature",
        code: "INVALID_WEBHOOK_SIGNATURE",
        data: null,
        errors: [],
      });
    }

    await handleRazorpayRefundWebhookService(
      JSON.parse(rawBody.toString("utf8"))
    );

    return res.status(200).json({
      success: true,
      message: "Webhook processed",
      code: "OK",
      data: null,
      errors: [],
    });
  } catch (error) {
    return sendError(res, error);
  }
};
