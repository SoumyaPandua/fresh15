import mongoose from "mongoose";
import AppError from "./AppError.js";

const rules = [
  [/^order not found$/i, [404, "ORDER_NOT_FOUND"]],
  [/^address not found$/i, [404, "ADDRESS_NOT_FOUND"]],
  [/^payment not found$/i, [404, "PAYMENT_NOT_FOUND"]],
  [/^review not found$/i, [404, "REVIEW_NOT_FOUND"]],
  [/^support ticket not found$/i, [404, "SUPPORT_TICKET_NOT_FOUND"]],
  [/^delivery not found$/i, [404, "DELIVERY_NOT_FOUND"]],
  [/^notification not found$/i, [404, "NOTIFICATION_NOT_FOUND"]],
  [/^product not found/i, [404, "PRODUCT_NOT_FOUND"]],
  [/^category not found$/i, [404, "CATEGORY_NOT_FOUND"]],
  [/^coupon not found$/i, [404, "COUPON_NOT_FOUND"]],
  [/^inventory not found$/i, [404, "INVENTORY_NOT_FOUND"]],
  [/^user not found$/i, [404, "USER_NOT_FOUND"]],
  [/^offer not found$/i, [404, "OFFER_NOT_FOUND"]],
  [/^banner not found$/i, [404, "BANNER_NOT_FOUND"]],
  [/^wishlist not found$/i, [404, "WISHLIST_NOT_FOUND"]],
  [/already (paid|completed|reviewed)/i, [409, "RESOURCE_ALREADY_EXISTS"]],
  [/already (exists|registered|in use)/i, [409, "RESOURCE_ALREADY_EXISTS"]],
  [/duplicate/i, [409, "RESOURCE_ALREADY_EXISTS"]],
  [/insufficient stock|out of stock|cart is empty/i, [409, "ORDER_CONFLICT"]],
  [/state transition|not allowed|usage limit exceeded|coupon.*conflict/i, [409, "STATE_CONFLICT"]],
  [/not.*purchased|not a verified buyer/i, [403, "FORBIDDEN"]],
  [/access denied|unauthorized portal|account is disabled|not assigned to you/i, [403, "FORBIDDEN"]],
  [/invalid email or password/i, [401, "INVALID_CREDENTIALS"]],
  [/invalid token|unauthorized/i, [401, "UNAUTHORIZED"]],
  [/otp expired|invalid otp|expired reset token|invalid or expired/i, [422, "INVALID_OTP_OR_TOKEN"]],
  [/invalid payment signature/i, [400, "PAYMENT_SIGNATURE_INVALID"]],
  [/required|invalid .*id|invalid .*status|cannot be greater|at least one/i, [422, "VALIDATION_ERROR"]],
  [/coupon is inactive|coupon is not active|coupon has expired|minimum order amount/i, [422, "COUPON_INVALID"]],
];

export const normalizeError = (error) => {
  if (error instanceof AppError) return error;

  if (error instanceof mongoose.Error.CastError) {
    return new AppError(400, "INVALID_ID", "Invalid resource identifier", [
      { path: error.path, value: error.value },
    ]);
  }

  if (error?.name === "ValidationError") {
    return new AppError(
      422,
      "VALIDATION_ERROR",
      "Validation failed",
      Object.values(error.errors || {}).map((item) => ({ path: item.path, message: item.message })),
    );
  }

  if (error?.code === 11000) {
    return new AppError(409, "RESOURCE_ALREADY_EXISTS", "A resource with the same unique value already exists", error.keyValue);
  }

  const message = error?.message || "Internal server error";
  const rule = rules.find(([pattern]) => pattern.test(message));
  if (rule) {
    const [statusCode, code] = rule[1];
    return new AppError(statusCode, code, message);
  }

  return new AppError(
    500,
    "INTERNAL_SERVER_ERROR",
    "Internal server error",
    process.env.NODE_ENV === "production" ? [] : [message],
  );
};

export const sendError = (res, error) => {
  const normalized = normalizeError(error);
  const requestId = res.req?.get?.("x-request-id") || null;

  return res.status(normalized.statusCode).json({
    success: false,
    message: normalized.message,
    code: normalized.code,
    requestId,
    data: null,
    errors: normalized.details || [],
  });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  return sendError(res, error);
};
