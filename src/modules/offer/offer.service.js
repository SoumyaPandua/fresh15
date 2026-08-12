import Offer from "./offer.model.js";

export const getAllOffersService = async () => {
    return await Offer.find({
        isDeleted: false,
    })
        .sort({
            createdAt: -1,
        })
        .populate(
            "createdBy",
            "name email"
        )
        .populate(
            "updatedBy",
            "name email"
        );
};

export const getOfferByIdService = async (id) => {
    const offer = await Offer.findOne({
        _id: id,
        isDeleted: false,
    })
        .populate(
            "createdBy",
            "name email"
        )
        .populate(
            "updatedBy",
            "name email"
        );

    if (!offer) {
        throw new Error("Offer not found");
    }

    return offer;
};

export const getActiveOffersService = async () => {
    return await Offer.find({
        isDeleted: false,
        isActive: true,
    }).sort({
        createdAt: -1,
    });
};

export const createOfferService = async (
    body,
    userId
) => {
    const title = body.title?.trim();
    const category = body.category?.trim().toLowerCase();

    if (!title) {
        throw new Error("Offer title is required");
    }

    if (!category) {
        throw new Error("Offer category is required");
    }

    const offer = await Offer.create({
        title,
        description:
            body.description?.trim() || "",
        discount: body.discount?.trim(),
        category,
        isActive:
            body.isActive !== undefined
                ? body.isActive
                : true,
        createdBy: userId,
    });

    return await getOfferByIdService(
        offer._id
    );
};

export const updateOfferService = async (
    id,
    body,
    userId
) => {
    const offer = await Offer.findOne({
        _id: id,
        isDeleted: false,
    });

    if (!offer) {
        throw new Error("Offer not found");
    }

    if (body.title !== undefined) {
        offer.title = body.title.trim();
    }

    if (body.description !== undefined) {
        offer.description =
            body.description.trim();
    }

    if (body.discount !== undefined) {
        offer.discount =
            body.discount.trim();
    }

    if (body.category !== undefined) {
        offer.category =
            body.category.trim().toLowerCase();
    }

    if (body.isActive !== undefined) {
        offer.isActive = body.isActive;
    }

    offer.updatedBy = userId;

    await offer.save();

    return await getOfferByIdService(
        offer._id
    );
};

export const updateOfferStatusService =
    async (
        id,
        isActive,
        userId
    ) => {
        const offer = await Offer.findOne({
            _id: id,
            isDeleted: false,
        });

        if (!offer) {
            throw new Error("Offer not found");
        }

        offer.isActive = isActive;
        offer.updatedBy = userId;

        await offer.save();

        return await getOfferByIdService(
            offer._id
        );
    };

export const deleteOfferService = async (
    id,
    userId
) => {
    const offer = await Offer.findOne({
        _id: id,
        isDeleted: false,
    });

    if (!offer) {
        throw new Error("Offer not found");
    }

    offer.isDeleted = true;
    offer.isActive = false;
    offer.updatedBy = userId;

    await offer.save();

    return;
};