import sendResponse from "../../utils/sendResponse.js";

import {
    createOfferService,
    deleteOfferService,
    getActiveOffersService,
    getAllOffersService,
    getOfferByIdService,
    updateOfferService,
    updateOfferStatusService,
} from "./offer.service.js";

export const getAllOffers = async (
    req,
    res
) => {
    try {
        const data =
            await getAllOffersService();

        return sendResponse(
            res,
            200,
            true,
            "Offers fetched successfully",
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

export const getOfferById = async (
    req,
    res
) => {
    try {
        const data =
            await getOfferByIdService(
                req.params.id
            );

        return sendResponse(
            res,
            200,
            true,
            "Offer fetched successfully",
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

export const getActiveOffers = async (
    req,
    res
) => {
    try {
        const data =
            await getActiveOffersService();

        return sendResponse(
            res,
            200,
            true,
            "Active offers fetched successfully",
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

export const createOffer = async (
    req,
    res
) => {
    try {
        const data =
            await createOfferService(
                req.body,
                req.user._id
            );

        return sendResponse(
            res,
            201,
            true,
            "Offer created successfully",
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

export const updateOffer = async (
    req,
    res
) => {
    try {
        const data =
            await updateOfferService(
                req.params.id,
                req.body,
                req.user._id
            );

        return sendResponse(
            res,
            200,
            true,
            "Offer updated successfully",
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

export const updateOfferStatus =
    async (req, res) => {
        try {
            const data =
                await updateOfferStatusService(
                    req.params.id,
                    req.body.isActive,
                    req.user._id
                );

            return sendResponse(
                res,
                200,
                true,
                "Offer status updated successfully",
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

export const deleteOffer = async (
    req,
    res
) => {
    try {
        await deleteOfferService(
            req.params.id,
            req.user._id
        );

        return sendResponse(
            res,
            200,
            true,
            "Offer deleted successfully"
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