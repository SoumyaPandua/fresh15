import sendResponse from "../../utils/sendResponse.js";

import {
  createReviewService,
  deleteReviewService,
  getMyReviewsService,
  getProductReviewsService,
  getReviewByIdService,
  updateReviewService,
} from "./review.service.js";

export const getProductReviews = async (
  req,
  res
) => {
  try {
    const reviews =
      await getProductReviewsService(
        req.params.productId
      );

    return sendResponse(
      res,
      200,
      true,
      "Product reviews fetched successfully",
      reviews
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

export const getMyReviews = async (
  req,
  res
) => {
  try {
    const reviews =
      await getMyReviewsService(
        req.user._id
      );

    return sendResponse(
      res,
      200,
      true,
      "Reviews fetched successfully",
      reviews
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

export const getReviewById = async (
  req,
  res
) => {
  try {
    const review =
      await getReviewByIdService(
        req.params.id
      );

    return sendResponse(
      res,
      200,
      true,
      "Review fetched successfully",
      review
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

export const createReview = async (
  req,
  res
) => {
  try {
    const review =
      await createReviewService(
        req.user._id,
        req.body
      );

    return sendResponse(
      res,
      201,
      true,
      "Review created successfully",
      review
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

export const updateReview = async (
  req,
  res
) => {
  try {
    const review =
      await updateReviewService(
        req.params.id,
        req.user._id,
        req.body
      );

    return sendResponse(
      res,
      200,
      true,
      "Review updated successfully",
      review
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

export const deleteReview = async (
  req,
  res
) => {
  try {
    await deleteReviewService(
      req.params.id,
      req.user._id
    );

    return sendResponse(
      res,
      200,
      true,
      "Review deleted successfully"
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