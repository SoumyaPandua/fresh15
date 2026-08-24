import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import {
    createOfferService,
    deleteOfferService,
    getActiveOffersService,
    getAllOffersService,
    getOfferByIdService,
    updateOfferService,
    updateOfferStatusService,
} from "./offer.service.js";

export const getAllOffers = async (req, res) => {
    try {
        return sendResponse(res, 200, true, "Offers fetched successfully", await getAllOffersService());
    } catch (error) {
        return sendError(res, error);
    }
};

export const getOfferById = async (req, res) => {
    try {
        return sendResponse(res, 200, true, "Offer fetched successfully", await getOfferByIdService(req.params.id));
    } catch (error) {
        return sendError(res, error);
    }
};

export const getActiveOffers = async (req, res) => {
    try {
        return sendResponse(res, 200, true, "Active offers fetched successfully", await getActiveOffersService({ placement: req.query.placement }));
    } catch (error) {
        return sendError(res, error);
    }
};

export const createOffer = async (req, res) => {
    try {
        return sendResponse(res, 201, true, "Offer created successfully", await createOfferService(req.body, req.user._id));
    } catch (error) {
        return sendError(res, error);
    }
};

export const updateOffer = async (req, res) => {
    try {
        return sendResponse(res, 200, true, "Offer updated successfully", await updateOfferService(req.params.id, req.body, req.user._id));
    } catch (error) {
        return sendError(res, error);
    }
};

export const updateOfferStatus = async (req, res) => {
    try {
        return sendResponse(res, 200, true, "Offer status updated successfully", await updateOfferStatusService(req.params.id, req.body.isActive, req.user._id));
    } catch (error) {
        return sendError(res, error);
    }
};

export const deleteOffer = async (req, res) => {
    try {
        await deleteOfferService(req.params.id, req.user._id);
        return sendResponse(res, 200, true, "Offer deleted successfully");
    } catch (error) {
        return sendError(res, error);
    }
};
