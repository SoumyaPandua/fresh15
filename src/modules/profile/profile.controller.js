import {
  changePasswordService,
  getMyProfileService,
  setInitialPartnerBankDetailsService,
  updateAvatarService,
  updateMyProfileService,
  updatePartnerAvailabilityService,
} from "./profile.service.js";
import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";

export const getMyProfile = async (req, res) => {
  try { return sendResponse(res, 200, true, "Profile fetched successfully", await getMyProfileService(req.user._id)); }
  catch (error) { return sendError(res, error); }
};

export const updateMyProfile = async (req, res) => {
  try { return sendResponse(res, 200, true, "Profile updated successfully", await updateMyProfileService(req.user._id, req.body)); }
  catch (error) { return sendError(res, error); }
};

export const setInitialPartnerBankDetails = async (req, res) => {
  try {
    if (req.user.role !== "PARTNER" || req.user.portal !== "partner") return sendResponse(res, 403, false, "Only delivery partners can add bank details");
    const profile = await setInitialPartnerBankDetailsService(req.user._id, req.body);
    return sendResponse(res, 200, true, "Bank details saved successfully", profile);
  } catch (error) { return sendError(res, error); }
};

export const changePassword = async (req, res) => {
  try { await changePasswordService(req.user._id, req.body.currentPassword, req.body.newPassword); return sendResponse(res, 200, true, "Password changed successfully"); }
  catch (error) { return sendError(res, error); }
};

export const updateAvatar = async (req, res) => {
  try { return sendResponse(res, 200, true, "Avatar updated successfully", await updateAvatarService(req.user._id, req.file)); }
  catch (error) { return sendError(res, error); }
};

export const updatePartnerAvailability = async (req, res) => {
  try {
    if (req.user.role !== "PARTNER" || req.user.portal !== "partner") return sendResponse(res, 403, false, "Only delivery partners can update availability");
    const data = await updatePartnerAvailabilityService(req.user._id, req.body.isOnline);
    return sendResponse(res, 200, true, data.isOnline ? "You are now online" : "You are now offline", data);
  } catch (error) { return sendError(res, error); }
};
