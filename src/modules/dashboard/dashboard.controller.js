import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";

import {
  getAdminDashboardService,
  getAdminRevenueService,
  getAdminAnalyticsService,
  getCustomerDashboardService,
  getSellerDashboardService,
} from "./dashboard.service.js";

export const getAdminDashboard = async (req, res) => {
  try {
    const data = await getAdminDashboardService();
    return sendResponse(res, 200, true, "Dashboard fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const getAdminRevenue = async (req, res) => {
  try {
    const data = await getAdminRevenueService();
    return sendResponse(res, 200, true, "Revenue fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};


export const getAdminAnalytics = async (req, res) => {
  try {
    const data = await getAdminAnalyticsService();
    return sendResponse(res, 200, true, "Analytics fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const getSellerDashboard = async (req, res) => {
  try {
    const data = await getSellerDashboardService(req.user._id);
    return sendResponse(res, 200, true, "Dashboard fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const getCustomerDashboard = async (req, res) => {
  try {
    const data = await getCustomerDashboardService(req.user._id);
    return sendResponse(res, 200, true, "Dashboard fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};
