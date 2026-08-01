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
  const profile = await Profile.findOneAndUpdate(
    { userId },
    {
      $set: payload,
    },
    {
      new: true,
      runValidators: true,
      upsert: true,
    }
  );

  return profile;
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

  const uploadedImage = await uploadImage(
    file.buffer,
    "fresh15/profile"
  );

  const profile = await Profile.findOneAndUpdate(
    { userId },
    {
      $set: {
        avatar: uploadedImage.secure_url,
      },
    },
    {
      new: true,
      upsert: true,
    }
  );

  return profile;
};