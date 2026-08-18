import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../user/user.model.js";
import redis from "../../config/redis.js";
import generateOtp from "../../utils/generateOtp.js";
import sendEmail from "../../utils/sendEmail.js";
import otpTemplate from "../../templates/otpTemplate.js";
import generateToken from "../../utils/generateToken.js";
import AppError from "../../utils/AppError.js";

export const registerService = async ({
    name,
    email,
    phone,
    password,
    portal
}) => {
    email = email.toLowerCase();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
        throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "Email already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
        name,
        email,
        phone,
        password: hashedPassword,
        portal,
        role: portal === "customer" ? "CUSTOMER" : "PARTNER"
    });

    const otp = generateOtp();

    await redis.set(
        `otp:REGISTER:${email}`,
        otp,
        "EX",
        600
    );

    await sendEmail(
        email,
        "Verify Your Email",
        otpTemplate(name, otp)
    );

    return user;
};

export const verifyOtpService = async ({
    email,
    otp,
    purpose
}) => {
    email = email.toLowerCase();

    const key = `otp:${purpose}:${email}`;

    const savedOtp = await redis.get(key);

    if (!savedOtp) {
        throw new AppError(422, "OTP_EXPIRED", "OTP expired");
    }

    const attemptKey = `otp:attempts:${purpose}:${email}`;
    const attempts = Number(await redis.get(attemptKey) || 0);

    if (attempts >= 5) {
        throw new AppError(429, "OTP_RATE_LIMITED", "Too many OTP attempts. Please request a new OTP.");
    }

    // Convert both to string because frontend may send OTP as number
    if (String(savedOtp) !== String(otp)) {
        const nextAttempts = await redis.incr(attemptKey);
        if (nextAttempts === 1) await redis.expire(attemptKey, 600);
        if (nextAttempts >= 5) {
            throw new AppError(429, "OTP_RATE_LIMITED", "Too many OTP attempts. Please request a new OTP.");
        }
        throw new AppError(422, "INVALID_OTP", "Invalid OTP");
    }

    // Registration OTP
    if (purpose === "REGISTER") {
        const user = await User.findOne({ email });

        if (!user) {
            throw new AppError(404, "USER_NOT_FOUND", "User not found");
        }

        user.isEmailVerified = true;

        await user.save();

        // OTP becomes invalid immediately after successful verification
        await redis.del(key);
        await redis.del(attemptKey);

        return null;
    }

    // Forgot password OTP
    if (purpose === "FORGOT_PASSWORD") {
        const user = await User.findOne({ email });

        if (!user) {
            throw new AppError(404, "USER_NOT_FOUND", "User not found");
        }

        const resetToken = jwt.sign(
            {
                email,
                purpose: "RESET_PASSWORD"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "10m"
            }
        );

        // Delete OTP from Redis after successful verification
        await redis.del(key);
        await redis.del(attemptKey);

        return {
            resetToken
        };
    }

    throw new AppError(422, "INVALID_OTP_PURPOSE", "Invalid OTP purpose");
};

export const loginService = async ({
    email,
    password,
    portal
}) => {
    email = email.toLowerCase();

    const user = await User.findOne({ email });

    if (!user) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    if (user.portal !== portal) {
        throw new AppError(403, "FORBIDDEN", "Unauthorized portal");
    }

    if (!user.isEmailVerified) {
        throw new AppError(403, "EMAIL_NOT_VERIFIED", "Please verify your email");
    }

    if (!user.isActive) {
        throw new AppError(403, "ACCOUNT_DISABLED", "Account is disabled");
    }

    const isMatch = await bcrypt.compare(
        password,
        user.password
    );

    if (!isMatch) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const token = generateToken(user._id);

    return {
        token,
        user
    };
};

export const resendOtpService = async (email) => {
    email = email.toLowerCase();

    const user = await User.findOne({ email });

    if (!user) {
        throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    if (user.isEmailVerified) {
        throw new AppError(409, "EMAIL_ALREADY_VERIFIED", "Email already verified");
    }

    const otp = generateOtp();

    await redis.set(
        `otp:REGISTER:${email}`,
        otp,
        "EX",
        600
    );

    await sendEmail(
        email,
        "Verify Your Email",
        otpTemplate(user.name, otp)
    );
};

export const forgotPasswordService = async (email) => {
    email = email.toLowerCase();

    const user = await User.findOne({ email });

    if (!user) {
        throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const otp = generateOtp();

    await redis.set(
        `otp:FORGOT_PASSWORD:${email}`,
        otp,
        "EX",
        600
    );

    await sendEmail(
        email,
        "Reset Password OTP",
        otpTemplate(user.name, otp)
    );
};

export const resetPasswordService = async ({
    token,
    password
}) => {

    let payload;

    try {

        payload = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

    } catch {

        throw new AppError(422, "INVALID_RESET_TOKEN", "Invalid or expired reset token");

    }

    const user = await User.findOne({
        email: payload.email
    });

    if (!user) {
        throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    user.password = await bcrypt.hash(password, 10);

    await user.save();

    return true;
};