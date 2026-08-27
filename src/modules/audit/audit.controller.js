import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import { getAdminAuditLogsService, writeAuditLog } from "./audit.service.js";

export const getAdminAuditLogs = async (req, res) => {
  try {
    const data = await getAdminAuditLogsService({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      action: req.query.action,
      resourceType: req.query.resourceType,
      ip: req.query.ip,
    });

    await writeAuditLog({
      actorId: req.user?._id,
      action: "AUDIT_LOG_VIEWED",
      resourceType: "AUDIT_LOG",
      details: { page: data.pagination.page, limit: data.pagination.limit },
      outcome: "SUCCESS",
      statusCode: 200,
      severity: "NOTICE",
    });

    return sendResponse(res, 200, true, "Audit logs fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};
