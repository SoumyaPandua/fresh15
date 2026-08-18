import Setting from "./setting.model.js";
import { uploadImage } from "../../config/cloudinary.js";
import AppError from "../../utils/AppError.js";

const ALLOWED_FIELDS = [
  "appName", "supportEmail", "supportPhone", "currency", "currencySymbol", "taxPercentage",
  "deliveryCharge", "freeDeliveryAbove", "codEnabled", "onlinePaymentEnabled", "maintenanceMode",
  "defaultLanguage", "timezone", "privacyPolicy", "termsAndConditions", "aboutUs", "contactAddress", "socialLinks",
];

export const getSettingService = async () => {
  let setting = await Setting.findOne();
  if (!setting) setting = await Setting.create({});
  return setting;
};

export const updateSettingService = async (body, userId, file) => {
  let setting = await Setting.findOne();
  if (!setting) setting = await Setting.create({ createdBy: userId });

  if (file) {
    try {
      const result = await uploadImage(file.buffer, "fresh15/settings");
      setting.logo = result.secure_url;
    } catch (error) {
      throw new AppError(502, "FILE_UPLOAD_FAILED", "Unable to upload settings logo", [error.message]);
    }
  }

  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) setting[key] = body[key];
  }

  setting.updatedBy = userId;
  await setting.save();
  return setting;
};
