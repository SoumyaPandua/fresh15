import bcrypt from "bcryptjs";
import PartnerApplication from "./partnerApplication.model.js";
import User from "../user/user.model.js";
import AppError from "../../utils/AppError.js";
import { writeAuditLog } from "../audit/audit.service.js";

const normalizeVehicleNumber = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");

export const createOrUpdatePartnerApplicationService = async ({ name, email, phone, password, vehicleType, vehicleRegistrationNumber, vehicleMakeModel }) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const registration = normalizeVehicleNumber(vehicleRegistrationNumber);
  if (!/^[A-Z0-9-]{6,20}$/.test(registration)) {
    throw new AppError(422, "INVALID_VEHICLE_REGISTRATION", "Enter a valid vehicle registration number");
  }

  let user = await User.findOne({ email: normalizedEmail });

  const existingVehicle = await PartnerApplication.findOne({ vehicleRegistrationNumber: registration });
  if (existingVehicle && (!user || String(existingVehicle.userId) !== String(user._id))) {
    throw new AppError(409, "VEHICLE_ALREADY_REGISTERED", "Vehicle registration is already associated with an application");
  }
  if (user && !(user.portal === "partner" && user.role === "PARTNER")) {
    throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "Email already registered");
  }

  if (user) {
    const existingApplication = await PartnerApplication.findOne({ userId: user._id });
    if (existingApplication?.status === "APPROVED") throw new AppError(409, "PARTNER_ALREADY_APPROVED", "Partner account already approved");
    if (existingApplication?.status === "PENDING") throw new AppError(409, "APPLICATION_PENDING", "Partner application is already pending approval");
    existingApplication.vehicleType = vehicleType;
    existingApplication.vehicleRegistrationNumber = registration;
    existingApplication.vehicleMakeModel = vehicleMakeModel || "";
    existingApplication.status = "PENDING";
    existingApplication.rejectionReason = "";
    existingApplication.reviewedBy = null;
    existingApplication.reviewedAt = null;
    await existingApplication.save();
    user.name = name;
    user.phone = phone || "";
    user.password = await bcrypt.hash(password, 10);
    user.isActive = false;
    user.isEmailVerified = false;
    await user.save();
    return user;
  }

  user = await User.create({
    name,
    email: normalizedEmail,
    phone: phone || "",
    password: await bcrypt.hash(password, 10),
    role: "PARTNER",
    portal: "partner",
    isActive: false,
    isEmailVerified: false,
  });

  await PartnerApplication.create({
    userId: user._id,
    vehicleType,
    vehicleRegistrationNumber: registration,
    vehicleMakeModel: vehicleMakeModel || "",
    createdBy: user._id,
  });

  return user;
};

export const listPartnerApplicationsService = async ({ status = "PENDING", limit = 100 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const filter = status === "ALL" ? {} : { status };
  return PartnerApplication.find(filter)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .populate("userId", "name email phone isEmailVerified isActive role portal")
    .populate("reviewedBy", "name email")
    .lean();
};

const reviewApplication = async (id, adminId, status, rejectionReason = "") => {
  const application = await PartnerApplication.findOneAndUpdate(
    { _id: id, status: "PENDING" },
    { $set: { status, rejectionReason: status === "REJECTED" ? rejectionReason.trim() : "", reviewedBy: adminId, reviewedAt: new Date() } },
    { new: true },
  );

  if (!application) throw new AppError(409, "APPLICATION_ALREADY_REVIEWED", "Application is no longer pending");

  const user = await User.findById(application.userId);
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "Applicant account not found");

  if (status === "APPROVED") {
    if (!user.isEmailVerified) {
      application.status = "PENDING";
      application.reviewedBy = null;
      application.reviewedAt = null;
      await application.save();
      throw new AppError(422, "EMAIL_NOT_VERIFIED", "Applicant must verify their email before approval");
    }
    user.role = "PARTNER";
    user.portal = "partner";
    user.isActive = true;
    await user.save();
  } else {
    user.isActive = false;
    await user.save();
  }

  await writeAuditLog({
    actorId: adminId,
    action: status === "APPROVED" ? "PARTNER_APPLICATION_APPROVED" : "PARTNER_APPLICATION_REJECTED",
    resourceType: "PartnerApplication",
    resourceId: application._id,
    details: { userId: application.userId, vehicleRegistrationNumber: application.vehicleRegistrationNumber, rejectionReason: status === "REJECTED" ? rejectionReason.trim() : null },
    outcome: "SUCCESS",
    statusCode: 200,
  });

  return application;
};

export const approvePartnerApplicationService = (id, adminId) => reviewApplication(id, adminId, "APPROVED");
export const rejectPartnerApplicationService = (id, adminId, reason) => reviewApplication(id, adminId, "REJECTED", reason);
