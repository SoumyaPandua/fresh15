import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    role: {
      type: String,
      enum: ["CUSTOMER", "PARTNER", "ADMIN", "SUPER_ADMIN"],
      required: true,
    },

    // Common
    avatar: {
      type: String,
      default: null,
    },

    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER"],
      default: null,
    },

    dob: {
      type: Date,
      default: null,
    },

    // Customer
    defaultAddressId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    preferences: {
      type: Object,
      default: {},
    },

    // Partner
    vehicleType: {
      type: String,
      default: null,
    },

    vehicleNumber: {
      type: String,
      default: null,
    },

    drivingLicenseNumber: {
      type: String,
      default: null,
    },

    bankName: {
      type: String,
      default: null,
    },

    accountHolderName: {
      type: String,
      default: null,
    },

    accountNumber: {
      type: String,
      default: null,
    },

    ifscCode: {
      type: String,
      default: null,
    },

    // Admin
    designation: {
      type: String,
      default: null,
    },

    notificationSettings: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const Profile = mongoose.model("Profile", profileSchema);

export default Profile;