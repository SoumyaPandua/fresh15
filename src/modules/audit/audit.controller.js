import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import { getAdminAuditLogsService } from "./audit.service.js";

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

    return sendResponse(res, 200, true, "Audit logs fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};
