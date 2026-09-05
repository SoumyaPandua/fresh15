import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    role: { type: String, enum: ["CUSTOMER", "PARTNER", "ADMIN", "SUPER_ADMIN"], required: true },
    avatar: { type: String, default: null },
    gender: { type: String, enum: ["MALE", "FEMALE", "OTHER"], default: null },
    dob: { type: Date, default: null },
    defaultAddressId: { type: mongoose.Schema.Types.ObjectId, default: null },
    preferences: { type: Object, default: {} },
    vehicleType: { type: String, default: null },
    vehicleNumber: { type: String, default: null },
    drivingLicenseNumber: { type: String, default: null },
    bankName: { type: String, default: null },
    accountHolderName: { type: String, default: null },
    accountNumber: { type: String, default: null },
    ifscCode: { type: String, default: null },
    isOnline: { type: Boolean, default: false },
    deliveryStatus: { type: String, enum: ["OFFLINE", "AVAILABLE", "BUSY", "PAUSED"], default: "OFFLINE" },
    currentDeliveryId: { type: mongoose.Schema.Types.ObjectId, ref: "Delivery", default: null },
    isPaused: { type: Boolean, default: false },
    pauseUntil: { type: Date, default: null },
    pauseReason: { type: String, default: "", maxlength: 200 },
    totalDeliveries: { type: Number, default: 0, min: 0 },
    totalEarnings: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    tier: { type: String, enum: ["Bronze", "Silver", "Gold", "Platinum"], default: "Bronze" },
    designation: { type: String, default: null },
    notificationSettings: { type: Object, default: {} },
  },
  { timestamps: true },
);

const Profile = mongoose.model("Profile", profileSchema);
export default Profile;
