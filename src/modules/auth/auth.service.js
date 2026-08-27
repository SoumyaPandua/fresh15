import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import User from "../user/user.model.js";
import redis from "../../config/redis.js";
import generateOtp from "../../utils/generateOtp.js";
import sendEmail from "../../utils/sendEmail.js";
import otpTemplate from "../../templates/otpTemplate.js";
import generateToken from "../../utils/generateToken.js";
import AppError from "../../utils/AppError.js";
import { createOrUpdatePartnerApplicationService } from "../partnerApplication/partnerApplication.service.js";
import PartnerApplication from "../partnerApplication/partnerApplication.model.js";

const RESET_TTL = 600;

export const registerService = async ({ name, email, phone, password }) => {
  email = email.toLowerCase();
  if (await User.findOne({ email })) throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "Email already registered");
  const user = await User.create({ name, email, phone, password: await bcrypt.hash(password, 10), portal: "customer", role: "CUSTOMER" });
  const otp = generateOtp();
  await redis.set(`otp:REGISTER:${email}`, otp, "EX", RESET_TTL);
  await sendEmail(email, "Verify Your Email", otpTemplate(name, otp));
  return user;
};

export const registerPartnerService = async ({ name, email, phone, password, vehicleType, vehicleRegistrationNumber, vehicleMakeModel }) => {
  const user = await createOrUpdatePartnerApplicationService({ name, email, phone, password, vehicleType, vehicleRegistrationNumber, vehicleMakeModel });
  const normalizedEmail = email.toLowerCase().trim();
  const otp = generateOtp();
  await redis.set(`otp:REGISTER:${normalizedEmail}`, otp, "EX", RESET_TTL);
  await sendEmail(normalizedEmail, "Verify Your Fresh15 Partner Account", otpTemplate(name, otp));
  return user;
};

export const verifyOtpService = async ({ email, otp, purpose }) => {
  email = email.toLowerCase();
  const key = `otp:${purpose}:${email}`;
  const savedOtp = await redis.get(key);
  if (!savedOtp) throw new AppError(422, "OTP_EXPIRED", "OTP expired");
  const attemptKey = `otp:attempts:${purpose}:${email}`;
  if (Number(await redis.get(attemptKey) || 0) >= 5) throw new AppError(429, "OTP_RATE_LIMITED", "Too many OTP attempts. Please request a new OTP.");
  if (String(savedOtp) !== String(otp)) {
    const next = await redis.incr(attemptKey);
    if (next === 1) await redis.expire(attemptKey, RESET_TTL);
    if (next >= 5) throw new AppError(429, "OTP_RATE_LIMITED", "Too many OTP attempts. Please request a new OTP.");
    throw new AppError(422, "INVALID_OTP", "Invalid OTP");
  }

  if (purpose === "REGISTER") {
    const user = await User.findOne({ email });
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
    user.isEmailVerified = true;
    await user.save();
    await redis.del(key, attemptKey);
    return null;
  }

  if (purpose === "FORGOT_PASSWORD") {
    const user = await User.findOne({ email });
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
    const jti = crypto.randomUUID();
    const resetToken = jwt.sign({ email, purpose: "RESET_PASSWORD", jti }, process.env.JWT_SECRET, { expiresIn: "10m" });
    await redis.set(`reset:jti:${jti}`, String(user._id), "EX", RESET_TTL);
    await redis.del(key, attemptKey);
    return { resetToken };
  }

  throw new AppError(422, "INVALID_OTP_PURPOSE", "Invalid OTP purpose");
};

export const loginService = async ({ email, password, portal }) => {
  email = email.toLowerCase();
  const user = await User.findOne({ email });
  if (!user) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  if (user.portal !== portal) throw new AppError(403, "FORBIDDEN", "Unauthorized portal");
  if (!user.isEmailVerified) throw new AppError(403, "EMAIL_NOT_VERIFIED", "Please verify your email");
  if (!user.isActive) {
    if (user.role === "PARTNER" && user.portal === "partner") {
      const application = await PartnerApplication.findOne({ userId: user._id }).select("status rejectionReason").lean();
      if (application?.status === "PENDING") throw new AppError(403, "PARTNER_APPROVAL_PENDING", "Your partner application is awaiting admin approval");
      if (application?.status === "REJECTED") throw new AppError(403, "PARTNER_APPLICATION_REJECTED", application.rejectionReason || "Your partner application was not approved");
    }
    throw new AppError(403, "ACCOUNT_DISABLED", "Account is disabled");
  }
  if (!(await bcrypt.compare(password, user.password))) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  return { token: generateToken(user._id), user };
};

export const resendOtpService = async (email) => {
  email = email.toLowerCase();
  const user = await User.findOne({ email });
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  if (user.isEmailVerified) throw new AppError(409, "EMAIL_ALREADY_VERIFIED", "Email already verified");
  const otp = generateOtp();
  await redis.set(`otp:REGISTER:${email}`, otp, "EX", RESET_TTL);
  await sendEmail(email, "Verify Your Email", otpTemplate(user.name, otp));
};

export const forgotPasswordService = async (email) => {
  email = email.toLowerCase();
  const user = await User.findOne({ email });
  if (user) {
    const otp = generateOtp();
    await redis.set(`otp:FORGOT_PASSWORD:${email}`, otp, "EX", RESET_TTL);
    await sendEmail(email, "Reset Password OTP", otpTemplate(user.name, otp));
  }
  return "If the account exists, a reset OTP has been sent.";
};

export const resetPasswordService = async ({ token, password }) => {
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch { throw new AppError(422, "INVALID_RESET_TOKEN", "Invalid or expired reset token"); }
  if (payload?.purpose !== "RESET_PASSWORD" || !payload?.jti) throw new AppError(422, "INVALID_RESET_TOKEN", "Invalid or expired reset token");
  const ownerId = await redis.getdel(`reset:jti:${payload.jti}`);
  if (!ownerId) throw new AppError(422, "INVALID_RESET_TOKEN", "Invalid or expired reset token");
  const user = await User.findById(ownerId);
  if (!user || user.email !== payload.email) throw new AppError(422, "INVALID_RESET_TOKEN", "Invalid or expired reset token");
  user.password = await bcrypt.hash(password, 10);
  await user.save();
  return true;
};
