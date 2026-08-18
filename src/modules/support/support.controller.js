import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import {
  createSupportTicketService, deleteMySupportTicketService, deleteAdminSupportTicketService,
  getAllSupportTicketsService, getMySupportTicketsService, getSupportTicketByIdService,
  updateSupportTicketStatusService,
} from "./support.service.js";

export const getAllSupportTickets = async (req, res) => {
  try { return sendResponse(res, 200, true, "Support tickets fetched successfully", await getAllSupportTicketsService()); }
  catch (error) { return sendError(res, error); }
};
export const getMySupportTickets = async (req, res) => {
  try { return sendResponse(res, 200, true, "Support tickets fetched successfully", await getMySupportTicketsService(req.user._id)); }
  catch (error) { return sendError(res, error); }
};
export const getSupportTicketById = async (req, res) => {
  try { return sendResponse(res, 200, true, "Support ticket fetched successfully", await getSupportTicketByIdService(req.params.id, req.user._id, req.user.role)); }
  catch (error) { return sendError(res, error); }
};
export const createSupportTicket = async (req, res) => {
  try { return sendResponse(res, 201, true, "Support ticket created successfully", await createSupportTicketService(req.user._id, req.body, req.files)); }
  catch (error) { return sendError(res, error); }
};
export const updateSupportTicketStatus = async (req, res) => {
  try { return sendResponse(res, 200, true, "Support ticket updated successfully", await updateSupportTicketStatusService(req.params.id, req.body, req.user._id)); }
  catch (error) { return sendError(res, error); }
};
export const deleteMySupportTicket = async (req, res) => {
  try { await deleteMySupportTicketService(req.params.id, req.user._id); return res.status(204).send(); }
  catch (error) { return sendError(res, error); }
};
export const deleteAdminSupportTicket = async (req, res) => {
  try { await deleteAdminSupportTicketService(req.params.id, req.user._id); return res.status(204).send(); }
  catch (error) { return sendError(res, error); }
};
