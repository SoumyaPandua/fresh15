import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import { createDeliveryRatingService, getDeliveryRatingService } from "./deliveryRating.service.js";

export const getDeliveryRating = async (req, res) => {
  try { return sendResponse(res, 200, true, "Delivery rating fetched successfully", await getDeliveryRatingService(req.params.orderId, req.user._id)); }
  catch (error) { return sendError(res, error); }
};

export const createDeliveryRating = async (req, res) => {
  try { return sendResponse(res, 201, true, "Delivery partner rated successfully", await createDeliveryRatingService(req.params.orderId, req.user._id, req.body.rating)); }
  catch (error) { return sendError(res, error); }
};
