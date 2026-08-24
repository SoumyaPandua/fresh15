import { writeAuditLog } from "../modules/audit/audit.service.js";

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    void writeAuditLog({
      actorId: req.user?._id ?? null,
      action: "AUTHZ_DENIED",
      resourceType: "Authorization",
      details: {
        requiredRoles: roles,
        actualRole: req.user?.role ?? null,
        method: req.method,
        path: req.originalUrl || req.url,
      },
      outcome: "FAILURE",
      statusCode: 403,
    });

    return res.status(403).json({
      success: false,
      message: "Access denied",
      code: "FORBIDDEN",
      data: null,
      errors: [],
    });
  }

  next();
};

export default authorize;
