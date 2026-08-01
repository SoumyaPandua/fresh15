import sendResponse from "../../utils/sendResponse.js";

import {
  applyCouponService,
  createCouponService,
  deleteCouponService,
  getAllCouponsService,
  getCouponByIdService,
  markCouponUsedService,
  updateCouponService,
  updateCouponStatusService,
} from "./coupon.service.js";

export const getAllCoupons = async (
  req,
  res
) => {
  try {
    const data =
      await getAllCouponsService();

    return sendResponse(
      res,
      200,
      true,
      "Coupons fetched successfully",
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

export const getCouponById = async (
  req,
  res
) => {
  try {
    const data =
      await getCouponByIdService(
        req.params.id
      );

    return sendResponse(
      res,
      200,
      true,
      "Coupon fetched successfully",
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

export const createCoupon = async (
  req,
  res
) => {
  try {
    const data =
      await createCouponService(
        req.body,
        req.user._id
      );

    return sendResponse(
      res,
      201,
      true,
      "Coupon created successfully",
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

export const updateCoupon = async (
  req,
  res
) => {
  try {
    const data =
      await updateCouponService(
        req.params.id,
        req.body,
        req.user._id
      );

    return sendResponse(
      res,
      200,
      true,
      "Coupon updated successfully",
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

export const updateCouponStatus =
  async (req, res) => {
    try {
      const data =
        await updateCouponStatusService(
          req.params.id,
          req.body.isActive,
          req.user._id
        );

      return sendResponse(
        res,
        200,
        true,
        "Coupon status updated successfully",
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

export const applyCoupon = async (
  req,
  res
) => {
  try {
    const data =
      await applyCouponService(
        req.body.code,
        req.body.orderAmount
      );

    return sendResponse(
      res,
      200,
      true,
      "Coupon applied successfully",
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

export const markCouponUsed =
  async (req, res) => {
    try {
      const data =
        await markCouponUsedService(
          req.params.id
        );

      return sendResponse(
        res,
        200,
        true,
        "Coupon usage updated successfully",
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

export const deleteCoupon = async (
  req,
  res
) => {
  try {
    await deleteCouponService(
      req.params.id
    );

    return sendResponse(
      res,
      200,
      true,
      "Coupon deleted successfully"
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