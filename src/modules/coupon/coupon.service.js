import Coupon from "./coupon.model.js";

export const getAllCouponsService = async () => {
  return await Coupon.find().sort({
    createdAt: -1,
  });
};

export const getCouponByIdService = async (
  id
) => {
  const coupon = await Coupon.findById(id);

  if (!coupon) {
    throw new Error("Coupon not found");
  }

  return coupon;
};

export const createCouponService = async (
  body,
  userId
) => {
  const exists = await Coupon.findOne({
    code: body.couponCode.toUpperCase(),
  });

  if (exists) {
    throw new Error(
      "Coupon already exists"
    );
  }

  const coupon = await Coupon.create({
    code: body.couponCode.toUpperCase(),
    title: body.title,
    description:
      body.description || "",
    discountType:
      body.discountType,
    discountValue:
      body.discountValue,
    maxDiscount:
      body.maxDiscount || 0,
    minimumOrderAmount:
      body.minimumOrderAmount || 0,
    usageLimit:
      body.usageLimit || 0,
    validFrom: body.validFrom,
    validUntil: body.validUntil,
    createdBy: userId,
  });

  return coupon;
};

export const updateCouponService = async (
  id,
  body,
  userId
) => {
  const coupon = await Coupon.findById(id);

  if (!coupon) {
    throw new Error("Coupon not found");
  }

  coupon.code =
    body.code?.toUpperCase() ??
    coupon.code;

  coupon.title =
    body.title ??
    coupon.title;

  coupon.description =
    body.description ??
    coupon.description;

  coupon.discountType =
    body.discountType ??
    coupon.discountType;

  coupon.discountValue =
    body.discountValue ??
    coupon.discountValue;

  coupon.maxDiscount =
    body.maxDiscount ??
    coupon.maxDiscount;

  coupon.minimumOrderAmount =
    body.minimumOrderAmount ??
    coupon.minimumOrderAmount;

  coupon.usageLimit =
    body.usageLimit ??
    coupon.usageLimit;

  coupon.validFrom =
    body.validFrom ??
    coupon.validFrom;

  coupon.validUntil =
    body.validUntil ??
    coupon.validUntil;

  coupon.updatedBy = userId;

  await coupon.save();

  return coupon;
};

export const updateCouponStatusService =
  async (
    id,
    isActive,
    userId
  ) => {
    const coupon =
      await Coupon.findById(id);

    if (!coupon) {
      throw new Error(
        "Coupon not found"
      );
    }

    coupon.isActive = isActive;
    coupon.updatedBy = userId;

    await coupon.save();

    return coupon;
  };

export const applyCouponService =
  async (couponCode, orderAmount) => {
    const coupon =
      await Coupon.findOne({
        code:
          couponCode.toUpperCase(),
      });

    if (!coupon) {
      throw new Error(
        "Coupon not found"
      );
    }

    if (!coupon.isActive) {
      throw new Error(
        "Coupon is inactive"
      );
    }

    const now = new Date();

    if (now < coupon.validFrom) {
      throw new Error(
        "Coupon is not active yet"
      );
    }

    if (now > coupon.validUntil) {
      throw new Error(
        "Coupon has expired"
      );
    }

    if (
      coupon.usageLimit > 0 &&
      coupon.usedCount >=
        coupon.usageLimit
    ) {
      throw new Error(
        "Coupon usage limit exceeded"
      );
    }

    if (
      orderAmount <
      coupon.minimumOrderAmount
    ) {
      throw new Error(
        `Minimum order amount is ₹${coupon.minimumOrderAmount}`
      );
    }

    let discount = 0;

    if (
      coupon.discountType ===
      "PERCENTAGE"
    ) {
      discount =
        (orderAmount *
          coupon.discountValue) /
        100;

      if (
        coupon.maxDiscount > 0 &&
        discount >
          coupon.maxDiscount
      ) {
        discount =
          coupon.maxDiscount;
      }
    } else {
      discount =
        coupon.discountValue;
    }

    if (discount > orderAmount) {
      discount = orderAmount;
    }

    return {
      couponId: coupon._id,
      code: coupon.code,
      title: coupon.title,
      originalAmount:
        orderAmount,
      discountAmount:
        Number(
          discount.toFixed(2)
        ),
      payableAmount: Number(
        (
          orderAmount -
          discount
        ).toFixed(2)
      ),
    };
  };

export const markCouponUsedService =
  async (couponId) => {
    const coupon =
      await Coupon.findById(
        couponId
      );

    if (!coupon) {
      throw new Error(
        "Coupon not found"
      );
    }

    coupon.usedCount += 1;

    await coupon.save();

    return coupon;
  };

export const deleteCouponService =
  async (id) => {
    const coupon =
      await Coupon.findById(id);

    if (!coupon) {
      throw new Error(
        "Coupon not found"
      );
    }

    await coupon.deleteOne();

    return;
  };


// Dashboard & Analytics
// Wallet / Transactions
// Support / Help
// Settings
// Reports / Revenue
// Audit Logs