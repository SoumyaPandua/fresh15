import sendResponse from "../../utils/sendResponse.js";

import {
  createPaymentOrderService,
  getPaymentByOrderService,
  paymentFailureService,
  verifyPaymentService,
  getCodReportService,
  getRazorpayReportService
} from "./payment.service.js";

export const createPaymentOrder = async (
  req,
  res
) => {
  try {
    const data = await createPaymentOrderService(
      req.user._id,
      req.body.orderId
    );

    return sendResponse(
      res,
      201,
      true,
      "Payment order created successfully",
      data
    );
  } catch (error) {
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
  }
};

export const verifyPayment = async (
  req,
  res
) => {
  try {
    const data = await verifyPaymentService(
      req.user._id,
      req.body
    );

    return sendResponse(
      res,
      200,
      true,
      "Payment verified successfully",
      data
    );
  } catch (error) {
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
  }
};

export const paymentFailure = async (
  req,
  res
) => {
  try {
    const data = await paymentFailureService(
      req.user._id,
      req.body
    );

    return sendResponse(
      res,
      200,
      true,
      "Payment failure recorded successfully",
      data
    );
  } catch (error) {
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
  }
};

export const getPaymentByOrder = async (
  req,
  res
) => {
  try {
    const data =
      await getPaymentByOrderService(
        req.params.orderId,
        req.user._id
      );

    return sendResponse(
      res,
      200,
      true,
      "Payment fetched successfully",
      data
    );
  } catch (error) {
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
  }
};

export const getCodReport = async (req, res) => {
  try {
    const data = await getCodReportService(req.query);
    return sendResponse(res, 200, true, "COD report fetched successfully", data);
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

export const getRazorpayReport = async (req, res) => {
  try {
    const data = await getRazorpayReportService(req.query);
    return sendResponse(res, 200, true, "Razorpay report fetched successfully", data);
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};