import Review from "./review.model.js";
import Order from "../order/order.model.js";
import Product from "../product/product.model.js";
import AppError from "../../utils/AppError.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { parsePagination, buildPagination } from "../../utils/pagination.js";

const updateProductRating = async (productId) => {
  const result = await Review.aggregate([
    { $match: { productId, isVisible: true } },
    { $group: { _id: "$productId", averageRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } },
  ]);
  const ratingData = result[0];
  await Product.findByIdAndUpdate(productId, {
    averageRating: ratingData ? Number(ratingData.averageRating.toFixed(1)) : 0,
    totalReviews: ratingData ? ratingData.totalReviews : 0,
  });
};

export const getProductReviewsService = async (productId) => {
  const product = await Product.findOne({ _id: productId, isDeleted: false, isActive: true });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  return await Review.find({ productId, isVisible: true }).populate("userId", "name profileImage").sort({ createdAt: -1 });
};

export const getMyReviewsService = async (userId) => {
  return await Review.find({ userId }).populate("productId", "name images slug averageRating totalReviews").sort({ createdAt: -1 });
};

export const getAllReviewsService = async (query = {}) => {
  const pagination = parsePagination(query);
  const base = Review.find()
    .populate("userId", "name email phone profileImage")
    .populate("productId", "name images slug averageRating totalReviews")
    .populate("orderId", "orderNumber orderStatus")
    .sort({ createdAt: -1 });
  if (!pagination.hasPagination) return await base;
  const [items, total] = await Promise.all([base.skip(pagination.skip).limit(pagination.limit), Review.countDocuments()]);
  return { items, pagination: buildPagination({ page: pagination.page, limit: pagination.limit, total }) };
};

export const getReviewByIdService = async (id) => {
  const review = await Review.findById(id)
    .populate("userId", "name profileImage")
    .populate("productId", "name images slug averageRating totalReviews");
  if (!review) throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found");
  return review;
};

export const createReviewService = async (userId, body) => {
  const product = await Product.findOne({ _id: body.productId, isDeleted: false, isActive: true });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");

  const alreadyReviewed = await Review.findOne({ productId: body.productId, userId });
  if (alreadyReviewed) throw new AppError(409, "REVIEW_ALREADY_EXISTS", "You have already reviewed this product");

  const order = await Order.findOne({ _id: body.orderId, userId, orderStatus: "DELIVERED", isDeleted: false });
  if (!order) throw new AppError(403, "VERIFIED_PURCHASE_REQUIRED", "Delivered order not found");

  const purchased = order.items.some((item) => item.productId && item.productId.toString() === body.productId.toString());
  if (!purchased) throw new AppError(403, "VERIFIED_PURCHASE_REQUIRED", "Product was not purchased in this order");

  try {
    const review = await Review.create({
      productId: body.productId,
      orderId: body.orderId,
      userId,
      rating: body.rating,
      title: body.title || "",
      comment: body.comment || "",
      verifiedPurchase: true,
      createdBy: userId,
    });

    await updateProductRating(review.productId);
    return await Review.findById(review._id)
      .populate("userId", "name profileImage")
      .populate("productId", "name images slug averageRating totalReviews");
  } catch (error) {
    if (error?.code === 11000) throw new AppError(409, "REVIEW_ALREADY_EXISTS", "You have already reviewed this product");
    throw error;
  }
};

export const updateReviewService = async (id, userId, body) => {
  const review = await Review.findOne({ _id: id, userId });
  if (!review) throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found");

  if (body.rating !== undefined) review.rating = body.rating;
  if (body.title !== undefined) review.title = body.title;
  if (body.comment !== undefined) review.comment = body.comment;
  review.updatedBy = userId;
  await review.save();
  await updateProductRating(review.productId);

  return await Review.findById(review._id)
    .populate("userId", "name profileImage")
    .populate("productId", "name images slug averageRating totalReviews");
};

export const deleteReviewService = async (id, userId) => {
  const review = await Review.findOne({ _id: id, userId });
  if (!review) throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found");
  const productId = review.productId;
  await review.deleteOne();
  await updateProductRating(productId);
};

export const adminUpdateReviewVisibilityService = async (reviewId, adminId, patch) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found");

  if (patch.isVisible !== undefined) review.isVisible = patch.isVisible;
  if (patch.rating !== undefined) review.rating = patch.rating;
  if (patch.title !== undefined) review.title = patch.title;
  if (patch.comment !== undefined) review.comment = patch.comment;
  review.updatedBy = adminId;
  await review.save();
  await updateProductRating(review.productId);

  await writeAuditLog({
    actorId: adminId,
    action: "REVIEW_MODERATED",
    resourceType: "Review",
    resourceId: review._id,
    details: { changes: patch },
  });

  return await Review.findById(review._id)
    .populate("userId", "name profileImage")
    .populate("productId", "name images slug averageRating totalReviews");
};

export const adminDeleteReviewService = async (reviewId, adminId) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found");

  const productId = review.productId;
  await review.deleteOne();
  await updateProductRating(productId);
  await writeAuditLog({ actorId: adminId, action: "REVIEW_DELETED", resourceType: "Review", resourceId: reviewId });
};
