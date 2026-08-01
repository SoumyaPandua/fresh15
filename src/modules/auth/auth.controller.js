import { validationResult } from "express-validator";
import { registerService, verifyOtpService, loginService, resendOtpService, forgotPasswordService, resetPasswordService } from "./auth.service.js";
import sendResponse from "../../utils/sendResponse.js";

export const register = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return sendResponse(
                res,
                400,
                false,
                "Validation Failed",
                errors.array()
            );
        }

        const user = await registerService(req.body);

        return sendResponse(
            res,
            201,
            true,
            "Registration successful. OTP sent to email.",
            {
                id: user._id,
                name: user.name,
                email: user.email
            }
        );
    } catch (error) {
        return sendResponse(
            res,
            400,
            false,
            error.message
        );
    }
};

export const verifyOtp = async (req, res) => {
    try {

        const data = await verifyOtpService(req.body);

        return sendResponse(
            res,
            200,
            true,
            "OTP verified successfully",
            data
        );

    } catch (error) {

        return sendResponse(
            res,
            400,
            false,
            error.message
        );

    }
};

export const login = async (req, res) => {
    try {
        const result = await loginService(req.body);

        return sendResponse(
            res,
            200,
            true,
            "Login successful",
            result
        );
    } catch (error) {
        return sendResponse(
            res,
            400,
            false,
            error.message
        );
    }
};

export const resendOtp = async (req, res) => {
    try {
        await resendOtpService(req.body.email);

        return sendResponse(
            res,
            200,
            true,
            "OTP sent successfully"
        );
    } catch (error) {
        return sendResponse(
            res,
            400,
            false,
            error.message
        );
    }
};

export const forgotPassword = async (req, res) => {

    try {

        await forgotPasswordService(req.body.email);

        return sendResponse(
            res,
            200,
            true,
            "OTP sent successfully"
        );

    } catch (error) {

        return sendResponse(
            res,
            400,
            false,
            error.message
        );

    }

};

export const resetPassword = async (req, res) => {

    try {

        await resetPasswordService(req.body);

        return sendResponse(
            res,
            200,
            true,
            "Password reset successful"
        );

    } catch (error) {

        return sendResponse(
            res,
            400,
            false,
            error.message
        );

    }

};

export const me = async (req, res) => {
    return sendResponse(
        res,
        200,
        true,
        "Current user",
        req.user
    );
};