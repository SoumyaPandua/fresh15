import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../user/user.model.js";
import redis from "../../config/redis.js";
import generateOtp from "../../utils/generateOtp.js";
import sendEmail from "../../utils/sendEmail.js";
import otpTemplate from "../../templates/otpTemplate.js";
import generateToken from "../../utils/generateToken.js";

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
        throw new Error("Email already registered");
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
        throw new Error("OTP expired");
    }

    if (savedOtp !== otp) {
        throw new Error("Invalid OTP");
    }

    if (purpose === "REGISTER") {
        const user = await User.findOne({ email });

        if (!user) {
            throw new Error("User not found");
        }

        user.isEmailVerified = true;

        await user.save();

        await redis.del(key);

        return null;
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

    await Otp.deleteMany({
        email,
        purpose
    });

    return {
        resetToken
    };
};

export const loginService = async ({
    email,
    password,
    portal
}) => {
    email = email.toLowerCase();

    const user = await User.findOne({ email });

    if (!user) {
        throw new Error("Invalid email or password");
    }

    if (user.portal !== portal) {
        throw new Error("Unauthorized portal");
    }

    if (!user.isEmailVerified) {
        throw new Error("Please verify your email");
    }

    if (!user.isActive) {
        throw new Error("Account is disabled");
    }

    const isMatch = await bcrypt.compare(
        password,
        user.password
    );

    if (!isMatch) {
        throw new Error("Invalid email or password");
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
        throw new Error("User not found");
    }

    if (user.isEmailVerified) {
        throw new Error("Email already verified");
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
        throw new Error("User not found");
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

        throw new Error("Invalid or expired reset token");

    }

    const user = await User.findOne({
        email: payload.email
    });

    if (!user) {
        throw new Error("User not found");
    }

    user.password = await bcrypt.hash(password, 10);

    await user.save();

    return true;
};