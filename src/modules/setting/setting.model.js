import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    appName: {
      type: String,
      default: "Fresh15",
    },

    logo: {
      type: String,
      default: "",
    },

    supportEmail: {
      type: String,
      default: "",
    },

    supportPhone: {
      type: String,
      default: "",
    },

    currency: {
      type: String,
      default: "INR",
    },

    currencySymbol: {
      type: String,
      default: "₹",
    },

    taxPercentage: {
      type: Number,
      default: 0,
    },

    deliveryCharge: {
      type: Number,
      default: 40,
    },

    freeDeliveryAbove: {
      type: Number,
      default: 500,
    },

    codEnabled: {
      type: Boolean,
      default: true,
    },

    onlinePaymentEnabled: {
      type: Boolean,
      default: true,
    },

    maintenanceMode: {
      type: Boolean,
      default: false,
    },

    defaultLanguage: {
      type: String,
      default: "en",
    },

    timezone: {
      type: String,
      default: "Asia/Kolkata",
    },

    privacyPolicy: {
      type: String,
      default: "",
    },

    termsAndConditions: {
      type: String,
      default: "",
    },

    aboutUs: {
      type: String,
      default: "",
    },

    contactAddress: {
      type: String,
      default: "",
    },

    socialLinks: {
      facebook: String,
      instagram: String,
      twitter: String,
      linkedin: String,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Setting = mongoose.model(
  "Setting",
  settingSchema
);

export default Setting;