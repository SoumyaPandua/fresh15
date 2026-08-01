import sendResponse from "../../utils/sendResponse.js";

import {
  getAdminDashboardService,
  getCustomerDashboardService,
  getSellerDashboardService,
} from "./dashboard.service.js";

export const getAdminDashboard = async (
  req,
  res
) => {
  try {
    const data =
      await getAdminDashboardService();

    return sendResponse(
      res,
      200,
      true,
      "Dashboard fetched successfully",
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

export const getSellerDashboard = async (
  req,
  res
) => {
  try {
    const data =
      await getSellerDashboardService(
        req.user._id
      );

    return sendResponse(
      res,
      200,
      true,
      "Dashboard fetched successfully",
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

export const getCustomerDashboard =
  async (req, res) => {
    try {
      const data =
        await getCustomerDashboardService(
          req.user._id
        );

      return sendResponse(
        res,
        200,
        true,
        "Dashboard fetched successfully",
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