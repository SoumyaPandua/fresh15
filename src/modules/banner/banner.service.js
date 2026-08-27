import Banner from "./banner.model.js";
import { uploadImage } from "../../config/cloudinary.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { cached, cacheDeleteByPrefix } from "../../utils/cache.js";

const activeWindow = () => {
  const now = new Date();
  return {
    isDeleted: false,
    isActive: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  };
};

const getBannerByIdService = async (id) => {
  const banner = await Banner.findOne({ _id: id, isDeleted: false })
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");
  if (!banner) throw new Error("Banner not found");
  return banner;
};

const invalidate = () => cacheDeleteByPrefix("customer:banners");

export const getAllBannersService = async () => Banner.find({ isDeleted: false })
  .sort({ priority: -1, createdAt: -1 })
  .populate("createdBy", "name email")
  .populate("updatedBy", "name email");

export const getActiveBannersService = async ({ placement } = {}) => cached(
  `customer:banners:active:${placement || "ALL"}`,
  120,
  () => {
    const query = activeWindow();
    if (placement) query.placement = placement;
    return Banner.find(query).sort({ priority: -1, createdAt: -1 }).lean();
  },
);

export const createBannerService = async (body, file, userId) => {
  if (!file) throw new Error("Banner image is required");
  const uploaded = await uploadImage(file.buffer, "fresh15/banners");
  const banner = await Banner.create({
    title: body.title.trim(),
    subtitle: body.subtitle?.trim() || "",
    placement: body.placement?.trim() || "HOME_PROMO",
    image: uploaded.secure_url,
    imagePublicId: uploaded.public_id,
    ctaText: body.ctaText?.trim() || "Shop now",
    targetType: body.targetType || "SEARCH",
    targetValue: body.targetValue?.trim() || "",
    priority: body.priority ?? 0,
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
    isActive: body.isActive !== undefined ? body.isActive : true,
    createdBy: userId,
  });
  const result = await getBannerByIdService(banner._id);
  await invalidate();
  await writeAuditLog({ actorId: userId, action: "BANNER_CREATED", resourceType: "Banner", resourceId: banner._id, details: { title: banner.title, placement: banner.placement }, outcome: "SUCCESS", statusCode: 201 });
  return result;
};

export const updateBannerService = async (id, body, file, userId) => {
  const banner = await Banner.findOne({ _id: id, isDeleted: false });
  if (!banner) throw new Error("Banner not found");
  if (body.title !== undefined) banner.title = body.title.trim();
  if (body.subtitle !== undefined) banner.subtitle = body.subtitle.trim();
  if (body.placement !== undefined) banner.placement = body.placement.trim() || "HOME_PROMO";
  if (body.ctaText !== undefined) banner.ctaText = body.ctaText.trim() || "Shop now";
  if (body.targetType !== undefined) banner.targetType = body.targetType;
  if (body.targetValue !== undefined) banner.targetValue = body.targetValue.trim();
  if (body.priority !== undefined) banner.priority = Number(body.priority);
  if (body.startsAt !== undefined) banner.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.endsAt !== undefined) banner.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (body.isActive !== undefined) banner.isActive = body.isActive;
  if (file) {
    const uploaded = await uploadImage(file.buffer, "fresh15/banners");
    banner.image = uploaded.secure_url;
    banner.imagePublicId = uploaded.public_id;
  }
  banner.updatedBy = userId;
  await banner.save();
  await invalidate();
  return getBannerByIdService(banner._id);
};

export const updateBannerStatusService = async (id, isActive, userId) => {
  const banner = await Banner.findOne({ _id: id, isDeleted: false });
  if (!banner) throw new Error("Banner not found");
  banner.isActive = isActive;
  banner.updatedBy = userId;
  await banner.save();
  await invalidate();
  return banner;
};

export const deleteBannerService = async (id, userId) => {
  const banner = await Banner.findOne({ _id: id, isDeleted: false });
  if (!banner) throw new Error("Banner not found");
  banner.isDeleted = true;
  banner.isActive = false;
  banner.updatedBy = userId;
  await banner.save();
  await invalidate();
};
