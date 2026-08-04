import bcrypt from "bcryptjs";

import User from "../user/user.model.js";
import Profile from "./profile.model.js";
import { uploadImage } from "../../config/cloudinary.js";

export const getMyProfileService = async (userId) => {
  const user = await User.findById(userId).select("-password");

  if (!user) {
    throw new Error("User not found");
  }

  let profile = await Profile.findOne({ userId });

  if (!profile) {
    profile = await Profile.create({
      userId,
      role: user.role,
    });
  }

  return {
    user,
    profile,
  };
};

export const updateMyProfileService = async (userId, payload) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const {
    name,
    email,
    phone,
    ...profileData
  } = payload;

  // Update common User fields
  if (name !== undefined) {
    user.name = name;
  }

  if (phone !== undefined) {
    user.phone = phone;
  }

  if (email !== undefined) {
    const normalizedEmail = email.toLowerCase().trim();

    if (normalizedEmail !== user.email) {
      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: userId },
      });

      if (existingUser) {
        throw new Error("Email already in use");
      }

      user.email = normalizedEmail;
    }
  }

  await user.save();

  // Update role-specific profile fields
  const profile = await Profile.findOneAndUpdate(
    { userId },
    {
      $set: {
        ...profileData,
        role: user.role,
      },
    },
    {
      new: true,
      runValidators: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      portal: user.portal,
      profileImage: user.profileImage,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
    },
    profile,
  };
};

export const changePasswordService = async (
  userId,
  currentPassword,
  newPassword
) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const isPasswordCorrect = await bcrypt.compare(
    currentPassword,
    user.password
  );

  if (!isPasswordCorrect) {
    throw new Error("Current password is incorrect");
  }

  user.password = await bcrypt.hash(newPassword, 10);

  await user.save();

  return;
};

export const updateAvatarService = async (userId, file) => {
  if (!file) {
    throw new Error("Avatar image is required");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const uploadedImage = await uploadImage(
    file.buffer,
    "fresh15/profile"
  );

  const imageUrl = uploadedImage.secure_url;

  user.profileImage = imageUrl;

  await user.save();

  const profile = await Profile.findOneAndUpdate(
    { userId },
    {
      $set: {
        avatar: imageUrl,
        role: user.role,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return {
    profileImage: imageUrl,
    avatar: imageUrl,
    profile,
  };
};

export const updatePartnerAvailabilityService = async (
  userId,
  isOnline
) => {
  const profile = await Profile.findOne({
    userId,
    role: "PARTNER",
  });

  if (!profile) {
    throw new Error("Partner profile not found");
  }

  // Partner cannot go offline during an active delivery
  if (!isOnline && profile.currentDeliveryId) {
    throw new Error(
      "Complete the active delivery before going offline"
    );
  }

  profile.isOnline = isOnline;

  if (isOnline) {
    profile.deliveryStatus = profile.currentDeliveryId
      ? "BUSY"
      : "AVAILABLE";
  } else {
    profile.deliveryStatus = "OFFLINE";
  }

  await profile.save();

  return {
    isOnline: profile.isOnline,
    deliveryStatus: profile.deliveryStatus,
    currentDeliveryId: profile.currentDeliveryId,
  };
};