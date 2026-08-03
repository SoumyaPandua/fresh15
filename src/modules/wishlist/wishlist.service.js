import Wishlist from "./wishlist.model.js";
import Product from "../product/product.model.js";

export const getMyWishlistService = async (userId) => {
  let wishlist = await Wishlist.findOne({ userId }).populate({
    path: "items.productId",
    select: "name images sellingPrice mrp unit stock sku isActive",
  });

  if (!wishlist) {
    wishlist = await Wishlist.create({ userId });
  }

  return wishlist;
};

export const addWishlistService = async (
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

  let wishlist = await Wishlist.findOne({ userId });

  if (!wishlist) {
    wishlist = await Wishlist.create({
      userId,
      items: [],
    });
  }

  const exists = wishlist.items.some(
    (item) =>
      item.productId.toString() === body.productId
  );

  if (exists) {
    throw new Error(
      "Product already exists in wishlist"
    );
  }

  wishlist.items.push({
    productId: body.productId,
  });

  wishlist.calculateTotals();

  await wishlist.save();

  return await Wishlist.findOne({ userId }).populate({
    path: "items.productId",
    select: "name images sellingPrice mrp unit stock sku isActive",
  });
};

export const removeWishlistService = async (
  userId,
  productId
) => {
  const wishlist = await Wishlist.findOne({
    userId,
  });

  if (!wishlist) {
    throw new Error("Wishlist not found");
  }

  wishlist.items = wishlist.items.filter(
    (item) =>
      item.productId.toString() !== productId
  );

  wishlist.calculateTotals();

  await wishlist.save();

  return await Wishlist.findOne({ userId }).populate({
    path: "items.productId",
    select: "name images sellingPrice mrp unit stock sku isActive",
  });
};