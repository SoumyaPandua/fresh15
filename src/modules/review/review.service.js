import Review from "./review.model.js";
import Order from "../order/order.model.js";
import Product from "../product/product.model.js";

const updateProductRating = async (productId) => {
  const result = await Review.aggregate([
    {
      $match: {
        productId,
        isVisible: true,
      },
    },
    {
      $group: {
        _id: "$productId",
        averageRating: {
          $avg: "$rating",
        },
        totalReviews: {
          $sum: 1,
        },
      },
    },
  ]);

  const ratingData = result[0];

  await Product.findByIdAndUpdate(productId, {
    averageRating: ratingData
      ? Number(ratingData.averageRating.toFixed(1))
      : 0,
    totalReviews: ratingData
      ? ratingData.totalReviews
      : 0,
  });
};

export const getProductReviewsService = async (
  productId
) => {
  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
    isActive: true,
  });

  if (!product) {
    throw new Error("Product not found");
  }

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

export const getMyReviewsService = async (
  userId
) => {
  return await Review.find({
    userId,
  })
    .populate(
      "productId",
      "name images slug averageRating totalReviews"
    )
    .sort({
      createdAt: -1,
    });
};

export const getAllReviewsService = async () => {
  return await Review.find()
    .populate(
      "userId",
      "name email phone profileImage"
    )
    .populate(
      "productId",
      "name images slug averageRating totalReviews"
    )
    .populate(
      "orderId",
      "orderNumber orderStatus"
    )
    .sort({
      createdAt: -1,
    });
};

export const getReviewByIdService = async (
  id
) => {
  const review = await Review.findById(id)
    .populate(
      "userId",
      "name profileImage"
    )
    .populate(
      "productId",
      "name images slug averageRating totalReviews"
    );

  if (!review) {
    throw new Error("Review not found");
  }

  return review;
};

export const createReviewService = async (
  userId,
  body
) => {
  const product = await Product.findOne({
    _id: body.productId,
    isDeleted: false,
    isActive: true,
  });

  if (!product) {
    throw new Error("Product not found");
  }

  const alreadyReviewed = await Review.findOne({
    productId: body.productId,
    userId,
  });

  if (alreadyReviewed) {
    throw new Error(
      "You have already reviewed this product"
    );
  }

  const order = await Order.findOne({
    _id: body.orderId,
    userId,
    orderStatus: "DELIVERED",
  });

  if (!order) {
    throw new Error(
      "Delivered order not found"
    );
  }

  const purchased = order.items.some(
    (item) =>
      item.productId &&
      item.productId.toString() ===
        body.productId.toString()
  );

  if (!purchased) {
    throw new Error(
      "Product was not purchased in this order"
    );
  }

  const review = await Review.create({
    productId: body.productId,
    orderId: body.orderId,
    userId,
    rating: body.rating,
    title: body.title || "",
    comment: body.comment || "",
    createdBy: userId,
  });

  await updateProductRating(
    review.productId
  );

  return await Review.findById(review._id)
    .populate(
      "userId",
      "name profileImage"
    )
    .populate(
      "productId",
      "name images slug averageRating totalReviews"
    );
};

export const updateReviewService = async (
  id,
  userId,
  body
) => {
  const review = await Review.findOne({
    _id: id,
    userId,
  });

  if (!review) {
    throw new Error("Review not found");
  }

  if (body.rating !== undefined) {
    review.rating = body.rating;
  }

  if (body.title !== undefined) {
    review.title = body.title;
  }

  if (body.comment !== undefined) {
    review.comment = body.comment;
  }

  review.updatedBy = userId;

  await review.save();

  await updateProductRating(
    review.productId
  );

  return await Review.findById(review._id)
    .populate(
      "userId",
      "name profileImage"
    )
    .populate(
      "productId",
      "name images slug averageRating totalReviews"
    );
};

export const deleteReviewService = async (
  id,
  userId
) => {
  const review = await Review.findOne({
    _id: id,
    userId,
  });

  if (!review) {
    throw new Error("Review not found");
  }

  const productId = review.productId;

  await review.deleteOne();

  await updateProductRating(productId);

  return;
};