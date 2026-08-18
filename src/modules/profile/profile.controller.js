import {
  changePasswordService,
  getMyProfileService,
  updateAvatarService,
  updateMyProfileService,
  updatePartnerAvailabilityService,
} from "./profile.service.js";

import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";

export const getMyProfile = async (req, res) => {
  try {
    const data = await getMyProfileService(req.user._id);

    return sendResponse(res, 200, true, "Profile fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateMyProfile = async (req, res) => {
  try {
    const data = await updateMyProfileService(
      req.user._id,
      req.body
    );

    return sendResponse(
      res,
      200,
      true,
      "Profile updated successfully",
      data
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    await changePasswordService(
      req.user._id,
      currentPassword,
      newPassword
    );

    return sendResponse(
      res,
      200,
      true,
      "Password changed successfully"
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateAvatar = async (req, res) => {
  try {
    console.log("========== AVATAR DEBUG ==========");
    console.log("req.file:", req.file);
    console.log("user:", req.user?._id);
    console.log("==================================");

    const data = await updateAvatarService(
      req.user._id,
      req.file
    );

    return sendResponse(
      res,
      200,
      true,
      "Avatar updated successfully",
      data
    );

  } catch (error) {

    console.error("UPDATE AVATAR ERROR:");
    console.error(error);

    return sendError(res, error);
  }
};

export const updatePartnerAvailability = async (
  req,
  res
) => {
  try {
    if (
      req.user.role !== "PARTNER" ||
      req.user.portal !== "partner"
    ) {
      return sendResponse(
        res,
        403,
        false,
        "Only delivery partners can update availability"
      );
    }

    const data =
      await updatePartnerAvailabilityService(
        req.user._id,
        req.body.isOnline
      );

    return sendResponse(
      res,
      200,
      true,
      data.isOnline
        ? "You are now online"
        : "You are now offline",
      data
    );
  } catch (error) {
    return sendError(res, error);
  }
};