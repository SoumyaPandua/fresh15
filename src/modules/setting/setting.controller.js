import sendResponse from "../../utils/sendResponse.js";

import {
  getSettingService,
  updateSettingService,
} from "./setting.service.js";

export const getSetting = async (
  req,
  res
) => {
  try {
    const data =
      await getSettingService();

    return sendResponse(
      res,
      200,
      true,
      "Settings fetched successfully",
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

export const updateSetting = async (
  req,
  res
) => {
  try {
    const data =
      await updateSettingService(
        req.body,
        req.user._id
      );

    return sendResponse(
      res,
      200,
      true,
      "Settings updated successfully",
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