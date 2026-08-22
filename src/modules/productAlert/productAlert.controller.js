import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import {
  deleteMyProductAlertService,
  getMyProductAlertForProductService,
  getMyProductAlertsService,
  getAdminProductAlertsService,
  getAdminProductAlertSummaryService,
  upsertProductAlertService,
} from "./productAlert.service.js";

export const getMyProductAlerts = async (req, res) => {
  try {
    const alerts = await getMyProductAlertsService(
      req.user._id
    );

    return sendResponse(
      res,
      200,
      true,
      "Product alerts fetched successfully",
      alerts
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const getMyProductAlertForProduct = async (
  req,
  res
) => {
  try {
    const alert =
      await getMyProductAlertForProductService(
        req.user._id,
        req.params.productId
      );

    return sendResponse(
      res,
      200,
      true,
      "Product alert fetched successfully",
      alert
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const upsertMyProductAlert = async (req, res) => {
  try {
    const alert =
      await upsertProductAlertService(
        req.user._id,
        req.params.productId,
        req.body
      );

    return sendResponse(
      res,
      200,
      true,
      "Product alert saved successfully",
      alert
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const deleteMyProductAlert = async (req, res) => {
  try {
    await deleteMyProductAlertService(
      req.user._id,
      req.params.productId
    );

    return sendResponse(
      res,
      200,
      true,
      "Product alert removed successfully"
    );
  } catch (error) {
    return sendError(res, error);
  }
};


export const getAdminProductAlerts = async (req, res) => {
  try {
    const alerts = await getAdminProductAlertsService(req.query);

    return sendResponse(
      res,
      200,
      true,
      "Product alert subscriptions fetched successfully",
      alerts
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const getAdminProductAlertSummary = async (req, res) => {
  try {
    const summary = await getAdminProductAlertSummaryService();

    return sendResponse(
      res,
      200,
      true,
      "Product alert summary fetched successfully",
      summary
    );
  } catch (error) {
    return sendError(res, error);
  }
};
