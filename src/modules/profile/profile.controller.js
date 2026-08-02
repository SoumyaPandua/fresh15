import {
  changePasswordService,
  getMyProfileService,
  updateAvatarService,
  updateMyProfileService,
} from "./profile.service.js";

import sendResponse from "../../utils/sendResponse.js";

export const getMyProfile = async (req, res) => {
  try {
    const data = await getMyProfileService(req.user._id);

    return sendResponse(res, 200, true, "Profile fetched successfully", data);
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
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
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
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
    return sendResponse(res, 400, false, error.message);
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

    return sendResponse(
      res,
      400,
      false,
      error.message || "Avatar update failed"
    );
  }
};