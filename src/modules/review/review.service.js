import Review from "./review.model.js";
import Order from "../order/order.model.js";
import Product from "../product/product.model.js";

const updateProductRating = async (
  productId
) => {
  const reviews = await Review.find({
    productId,
    isVisible: true,
  });

  const totalReviews = reviews.length;

  const averageRating =
    totalReviews === 0
      ? 0
      : Number(
          (
            reviews.reduce(
              (sum, review) =>
                sum + review.rating,
              0
            ) / totalReviews
          ).toFixed(1)
        );

  await Product.findByIdAndUpdate(
    productId,
    {
      averageRating,
      totalReviews,
    }
  );
};

export const getProductReviewsService =
  async (productId) => {
    return await Review.find({
      productId,
      isVisible: true,
    })
      .populate(
        "userId",
        "name profileImage"
      )
      .sort({
        createdAt: -1,
      });
  };

export const getMyReviewsService =
  async (userId) => {
    return await Review.find({
      userId,
    })
      .populate(
        "productId",
        "name images"
      )
      .sort({
        createdAt: -1,
      });
  };

export const getReviewByIdService =
  async (id) => {
    const review =
      await Review.findById(id)
        .populate(
          "userId",
          "name profileImage"
        )
        .populate(
          "productId",
          "name images"
        );

    if (!review) {
      throw new Error(
        "Review not found"
      );
    }

    return review;
  };

export const createReviewService =
  async (userId, body) => {
    const alreadyReviewed =
      await Review.findOne({
        productId:
          body.productId,
        userId,
      });

    if (alreadyReviewed) {
      throw new Error(
        "Review already submitted"
      );
    }

    const order =
      await Order.findOne({
        _id: body.orderId,
        userId,
        orderStatus:
          "DELIVERED",
      });

    if (!order) {
      throw new Error(
        "Delivered order not found"
      );
    }

    const purchased =
      order.items.some(
        (item) =>
          item.productId.toString() ===
          body.productId
      );

    if (!purchased) {
      throw new Error(
        "Product not found in this order"
      );
    }

    const review =
      await Review.create({
        productId:
          body.productId,
        orderId:
          body.orderId,
        userId,
        rating:
          body.rating,
        title:
          body.title || "",
        comment:
          body.comment || "",
        createdBy: userId,
      });

    await updateProductRating(
      body.productId
    );

    return await Review.findById(
      review._id
    )
      .populate(
        "userId",
        "name profileImage"
      )
      .populate(
        "productId",
        "name images"
      );
  };

export const updateReviewService =
  async (
    id,
    userId,
    body
  ) => {
    const review =
      await Review.findOne({
        _id: id,
        userId,
      });

    if (!review) {
      throw new Error(
        "Review not found"
      );
    }

    if (
      body.rating !== undefined
    ) {
      review.rating =
        body.rating;
    }

    if (
      body.title !== undefined
    ) {
      review.title =
        body.title;
    }

    if (
      body.comment !==
      undefined
    ) {
      review.comment =
        body.comment;
    }

    review.updatedBy =
      userId;

    await review.save();

    await updateProductRating(
      review.productId
    );

    return review;
  };

export const deleteReviewService =
  async (
    id,
    userId
  ) => {
    const review =
      await Review.findOne({
        _id: id,
        userId,
      });

    if (!review) {
      throw new Error(
        "Review not found"
      );
    }

    const productId =
      review.productId;

    await review.deleteOne();

    await updateProductRating(
      productId
    );

    return;
  };