import sendResponse from "../../utils/sendResponse.js";

import {
  addWishlistService,
  getMyWishlistService,
  removeWishlistService,
} from "./wishlist.service.js";

export const getMyWishlist = async (req, res) => {
  try {
    const data = await getMyWishlistService(req.user._id);

    return sendResponse(
      res,
      200,
      true,
      "Wishlist fetched successfully",
      data
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

export const addWishlist = async (req, res) => {
  try {
    const data = await addWishlistService(
      req.user._id,
      req.body
    );

    return sendResponse(
      res,
      201,
      true,
      "Product added to wishlist",
      data
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

export const removeWishlist = async (req, res) => {
  try {
    const data = await removeWishlistService(
      req.user._id,
      req.params.productId
    );

    return sendResponse(
      res,
      200,
      true,
      "Product removed from wishlist",
      data
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};