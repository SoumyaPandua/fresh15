import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";

import {
  addToCartService,
  clearCartService,
  getMyCartService,
  removeCartItemService,
  updateCartItemService,
  updateCartItemSubstitutionService,
} from "./cart.service.js";

export const getMyCart = async (req, res) => {
  try {
    const data = await getMyCartService(req.user._id);

    return sendResponse(res, 200, true, "Cart fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const addToCart = async (req, res) => {
  try {
    const data = await addToCartService(req.user._id, req.body);

    return sendResponse(res, 201, true, "Product added to cart", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateCartItem = async (req, res) => {
  try {
    const data = await updateCartItemService(
      req.user._id,
      req.params.productId,
      req.body.quantity
    );

    return sendResponse(res, 200, true, "Cart updated successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateCartItemSubstitution = async (req, res) => {
  try {
    const data = await updateCartItemSubstitutionService(
      req.user._id,
      req.params.productId,
      req.body.substitutionPreference
    );

    return sendResponse(
      res,
      200,
      true,
      "Substitution preference updated successfully",
      data
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const removeCartItem = async (req, res) => {
  try {
    const data = await removeCartItemService(
      req.user._id,
      req.params.productId
    );

    return sendResponse(res, 200, true, "Product removed from cart", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const clearCart = async (req, res) => {
  try {
    const data = await clearCartService(req.user._id);

    return sendResponse(res, 200, true, "Cart cleared successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};