import sendResponse from "../../utils/sendResponse.js";

import {
  createSupportTicketService,
  deleteSupportTicketService,
  getAllSupportTicketsService,
  getMySupportTicketsService,
  getSupportTicketByIdService,
  updateSupportTicketStatusService,
} from "./support.service.js";

export const getAllSupportTickets =
  async (req, res) => {
    try {
      const data =
        await getAllSupportTicketsService();

      return sendResponse(
        res,
        200,
        true,
        "Support tickets fetched successfully",
        data
      );
    } catch (error) {
      return sendResponse(
        res,
        400,
        false,
        error.message
      );
    }
  };

export const getMySupportTickets =
  async (req, res) => {
    try {
      const data =
        await getMySupportTicketsService(
          req.user._id
        );

      return sendResponse(
        res,
        200,
        true,
        "Support tickets fetched successfully",
        data
      );
    } catch (error) {
      return sendResponse(
        res,
        400,
        false,
        error.message
      );
    }
  };

export const getSupportTicketById =
  async (req, res) => {
    try {
      const data =
        await getSupportTicketByIdService(
          req.params.id,
          req.user._id
        );

      return sendResponse(
        res,
        200,
        true,
        "Support ticket fetched successfully",
        data
      );
    } catch (error) {
      return sendResponse(
        res,
        400,
        false,
        error.message
      );
    }
  };

export const createSupportTicket =
  async (req, res) => {
    try {
      const data =
        await createSupportTicketService(
          req.user._id,
          req.body,
          req.files
        );

      return sendResponse(
        res,
        201,
        true,
        "Support ticket created successfully",
        data
      );
    } catch (error) {
      return sendResponse(
        res,
        400,
        false,
        error.message
      );
    }
  };

export const updateSupportTicketStatus =
  async (req, res) => {
    try {
      const data =
        await updateSupportTicketStatusService(
          req.params.id,
          req.body,
          req.user._id
        );

      return sendResponse(
        res,
        200,
        true,
        "Support ticket updated successfully",
        data
      );
    } catch (error) {
      return sendResponse(
        res,
        400,
        false,
        error.message
      );
    }
  };

export const deleteSupportTicket =
  async (req, res) => {
    try {
      await deleteSupportTicketService(
        req.params.id,
        req.user._id
      );

      return sendResponse(
        res,
        200,
        true,
        "Support ticket deleted successfully"
      );
    } catch (error) {
      return sendResponse(
        res,
        400,
        false,
        error.message
      );
    }
  };