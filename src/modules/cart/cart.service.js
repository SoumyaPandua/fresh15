import Cart from "./cart.model.js";
import Product from "../product/product.model.js";
import Inventory from "../inventory/inventory.model.js";

export const getMyCartService = async (userId) => {
  let cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    select: "name images sellingPrice mrp unit sku stock isActive",
  });

  if (!cart) {
    cart = await Cart.create({ userId });
  }

  return cart;
};

export const addToCartService = async (
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

  const inventory = await Inventory.findOne({
    productId: body.productId,
  });

  if (!inventory) {
    throw new Error("Inventory not found");
  }

  if (inventory.availableStock < body.quantity) {
    throw new Error("Insufficient stock");
  }

  let cart = await Cart.findOne({ userId });

  if (!cart) {
    cart = await Cart.create({
      userId,
      items: [],
    });
  }

  const existingItem = cart.items.find(
    (item) =>
      item.productId.toString() === body.productId
  );

  if (existingItem) {
    const newQuantity =
      existingItem.quantity + Number(body.quantity);

    if (newQuantity > inventory.availableStock) {
      throw new Error("Insufficient stock");
    }

    existingItem.quantity = newQuantity;
    existingItem.price = product.sellingPrice;
    existingItem.subtotal =
      newQuantity * product.sellingPrice;
  } else {
    cart.items.push({
      productId: product._id,
      quantity: body.quantity,
      price: product.sellingPrice,
      subtotal:
        body.quantity * product.sellingPrice,
    });
  }

  cart.calculateTotals();

  await cart.save();

  return await Cart.findOne({ userId }).populate({
    path: "items.productId",
    select: "name images sellingPrice mrp unit sku stock isActive",
  });
};

export const updateCartItemService = async (
  userId,
  productId,
  quantity
) => {
  const cart = await Cart.findOne({ userId });

  if (!cart) {
    throw new Error("Cart not found");
  }

  const inventory = await Inventory.findOne({
    productId,
  });

  if (!inventory) {
    throw new Error("Inventory not found");
  }

  if (inventory.availableStock < quantity) {
    throw new Error("Insufficient stock");
  }

  const item = cart.items.find(
    (i) => i.productId.toString() === productId
  );

  if (!item) {
    throw new Error("Product not found in cart");
  }

  item.quantity = quantity;
  item.subtotal = quantity * item.price;

  cart.calculateTotals();

  await cart.save();

  return await Cart.findOne({ userId }).populate({
    path: "items.productId",
    select: "name images sellingPrice mrp unit sku stock isActive",
  });
};

export const removeCartItemService = async (
  userId,
  productId
) => {
  const cart = await Cart.findOne({ userId });

  if (!cart) {
    throw new Error("Cart not found");
  }

  cart.items = cart.items.filter(
    (item) =>
      item.productId.toString() !== productId
  );

  cart.calculateTotals();

  await cart.save();

  return await Cart.findOne({ userId }).populate({
    path: "items.productId",
    select: "name images sellingPrice mrp unit sku stock isActive",
  });
};

export const clearCartService = async (
  userId
) => {
  const cart = await Cart.findOne({ userId });

  if (!cart) {
    throw new Error("Cart not found");
  }

  cart.items = [];

  cart.calculateTotals();

  await cart.save();

  return cart;
};