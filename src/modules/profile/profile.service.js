import bcrypt from "bcryptjs";
import User from "../user/user.model.js";
import Profile from "./profile.model.js";
import { uploadImage } from "../../config/cloudinary.js";
import { emitPartnerAvailability } from "../../socket/emitters.js";
import { assertPartnerCanAcceptOrders, getPartnerReadiness } from "../partnerOps/partner-readiness.service.js";

const calculateTier = (rating, deliveries) => {
  if (deliveries >= 500 && rating >= 4.7) return "Platinum";
  if (deliveries >= 250 && rating >= 4.5) return "Gold";
  if (deliveries >= 100 && rating >= 4.2) return "Silver";
  return "Bronze";
};

export const getMyProfileService = async (userId) => {
  const user = await User.findById(userId).select("-password");
  if (!user) throw new Error("User not found");
  let profile = await Profile.findOne({ userId });
  if (!profile) profile = await Profile.create({ userId, role: user.role });
  if (user.role === "PARTNER") {
    const readiness = await getPartnerReadiness(userId);
    profile.tier = calculateTier(Number(profile.rating || 0), Number(profile.totalDeliveries || 0));
    return { user, profile, readiness };
  }
  return { user, profile };
};

export const updateMyProfileService = async (userId, payload) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  const { name, email, phone, vehicleType, vehicleNumber, drivingLicenseNumber, bankName, accountHolderName, accountNumber, ifscCode, ...profileData } = payload;

  if (user.role === "PARTNER" && (vehicleType !== undefined || vehicleNumber !== undefined || drivingLicenseNumber !== undefined)) {
    throw new Error("Vehicle details cannot be modified from this page");
  }
  if (user.role === "PARTNER" && (bankName !== undefined || accountHolderName !== undefined || accountNumber !== undefined || ifscCode !== undefined)) {
    throw new Error("Bank details must be added from the Bank details page and cannot be modified after setup");
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (email !== undefined) {
    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail !== user.email) {
      const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } });
      if (existingUser) throw new Error("Email already in use");
      user.email = normalizedEmail;
    }
  }

  await user.save();
  const profile = await Profile.findOneAndUpdate(
    { userId },
    { $set: { ...profileData, role: user.role } },
    { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true },
  );

  return {
    user: {
      _id: user._id, name: user.name, email: user.email, phone: user.phone,
      role: user.role, portal: user.portal, profileImage: user.profileImage,
      isEmailVerified: user.isEmailVerified, isActive: user.isActive,
    },
    profile,
  };
};

export const setInitialPartnerBankDetailsService = async (userId, payload) => {
  const user = await User.findOne({ _id: userId, role: "PARTNER", portal: "partner" });
  if (!user) throw new Error("Delivery partner not found");
  const { bankName, accountHolderName, accountNumber, ifscCode } = payload || {};
  if (![bankName, accountHolderName, accountNumber, ifscCode].every((v) => String(v || "").trim())) {
    throw new Error("All bank details are required");
  }
  const existing = await Profile.findOne({ userId, role: "PARTNER" });
  if (existing?.bankName || existing?.accountNumber || existing?.ifscCode) {
    throw new Error("Bank details are already set and cannot be modified");
  }
  const profile = await Profile.findOneAndUpdate(
    { userId },
    { $set: {
      bankName: String(bankName).trim(),
      accountHolderName: String(accountHolderName).trim(),
      accountNumber: String(accountNumber).trim(),
      ifscCode: String(ifscCode).trim().toUpperCase(),
      role: "PARTNER",
    } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return profile;
};

export const changePasswordService = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (!(await bcrypt.compare(currentPassword, user.password))) throw new Error("Current password is incorrect");
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
};

export const updateAvatarService = async (userId, file) => {
  if (!file) throw new Error("Avatar image is required");
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  const uploadedImage = await uploadImage(file.buffer, `fresh15/user-profile/${userId}`);
  const imageUrl = uploadedImage.secure_url;
  user.profileImage = imageUrl;
  await user.save();
  const profile = await Profile.findOneAndUpdate(
    { userId },
    { $set: { avatar: imageUrl, role: user.role } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return { profileImage: imageUrl, avatar: imageUrl, profile };
};

export const updatePartnerAvailabilityService = async (userId, isOnline) => {
  const profile = await Profile.findOne({ userId, role: "PARTNER" });
  if (!profile) throw new Error("Partner profile not found");
  if (!isOnline && profile.currentDeliveryId) throw new Error("Complete the active delivery before going offline");
  if (isOnline) await assertPartnerCanAcceptOrders(userId);

  profile.isOnline = isOnline;
  if (isOnline) {
    profile.deliveryStatus = profile.isPaused ? "PAUSED" : profile.currentDeliveryId ? "BUSY" : "AVAILABLE";
  } else {
    profile.isPaused = false;
    profile.pauseUntil = null;
    profile.pauseReason = "";
    profile.deliveryStatus = "OFFLINE";
  }
  await profile.save();
  emitPartnerAvailability(userId, { isOnline: profile.isOnline, deliveryStatus: profile.deliveryStatus, currentDeliveryId: profile.currentDeliveryId });
  return { isOnline: profile.isOnline, deliveryStatus: profile.deliveryStatus, currentDeliveryId: profile.currentDeliveryId };
};
