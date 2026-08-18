import Support from "./support.model.js";
import Counter from "../counter/counter.model.js";
import { uploadImage } from "../../config/cloudinary.js";
import AppError from "../../utils/AppError.js";
import { writeAuditLog } from "../audit/audit.service.js";

export const getAllSupportTicketsService = async () => {
  return await Support.find().populate("userId", "name email phone").sort({ createdAt: -1 });
};

export const getMySupportTicketsService = async (userId) => {
  return await Support.find({ userId }).sort({ createdAt: -1 });
};

export const getSupportTicketByIdService = async (id, userId, role) => {
  const query = role === "ADMIN" || role === "SUPER_ADMIN" ? { _id: id } : { _id: id, userId };
  const ticket = await Support.findOne(query).populate("userId", "name email phone");
  if (!ticket) throw new AppError(404, "SUPPORT_TICKET_NOT_FOUND", "Support ticket not found");
  return ticket;
};

export const createSupportTicketService = async (userId, body, files) => {
  const today = new Date();
  const date = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const counter = await Counter.findOneAndUpdate(
    { name: `SUP-${date}` },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  );
  const ticketNumber = `SUP-${date}-${String(counter.sequence).padStart(6, "0")}`;

  const attachments = [];
  for (const file of files || []) {
    try {
      const result = await uploadImage(file.buffer, "fresh15/support");
      attachments.push({
        url: result.secure_url,
        publicId: result.public_id,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      });
    } catch (error) {
      throw new AppError(502, "FILE_UPLOAD_FAILED", "Unable to upload support attachment", [error.message]);
    }
  }

  const ticket = await Support.create({
    ticketNumber,
    userId,
    subject: body.subject,
    description: body.description,
    attachments,
    category: body.category || "OTHER",
    priority: body.priority || "LOW",
    createdBy: userId,
  });

  return await Support.findById(ticket._id).populate("userId", "name email phone");
};

export const updateSupportTicketStatusService = async (id, body, userId) => {
  const ticket = await Support.findById(id);
  if (!ticket) throw new AppError(404, "SUPPORT_TICKET_NOT_FOUND", "Support ticket not found");

  const transitions = {
    OPEN: ["IN_PROGRESS", "CLOSED"],
    IN_PROGRESS: ["RESOLVED", "OPEN", "CLOSED"],
    RESOLVED: ["CLOSED", "IN_PROGRESS"],
    CLOSED: [],
  };
  if (ticket.status !== body.status && !transitions[ticket.status]?.includes(body.status)) {
    throw new AppError(409, "INVALID_SUPPORT_TRANSITION", `Cannot move support ticket from ${ticket.status} to ${body.status}`);
  }

  ticket.status = body.status;
  if (body.adminRemark !== undefined) ticket.adminRemark = body.adminRemark;
  ticket.updatedBy = userId;
  await ticket.save();
  return ticket;
};

export const deleteMySupportTicketService = async (id, userId) => {
  const ticket = await Support.findOne({ _id: id, userId });
  if (!ticket) throw new AppError(404, "SUPPORT_TICKET_NOT_FOUND", "Support ticket not found");
  if (!["OPEN", "CLOSED"].includes(ticket.status)) {
    throw new AppError(409, "SUPPORT_DELETE_CONFLICT", "Only open or closed support tickets can be deleted");
  }
  await ticket.deleteOne();
};

export const deleteAdminSupportTicketService = async (id, adminId) => {
  const ticket = await Support.findById(id);
  if (!ticket) throw new AppError(404, "SUPPORT_TICKET_NOT_FOUND", "Support ticket not found");
  await ticket.deleteOne();
  await writeAuditLog({ actorId: adminId, action: "SUPPORT_TICKET_DELETED", resourceType: "Support", resourceId: id });
};
