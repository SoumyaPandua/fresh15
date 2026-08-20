import Cart from "./cart.model.js";
import Product from "../product/product.model.js";
import Inventory from "../inventory/inventory.model.js";
import AppError from "../../utils/AppError.js";

const CART_PRODUCT_SELECT =
  "name images sellingPrice mrp unit sku stock isActive categoryId";

const populateCart = (userId) =>
  Cart.findOne({ userId }).populate({
    path: "items.productId",
    select: CART_PRODUCT_SELECT,
  });

const validateSubstitutionPreference = async (
  product,
  substitutionPreference
) => {
  const type = substitutionPreference?.type || "CALL_ME";
  const preferredReplacementProductId =
    substitutionPreference?.preferredReplacementProductId || null;

  const allowedTypes = [
    "CALL_ME",
    "BEST_SIMILAR_ITEM",
    "DO_NOT_SUBSTITUTE",
    "SPECIFIC_ITEM",
  ];

  if (!allowedTypes.includes(type)) {
    throw new AppError(
      400,
      "INVALID_SUBSTITUTION_PREFERENCE",
      "Invalid substitution preference"
    );
  }

  if (type !== "SPECIFIC_ITEM") {
    return {
      type,
      preferredReplacementProductId: null,
    };
  }

  if (!preferredReplacementProductId) {
    throw new AppError(
      400,
      "REPLACEMENT_PRODUCT_REQUIRED",
      "A preferred replacement product is required for SPECIFIC_ITEM"
    );
  }

  if (preferredReplacementProductId.toString() === product._id.toString()) {
    throw new AppError(
      400,
      "INVALID_REPLACEMENT_PRODUCT",
      "The replacement product must be different from the cart item"
    );
  }

  const replacement = await Product.findOne({
    _id: preferredReplacementProductId,
    isDeleted: false,
    isActive: true,
  }).select("name images sellingPrice mrp unit sku stock categoryId");

  if (!replacement) {
    throw new AppError(
      404,
      "REPLACEMENT_PRODUCT_NOT_FOUND",
      "Preferred replacement product not found"
    );
  }

  if (
    product.categoryId &&
    replacement.categoryId &&
    product.categoryId.toString() !== replacement.categoryId.toString()
  ) {
    throw new AppError(
      400,
      "INVALID_REPLACEMENT_CATEGORY",
      "Preferred replacement should belong to the same category"
    );
  }

  const replacementInventory = await Inventory.findOne({
    productId: replacement._id,
  }).select("availableStock");

  if (!replacementInventory || replacementInventory.availableStock <= 0) {
    throw new AppError(
      409,
      "REPLACEMENT_OUT_OF_STOCK",
      "Preferred replacement is currently out of stock"
    );
  }

  return {
    type,
    preferredReplacementProductId: replacement._id,
  };
};

export const getMyCartService = async (userId) => {
  let cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    select: CART_PRODUCT_SELECT,
  });

  if (!cart) {
    cart = await Cart.create({ userId });
  }

  return cart;
};

export const addToCartService = async (userId, body) => {
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
    (item) => item.productId.toString() === body.productId
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

    if (body.substitutionPreference) {
      existingItem.substitutionPreference =
        await validateSubstitutionPreference(
          product,
          body.substitutionPreference
        );
    }
  } else {
    cart.items.push({
      productId: product._id,
      quantity: body.quantity,
      price: product.sellingPrice,
      subtotal:
        body.quantity * product.sellingPrice,
      substitutionPreference:
        await validateSubstitutionPreference(
          product,
          body.substitutionPreference
        ),
    });
  }

  cart.calculateTotals();

  await cart.save();

  return await Cart.findOne({ userId }).populate({
    path: "items.productId",
    select: CART_PRODUCT_SELECT,
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
    select: CART_PRODUCT_SELECT,
  });
};

export const updateCartItemSubstitutionService = async (
  userId,
  productId,
  substitutionPreference
) => {
  const cart = await Cart.findOne({ userId });

  if (!cart) {
    throw new AppError(404, "CART_NOT_FOUND", "Cart not found");
  }

  const item = cart.items.find(
    (entry) => entry.productId.toString() === productId
  );

  if (!item) {
    throw new AppError(
      404,
      "CART_ITEM_NOT_FOUND",
      "Product not found in cart"
    );
  }

  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
    isActive: true,
  }).select(CART_PRODUCT_SELECT);

  if (!product) {
    throw new AppError(
      409,
      "PRODUCT_UNAVAILABLE",
      "Product is no longer available"
    );
  }

  item.substitutionPreference =
    await validateSubstitutionPreference(
      product,
      substitutionPreference
    );

  await cart.save();

  return await populateCart(userId);
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
    select: CART_PRODUCT_SELECT,
  });
};

export const clearCartService = async (userId) => {
  const cart = await Cart.findOne({ userId });

  if (!cart) {
    throw new Error("Cart not found");
  }

  cart.items = [];

  cart.calculateTotals();

  await cart.save();

  return cart;
};