
import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import {
  getOverviewService,
  getQueueService,
  getEarningsService,
  getCashService,
  reconcileCashService,
  getShiftsService,
  createShiftService,
  cancelShiftService,
  getDocumentsService,
  upsertDocumentService,
  pausePartnerService,
  resumePartnerService,
  createIncidentService,
  getIncidentsService,
  getAdminPartnerOpsOverviewService,
  getAdminIncidentsService,
  resolveIncidentService,
  getAdminShiftsService,
  getAdminCashService,
  createIncentiveService,
} from "./partnerOps.service.js";

const ok = (fn, status = 200, message = "Operation successful") => async (req, res) => {
  try {
    return sendResponse(res, status, true, message, await fn(req));
  } catch (error) {
    return sendError(res, error);
  }
};

export const getOverview = ok((req) => getOverviewService(req.user._id), 200, "Partner operations overview fetched");
export const getQueue = ok((req) => getQueueService(req.user._id), 200, "Route queue fetched");
export const getEarnings = ok((req) => getEarningsService(req.user._id, req.query), 200, "Partner earnings fetched");
export const getCash = ok((req) => getCashService(req.user._id), 200, "Cash position fetched");
export const reconcileCash = ok((req) => reconcileCashService(req.user._id, req.body.amount, req.body.note), 200, "Cash reconciliation recorded");
export const getShifts = ok((req) => getShiftsService(req.user._id), 200, "Shifts fetched");
export const createShift = ok((req) => createShiftService(req.user._id, req.body), 201, "Shift scheduled");
export const cancelShift = ok((req) => cancelShiftService(req.user._id, req.params.id), 200, "Shift cancelled");
export const getDocuments = ok((req) => getDocumentsService(req.user._id), 200, "Documents fetched");
export const upsertDocument = ok((req) => upsertDocumentService(req.user._id, req.body), 200, "Document updated");
export const pause = ok((req) => pausePartnerService(req.user._id, req.body.minutes, req.body.reason), 200, "Break started");
export const resume = ok((req) => resumePartnerService(req.user._id), 200, "Break ended");
export const createIncident = ok((req) => createIncidentService(req.user._id, req.body), 201, "Incident reported");
export const getIncidents = ok((req) => getIncidentsService(req.user._id), 200, "Incidents fetched");

/* Admin */
export const adminOverview = ok(() => getAdminPartnerOpsOverviewService(), 200, "Partner operations overview fetched");
export const adminIncidents = ok((req) => getAdminIncidentsService(req.query), 200, "Partner incidents fetched");
export const resolveIncident = ok(
  (req) => resolveIncidentService(req.params.id, req.user._id, req.body.status, req.body.resolutionNote),
  200,
  "Incident updated"
);
export const adminShifts = ok((req) => getAdminShiftsService(req.query), 200, "Partner shifts fetched");
export const adminCash = ok((req) => getAdminCashService(req.query), 200, "Partner cash ledger fetched");
export const createIncentive = ok((req) => createIncentiveService(req.user._id, req.body), 201, "Incentive created");
