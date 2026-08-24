import Offer from "./offer.model.js";
import Coupon from "../coupon/coupon.model.js";
import { writeAuditLog } from "../audit/audit.service.js";

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

const validateCouponLink = async (code) => {
    if (!code) return;
    const coupon = await Coupon.findOne({ code: code.toUpperCase() }).select("_id code isActive validFrom validUntil");
    if (!coupon) throw new Error("Linked coupon code does not exist");
};

export const getAllOffersService = async () => {
    return await Offer.find({ isDeleted: false })
        .sort({ priority: -1, createdAt: -1 })
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email");
};

export const getOfferByIdService = async (id) => {
    const offer = await Offer.findOne({ _id: id, isDeleted: false })
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email");
    if (!offer) throw new Error("Offer not found");
    return offer;
};

export const getActiveOffersService = async ({ placement } = {}) => {
    const query = activeWindow();
    if (placement) query.placement = placement;
    return await Offer.find(query).sort({ priority: -1, createdAt: -1 });
};

export const createOfferService = async (body, userId) => {
    const title = body.title?.trim();
    const category = body.category?.trim().toLowerCase();

    if (!title) throw new Error("Offer title is required");
    if (!category) throw new Error("Offer category is required");

    const couponCode = body.couponCode?.trim().toUpperCase() || "";
    await validateCouponLink(couponCode);

    const offer = await Offer.create({
        title,
        description: body.description?.trim() || "",
        discount: body.discount?.trim(),
        category,
        placement: body.placement?.trim() || "HOME",
        ctaText: body.ctaText?.trim() || "View offer",
        targetType: body.targetType || "SEARCH",
        targetValue: body.targetValue?.trim() || "",
        couponCode,
        priority: body.priority ?? 0,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        isActive: body.isActive !== undefined ? body.isActive : true,
        createdBy: userId,
    });

    const result = await getOfferByIdService(offer._id);
    await writeAuditLog({
        actorId: userId,
        action: "OFFER_CREATED",
        resourceType: "Offer",
        resourceId: offer._id,
        details: { title: offer.title, placement: offer.placement, couponCode: offer.couponCode || null },
        outcome: "SUCCESS",
        statusCode: 201,
    });
    return result;
};

export const updateOfferService = async (id, body, userId) => {
    const offer = await Offer.findOne({ _id: id, isDeleted: false });
    if (!offer) throw new Error("Offer not found");

    const couponCode = body.couponCode !== undefined ? body.couponCode.trim().toUpperCase() : offer.couponCode;
    await validateCouponLink(couponCode);

    const before = {
        title: offer.title,
        discount: offer.discount,
        category: offer.category,
        placement: offer.placement,
        couponCode: offer.couponCode,
        isActive: offer.isActive,
    };

    if (body.title !== undefined) offer.title = body.title.trim();
    if (body.description !== undefined) offer.description = body.description.trim();
    if (body.discount !== undefined) offer.discount = body.discount.trim();
    if (body.category !== undefined) offer.category = body.category.trim().toLowerCase();
    if (body.placement !== undefined) offer.placement = body.placement.trim() || "HOME";
    if (body.ctaText !== undefined) offer.ctaText = body.ctaText.trim() || "View offer";
    if (body.targetType !== undefined) offer.targetType = body.targetType;
    if (body.targetValue !== undefined) offer.targetValue = body.targetValue.trim();
    if (body.couponCode !== undefined) offer.couponCode = couponCode;
    if (body.priority !== undefined) offer.priority = Number(body.priority);
    if (body.startsAt !== undefined) offer.startsAt = body.startsAt ? new Date(body.startsAt) : null;
    if (body.endsAt !== undefined) offer.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (body.isActive !== undefined) offer.isActive = body.isActive;

    offer.updatedBy = userId;
    await offer.save();

    const result = await getOfferByIdService(offer._id);
    await writeAuditLog({
        actorId: userId,
        action: "OFFER_UPDATED",
        resourceType: "Offer",
        resourceId: offer._id,
        details: { before, after: { title: offer.title, discount: offer.discount, category: offer.category, placement: offer.placement, couponCode: offer.couponCode, isActive: offer.isActive } },
        outcome: "SUCCESS",
        statusCode: 200,
    });
    return result;
};

export const updateOfferStatusService = async (id, isActive, userId) => {
    const offer = await Offer.findOne({ _id: id, isDeleted: false });
    if (!offer) throw new Error("Offer not found");

    offer.isActive = isActive;
    offer.updatedBy = userId;
    await offer.save();

    await writeAuditLog({
        actorId: userId,
        action: isActive ? "OFFER_ACTIVATED" : "OFFER_DEACTIVATED",
        resourceType: "Offer",
        resourceId: offer._id,
        details: { isActive },
        outcome: "SUCCESS",
        statusCode: 200,
    });

    return await getOfferByIdService(offer._id);
};

export const deleteOfferService = async (id, userId) => {
    const offer = await Offer.findOne({ _id: id, isDeleted: false });
    if (!offer) throw new Error("Offer not found");

    offer.isDeleted = true;
    offer.isActive = false;
    offer.updatedBy = userId;
    await offer.save();

    await writeAuditLog({
        actorId: userId,
        action: "OFFER_DELETED",
        resourceType: "Offer",
        resourceId: offer._id,
        details: { title: offer.title },
        outcome: "SUCCESS",
        statusCode: 200,
    });
};
