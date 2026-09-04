import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import {
  assignRiderService,
  createDeliveryService,
  deleteDeliveryService,
  getAllDeliveriesService,
  getAvailableRidersService,
  getDeliveryByIdService,
  getMyActiveDeliveryService,
  getMyDeliveriesService,
  updateDeliveryStatusService,
  getCustomerDeliveryByOrderService,
  getDeliveryRouteService,
} from "./delivery.service.js";
import { collectCodPaymentService } from "./cod-payment.service.js";
import {
  getCustomerDeliveryOtpService,
  verifyDeliveryOtpService,
  customerConfirmDeliveryService,
  uploadDeliveryProofService,
  failDeliveryService,
} from "./delivery-proof.service.js";

export const getAllDeliveries = async (req, res) => {
  try { return sendResponse(res, 200, true, "Deliveries fetched successfully", await getAllDeliveriesService(req.query)); }
  catch (error) { return sendError(res, error); }
};
export const getAvailableRiders = async (req, res) => {
  try { return sendResponse(res, 200, true, "Available riders fetched successfully", await getAvailableRidersService()); }
  catch (error) { return sendError(res, error); }
};
export const getDeliveryById = async (req, res) => {
  try { return sendResponse(res, 200, true, "Delivery fetched successfully", await getDeliveryByIdService(req.params.id, req.user._id, req.user.role)); }
  catch (error) { return sendError(res, error); }
};
export const getMyDeliveries = async (req, res) => {
  try { return sendResponse(res, 200, true, "My deliveries fetched successfully", await getMyDeliveriesService(req.user._id, req.query)); }
  catch (error) { return sendError(res, error); }
};
export const getMyActiveDelivery = async (req, res) => {
  try {
    const data = await getMyActiveDeliveryService(req.user._id);
    return sendResponse(res, 200, true, data ? "Active delivery fetched successfully" : "No active delivery", data);
  } catch (error) { return sendError(res, error); }
};
export const createDelivery = async (req, res) => {
  try { return sendResponse(res, 201, true, "Delivery created successfully", await createDeliveryService(req.user._id, req.body)); }
  catch (error) { return sendError(res, error); }
};
export const assignRider = async (req, res) => {
  try { return sendResponse(res, 200, true, "Rider assigned successfully", await assignRiderService(req.params.id, req.body.riderId, req.user._id)); }
  catch (error) { return sendError(res, error); }
};
export const updateDeliveryStatus = async (req, res) => {
  try { return sendResponse(res, 200, true, "Delivery status updated successfully", await updateDeliveryStatusService(req.params.id, req.body.status, req.user._id, req.user.role)); }
  catch (error) { return sendError(res, error); }
};
export const collectCodPayment = async (req, res) => {
  try { return sendResponse(res, 200, true, "COD payment collected successfully", await collectCodPaymentService(req.params.id, req.user._id, req.user.role)); }
  catch (error) { return sendError(res, error); }
};
export const getCustomerDeliveryOtp = async (req, res) => {
  try { return sendResponse(res, 200, true, "Delivery OTP fetched successfully", await getCustomerDeliveryOtpService(req.params.orderId, req.user._id)); }
  catch (error) { return sendError(res, error); }
};
export const verifyDeliveryOtp = async (req, res) => {
  try { return sendResponse(res, 200, true, "Delivery OTP verified successfully", await verifyDeliveryOtpService(req.params.id, req.user._id, req.body.otp)); }
  catch (error) { return sendError(res, error); }
};
export const customerConfirmDelivery = async (req, res) => {
  try { return sendResponse(res, 200, true, "Customer confirmed delivery", await customerConfirmDeliveryService(req.params.id, req.user._id)); }
  catch (error) { return sendError(res, error); }
};
export const uploadDeliveryProof = async (req, res) => {
  try { return sendResponse(res, 200, true, "Delivery proof uploaded successfully", await uploadDeliveryProofService(req.params.id, req.user._id, req.user.role, req.body.type, req.file?.buffer)); }
  catch (error) { return sendError(res, error); }
};
export const failDelivery = async (req, res) => {
  try { return sendResponse(res, 200, true, "Delivery marked as failed", await failDeliveryService(req.params.id, req.user._id, req.body.reason, req.body.note)); }
  catch (error) { return sendError(res, error); }
};
export const getDeliveryRoute = async (req, res) => {
  try { return sendResponse(res, 200, true, "Delivery route fetched successfully", await getDeliveryRouteService(req.params.id, req.user._id, req.user.role)); }
  catch (error) { return sendError(res, error); }
};
export const deleteDelivery = async (req, res) => {
  try { await deleteDeliveryService(req.params.id); return sendResponse(res, 200, true, "Delivery deleted successfully"); }
  catch (error) { return sendError(res, error); }
};
export const getCustomerDeliveryByOrder = async (req, res) => {
  try { return sendResponse(res, 200, true, "Delivery fetched successfully", await getCustomerDeliveryByOrderService(req.params.orderId, req.user._id)); }
  catch (error) { return sendError(res, error); }
};
