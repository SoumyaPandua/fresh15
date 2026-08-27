import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import {
  listPartnerApplicationsService,
  approvePartnerApplicationService,
  rejectPartnerApplicationService,
} from "./partnerApplication.service.js";

export const listPartnerApplications = async (req, res) => {
  try {
    return sendResponse(res, 200, true, "Partner applications fetched", await listPartnerApplicationsService(req.query));
  } catch (error) {
    return sendError(res, error);
  }
};

export const approvePartnerApplication = async (req, res) => {
  try {
    return sendResponse(res, 200, true, "Partner application approved", await approvePartnerApplicationService(req.params.id, req.user._id));
  } catch (error) {
    return sendError(res, error);
  }
};

export const rejectPartnerApplication = async (req, res) => {
  try {
    return sendResponse(res, 200, true, "Partner application rejected", await rejectPartnerApplicationService(req.params.id, req.user._id, req.body.reason || ""));
  } catch (error) {
    return sendError(res, error);
  }
};
