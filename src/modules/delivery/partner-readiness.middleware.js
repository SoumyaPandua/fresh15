import { assertPartnerCanAcceptOrders } from "../partnerOps/partner-readiness.service.js";
import { sendError } from "../../utils/errorResponse.js";

export default async function partnerReadinessMiddleware(req, res, next) {
  try {
    if (req.user?.role === "PARTNER" && String(req.body?.status || "").toUpperCase() === "ACCEPTED") {
      await assertPartnerCanAcceptOrders(req.user._id);
    }
    return next();
  } catch (error) {
    return sendError(res, error);
  }
}
