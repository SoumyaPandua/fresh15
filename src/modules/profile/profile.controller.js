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
    const profile = await updateMyProfileService(req.user._id, req.body);

    return sendResponse(
      res,
      200,
      true,
      "Profile updated successfully",
      profile
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
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
    const { avatar } = req.body;

    const profile = await updateAvatarService(req.user._id, avatar);

    return sendResponse(
      res,
      200,
      true,
      "Avatar updated successfully",
      profile
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

export const updateAvatar = async (req, res) => {
  try {
    const profile = await updateAvatarService(
      req.user._id,
      req.file
    );

    return sendResponse(
      res,
      200,
      true,
      "Avatar updated successfully",
      profile
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};