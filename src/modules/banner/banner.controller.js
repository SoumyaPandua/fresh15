import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import { createBannerService, deleteBannerService, getActiveBannersService, getAllBannersService, updateBannerService, updateBannerStatusService } from "./banner.service.js";

export const getAllBanners = async (req, res) => {
    try {
        const data = await getAllBannersService();
        return sendResponse(res, 200, true, "Banners fetched successfully", data);
    } catch (error) {
    return sendError(res, error);
  }
};

export const getActiveBanners = async (req, res) => {
    try {
        const data = await getActiveBannersService();
        return sendResponse(res, 200, true, "Active banners fetched successfully", data);
    } catch (error) {
    return sendError(res, error);
  }
};

export const createBanner = async (req, res) => {
    try {
        const data = await createBannerService(req.body, req.file, req.user._id);
        return sendResponse(res, 201, true, "Banner created successfully", data);
    } catch (error) {
    return sendError(res, error);
  }
};

export const updateBanner = async (req, res) => {
    try {
        const data = await updateBannerService(req.params.id, req.body, req.file, req.user._id);
        return sendResponse(res, 200, true, "Banner updated successfully", data);
    } catch (error) {
    return sendError(res, error);
  }
};

export const updateBannerStatus = async (req, res) => {
    try {
        const data = await updateBannerStatusService(req.params.id, req.body.isActive, req.user._id);
        return sendResponse(res, 200, true, "Banner status updated successfully", data);
    } catch (error) {
    return sendError(res, error);
  }
};

export const deleteBanner = async (req, res) => {
    try {
        await deleteBannerService(req.params.id, req.user._id);
        return sendResponse(res, 200, true, "Banner deleted successfully");
    } catch (error) {
    return sendError(res, error);
  }
};