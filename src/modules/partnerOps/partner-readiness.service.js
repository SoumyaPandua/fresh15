import Profile from "../profile/profile.model.js";
import PartnerDocument from "./partnerDocument.model.js";
import AppError from "../../utils/AppError.js";

export const REQUIRED_PARTNER_DOCUMENTS = ["DRIVING_LICENSE", "RC", "INSURANCE", "PAN"];
const isExpired = (expiresAt) => Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());

export const getPartnerReadiness = async (partnerId) => {
  const profile = await Profile.findOne({ userId: partnerId, role: "PARTNER" }).lean();
  const documents = await PartnerDocument.find({ partnerId }).lean();
  const byType = new Map(documents.map((doc) => [doc.type, doc]));
  const missingDocuments = [];
  const expiredDocuments = [];
  const rejectedDocuments = [];

  for (const type of REQUIRED_PARTNER_DOCUMENTS) {
    const doc = byType.get(type);
    if (!doc || !String(doc.documentNumber || "").trim()) {
      missingDocuments.push(type);
      continue;
    }
    if (doc.status === "REJECTED") rejectedDocuments.push(type);
    if (isExpired(doc.expiresAt)) expiredDocuments.push(type);
  }

  const bankComplete = Boolean(profile?.bankName && profile?.accountHolderName && profile?.accountNumber && profile?.ifscCode);
  return {
    ready: bankComplete && !missingDocuments.length && !expiredDocuments.length && !rejectedDocuments.length,
    bankComplete,
    missingDocuments,
    expiredDocuments,
    rejectedDocuments,
  };
};

export const assertPartnerCanAcceptOrders = async (partnerId) => {
  const readiness = await getPartnerReadiness(partnerId);
  if (!readiness.bankComplete) throw new AppError(409, "PARTNER_BANK_DETAILS_REQUIRED", "Add your bank details before accepting orders");
  if (readiness.missingDocuments.length) throw new AppError(409, "PARTNER_KYC_REQUIRED", "Complete all required KYC documents before accepting orders");
  if (readiness.expiredDocuments.length) throw new AppError(409, "PARTNER_KYC_EXPIRED", "One or more KYC documents have expired. Update them before accepting orders");
  if (readiness.rejectedDocuments.length) throw new AppError(409, "PARTNER_KYC_REJECTED", "One or more KYC documents were rejected. Update them before accepting orders");
  return readiness;
};
