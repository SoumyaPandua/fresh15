import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import {
  createReviewService, deleteReviewService, getAllReviewsService, getMyReviewsService,
  getProductReviewsService, getReviewByIdService, updateReviewService,
  adminUpdateReviewVisibilityService, adminDeleteReviewService,
} from "./review.service.js";

export const getProductReviews = async (req, res) => {
  try { return sendResponse(res, 200, true, "Product reviews fetched successfully", await getProductReviewsService(req.params.productId)); }
  catch (error) { return sendError(res, error); }
};
export const getMyReviews = async (req, res) => {
  try { return sendResponse(res, 200, true, "Reviews fetched successfully", await getMyReviewsService(req.user._id)); }
  catch (error) { return sendError(res, error); }
};
export const getAllReviews = async (req, res) => {
  try { return sendResponse(res, 200, true, "Reviews fetched successfully", await getAllReviewsService(req.query)); }
  catch (error) { return sendError(res, error); }
};
export const getReviewById = async (req, res) => {
  try { return sendResponse(res, 200, true, "Review fetched successfully", await getReviewByIdService(req.params.id)); }
  catch (error) { return sendError(res, error); }
};
export const createReview = async (req, res) => {
  try { return sendResponse(res, 201, true, "Review created successfully", await createReviewService(req.user._id, req.body)); }
  catch (error) { return sendError(res, error); }
};
export const updateReview = async (req, res) => {
  try { return sendResponse(res, 200, true, "Review updated successfully", await updateReviewService(req.params.id, req.user._id, req.body)); }
  catch (error) { return sendError(res, error); }
};
export const deleteReview = async (req, res) => {
  try { await deleteReviewService(req.params.id, req.user._id); return res.status(204).send(); }
  catch (error) { return sendError(res, error); }
};
export const adminUpdateReview = async (req, res) => {
  try { return sendResponse(res, 200, true, "Review moderated successfully", await adminUpdateReviewVisibilityService(req.params.id, req.user._id, req.body)); }
  catch (error) { return sendError(res, error); }
};
export const adminDeleteReview = async (req, res) => {
  try { await adminDeleteReviewService(req.params.id, req.user._id); return res.status(204).send(); }
  catch (error) { return sendError(res, error); }
};
