import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import { applyReferralCodeService, calculateRedemptionService, getAdminLoyaltyLedgerService, getAdminLoyaltySummaryService, getLoyaltyOverviewService } from "./loyalty.service.js";

export const getMyLoyalty = async (req, res) => { try { return sendResponse(res, 200, true, "Loyalty wallet fetched", await getLoyaltyOverviewService(req.user._id)); } catch (e) { return sendError(res, e); } };
export const applyReferral = async (req, res) => { try { return sendResponse(res, 200, true, "Referral code applied", await applyReferralCodeService(req.user._id, req.body.code)); } catch (e) { return sendError(res, e); } };
export const previewRedemption = async (req, res) => { try { return sendResponse(res, 200, true, "Redemption preview ready", await calculateRedemptionService(req.user._id, req.body.subtotal, req.body.points)); } catch (e) { return sendError(res, e); } };
export const getAdminLoyaltySummary = async (req, res) => { try { return sendResponse(res, 200, true, "Loyalty summary fetched", await getAdminLoyaltySummaryService()); } catch (e) { return sendError(res, e); } };
export const getAdminLoyaltyLedger = async (req, res) => { try { return sendResponse(res, 200, true, "Loyalty ledger fetched", await getAdminLoyaltyLedgerService(req.query.limit)); } catch (e) { return sendError(res, e); } };
