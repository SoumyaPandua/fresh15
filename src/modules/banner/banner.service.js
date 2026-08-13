import Banner from "./banner.model.js";
import { uploadImage } from "../../config/cloudinary.js";

const getBannerByIdService = async (id) => {
    const banner = await Banner.findOne({ _id: id, isDeleted: false }).populate("createdBy", "name email").populate("updatedBy", "name email");
    if (!banner) throw new Error("Banner not found");
    return banner;
};

export const getAllBannersService = async () => {
    return await Banner.find({ isDeleted: false }).sort({ createdAt: -1 }).populate("createdBy", "name email").populate("updatedBy", "name email");
};

export const getActiveBannersService = async () => {
    return await Banner.find({ isDeleted: false, isActive: true }).sort({ createdAt: -1 });
};

export const createBannerService = async (body, file, userId) => {
    if (!file) throw new Error("Banner image is required");

    const uploaded = await uploadImage(file.buffer, "fresh15/banners");

    const banner = await Banner.create({
        title: body.title.trim(),
        subtitle: body.subtitle?.trim() || "",
        placement: body.placement.trim(),
        image: uploaded.secure_url,
        imagePublicId: uploaded.public_id,
        isActive: body.isActive !== undefined ? body.isActive : true,
        createdBy: userId,
    });

    return await getBannerByIdService(banner._id);
};

export const updateBannerService = async (id, body, file, userId) => {
    const banner = await Banner.findOne({ _id: id, isDeleted: false });
    if (!banner) throw new Error("Banner not found");

    if (body.title !== undefined) banner.title = body.title.trim();
    if (body.subtitle !== undefined) banner.subtitle = body.subtitle.trim();
    if (body.placement !== undefined) banner.placement = body.placement.trim();
    if (body.isActive !== undefined) banner.isActive = body.isActive;

    if (file) {
        const uploaded = await uploadImage(file.buffer, "fresh15/banners");
        banner.image = uploaded.secure_url;
        banner.imagePublicId = uploaded.public_id;
    }

    banner.updatedBy = userId;
    await banner.save();

    return await getBannerByIdService(banner._id);
};

export const updateBannerStatusService = async (id, isActive, userId) => {
    const banner = await Banner.findOne({ _id: id, isDeleted: false });
    if (!banner) throw new Error("Banner not found");

    banner.isActive = isActive;
    banner.updatedBy = userId;
    await banner.save();

    return banner;
};

export const deleteBannerService = async (id, userId) => {
    const banner = await Banner.findOne({ _id: id, isDeleted: false });
    if (!banner) throw new Error("Banner not found");

    banner.isDeleted = true;
    banner.isActive = false;
    banner.updatedBy = userId;
    await banner.save();
};