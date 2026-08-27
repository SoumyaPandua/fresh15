import { validationResult } from "express-validator";
import {
  registerService,
  registerPartnerService,
  verifyOtpService,
  loginService,
  resendOtpService,
  forgotPasswordService,
  resetPasswordService,
} from "./auth.service.js";
import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import { writeAuditLog } from "../audit/audit.service.js";

export const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      void writeAuditLog({ action: "REGISTER_VALIDATION_FAILED", resourceType: "User", details: { email: req.body?.email || null }, outcome: "FAILURE", statusCode: 422 });
      return sendResponse(res, 422, false, "Validation failed", null, "VALIDATION_ERROR", errors.array());
    }
    const user = await registerService(req.body);
    await writeAuditLog({ actorId: user._id, action: "USER_REGISTERED", resourceType: "User", resourceId: user._id, details: { portal: user.portal }, outcome: "SUCCESS", statusCode: 201 });
    return sendResponse(res, 201, true, "Registration successful. OTP sent to email", { id: user._id, name: user.name, email: user.email });
  } catch (error) {
    void writeAuditLog({ action: "REGISTER_FAILED", resourceType: "User", details: { email: req.body?.email || null, reason: error?.code || error?.message }, outcome: "FAILURE", statusCode: error?.statusCode || 500 });
    return sendError(res, error);
  }
};

export const registerPartner = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendResponse(res, 422, false, "Validation failed", null, "VALIDATION_ERROR", errors.array());
    const user = await registerPartnerService(req.body);
    await writeAuditLog({ actorId: user._id, action: "PARTNER_APPLICATION_SUBMITTED", resourceType: "PartnerApplication", details: { email: user.email, vehicleRegistrationNumber: req.body.vehicleRegistrationNumber }, outcome: "SUCCESS", statusCode: 201 });
    return sendResponse(res, 201, true, "Application submitted. Please verify your email and wait for admin approval.", { id: user._id, email: user.email });
  } catch (error) {
    return sendError(res, error);
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const data = await verifyOtpService(req.body);
    await writeAuditLog({ action: "OTP_VERIFIED", resourceType: "Authentication", details: { purpose: req.body?.purpose || null, email: req.body?.email || null }, outcome: "SUCCESS", statusCode: 200 });
    return sendResponse(res, 200, true, "OTP verified successfully", data);
  } catch (error) {
    void writeAuditLog({ action: "OTP_VERIFICATION_FAILED", resourceType: "Authentication", details: { purpose: req.body?.purpose || null, email: req.body?.email || null, reason: error?.code || error?.message }, outcome: "FAILURE", statusCode: error?.statusCode || 500 });
    return sendError(res, error);
  }
};

export const login = async (req, res) => {
  try {
    const result = await loginService(req.body);
    await writeAuditLog({ actorId: result.user._id, action: "LOGIN_SUCCESS", resourceType: "Authentication", resourceId: result.user._id, details: { portal: result.user.portal }, outcome: "SUCCESS", statusCode: 200 });
    return sendResponse(res, 200, true, "Login successful", result);
  } catch (error) {
    void writeAuditLog({ action: "LOGIN_FAILED", resourceType: "Authentication", details: { email: req.body?.email || null, portal: req.body?.portal || null, reason: error?.code || error?.message }, outcome: "FAILURE", statusCode: error?.statusCode || 500 });
    return sendError(res, error);
  }
};

export const resendOtp = async (req, res) => {
  try {
    await resendOtpService(req.body.email);
    return sendResponse(res, 200, true, "OTP sent successfully");
  } catch (error) {
    return sendError(res, error);
  }
};

export const forgotPassword = async (req, res) => {
  try {
    await forgotPasswordService(req.body.email);
    return sendResponse(res, 200, true, "OTP sent successfully");
  } catch (error) {
    return sendError(res, error);
  }
};

export const resetPassword = async (req, res) => {
  try {
    await resetPasswordService(req.body);
    return sendResponse(res, 200, true, "Password reset successful");
  } catch (error) {
    return sendError(res, error);
  }
};

export const me = async (req, res) => sendResponse(res, 200, true, "Current user", req.user);
