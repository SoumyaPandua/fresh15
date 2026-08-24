import jwt from "jsonwebtoken";
import User from "../modules/user/user.model.js";
import AppError from "../utils/AppError.js";
import { writeAuditLog } from "../modules/audit/audit.service.js";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication token is required");
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication token is required");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "User session is no longer valid");
    }

    if (user.isActive === false || user.isDisabled === true) {
      throw new AppError(403, "ACCOUNT_DISABLED", "Account is disabled");
    }

    req.user = user;
    return next();
  } catch (error) {
    void writeAuditLog({
      actorId: null,
      action: "AUTHN_FAILED",
      resourceType: "Authentication",
      details: {
        reason: error?.code || error?.message || "INVALID_TOKEN",
        method: req.method,
        path: req.originalUrl || req.url,
      },
      outcome: "FAILURE",
      statusCode: error instanceof AppError ? error.statusCode : 401,
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        data: null,
        errors: error.details || [],
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
      code: "UNAUTHORIZED",
      data: null,
      errors: [],
    });
  }
};

export default authMiddleware;
