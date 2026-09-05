import DeliveryRating from "./deliveryRating.model.js";
import Delivery from "../delivery/delivery.model.js";
import Order from "../order/order.model.js";
import Profile from "../profile/profile.model.js";
import AppError from "../../utils/AppError.js";

const calculateTier = (rating, deliveries) => {
  if (deliveries >= 500 && rating >= 4.7) return "Platinum";
  if (deliveries >= 250 && rating >= 4.5) return "Gold";
  if (deliveries >= 100 && rating >= 4.2) return "Silver";
  return "Bronze";
};

export const getDeliveryRatingService = async (orderId, customerId) => {
  const row = await DeliveryRating.findOne({ orderId, customerId }).lean();
  return row ? { rated: true, rating: row.rating, createdAt: row.createdAt } : { rated: false, rating: null, createdAt: null };
};

export const createDeliveryRatingService = async (orderId, customerId, value) => {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError(422, "INVALID_RATING", "Rating must be a whole number from 1 to 5");

  const order = await Order.findOne({ _id: orderId, userId: customerId }).select("_id orderStatus").lean();
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  if (order.orderStatus !== "DELIVERED") throw new AppError(409, "ORDER_NOT_DELIVERED", "You can rate the delivery partner only after delivery");

  const delivery = await Delivery.findOne({ orderId, status: "DELIVERED" }).select("_id riderId status").lean();
  if (!delivery?.riderId) throw new AppError(409, "DELIVERY_PARTNER_NOT_FOUND", "No delivery partner is available to rate for this order");

  try {
    const created = await DeliveryRating.create({ orderId, deliveryId: delivery._id, customerId, partnerId: delivery.riderId, rating });

    const [stats] = await DeliveryRating.aggregate([
      { $match: { partnerId: delivery.riderId } },
      { $group: { _id: "$partnerId", average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    const profile = await Profile.findOne({ userId: delivery.riderId, role: "PARTNER" });
    if (profile) {
      profile.rating = Number(Number(stats?.average || 0).toFixed(2));
      profile.ratingCount = Number(stats?.count || 0);
      profile.tier = calculateTier(profile.rating, Number(profile.totalDeliveries || 0));
      await profile.save();
    }

    return { rated: true, rating: created.rating, partnerId: String(delivery.riderId), ratingCount: Number(stats?.count || 0), averageRating: Number(Number(stats?.average || 0).toFixed(2)), tier: profile?.tier || "Bronze" };
  } catch (error) {
    if (error?.code === 11000) throw new AppError(409, "RATING_ALREADY_SUBMITTED", "This delivery has already been rated. Ratings cannot be changed.");
    throw error;
  }
};
