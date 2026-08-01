import Inventory from "./inventory.model.js";
import Product from "../product/product.model.js";

export const getAllInventoryService = async (query) => {
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  const inventory = await Inventory.find(filter)
    .populate({
      path: "productId",
      select:
        "name slug sku images sellingPrice categoryId isActive",
      populate: {
        path: "categoryId",
        select: "name",
      },
    })
    .sort({
      createdAt: -1,
    });

  return inventory;
};

export const getInventoryByProductService = async (
  productId
) => {
  const inventory = await Inventory.findOne({
    productId,
  }).populate({
    path: "productId",
    select:
      "name slug sku images sellingPrice categoryId isActive",
    populate: {
      path: "categoryId",
      select: "name",
    },
  });

  if (!inventory) {
    throw new Error("Inventory not found");
  }

  return inventory;
};

export const createInventoryService = async (
  userId,
  body
) => {
  const product = await Product.findOne({
    _id: body.productId,
    isDeleted: false,
  });

  if (!product) {
    throw new Error("Product not found");
  }

  const exists = await Inventory.findOne({
    productId: body.productId,
  });

  if (exists) {
    throw new Error(
      "Inventory already exists for this product"
    );
  }

  const inventory = await Inventory.create({
    productId: body.productId,
    currentStock: body.currentStock,
    reservedStock: body.reservedStock || 0,
    lowStockThreshold:
      body.lowStockThreshold || 10,
    lastRestockedAt:
      Number(body.currentStock) > 0
        ? new Date()
        : null,
    createdBy: userId,
  });

  return await Inventory.findById(
    inventory._id
  ).populate({
    path: "productId",
    select:
      "name sku images sellingPrice categoryId",
    populate: {
      path: "categoryId",
      select: "name",
    },
  });
};

export const updateInventoryService = async (
  id,
  userId,
  body
) => {
  const inventory = await Inventory.findById(id);

  if (!inventory) {
    throw new Error("Inventory not found");
  }

  const previousStock = inventory.currentStock;

  if (body.currentStock !== undefined) {
    inventory.currentStock = body.currentStock;
  }

  if (body.reservedStock !== undefined) {
    inventory.reservedStock = body.reservedStock;
  }

  if (body.lowStockThreshold !== undefined) {
    inventory.lowStockThreshold =
      body.lowStockThreshold;
  }

  if (
    body.currentStock !== undefined &&
    Number(body.currentStock) > Number(previousStock)
  ) {
    inventory.lastRestockedAt = new Date();
  }

  inventory.updatedBy = userId;

  await inventory.save();

  return await Inventory.findById(inventory._id).populate({
    path: "productId",
    select:
      "name sku images sellingPrice categoryId",
    populate: {
      path: "categoryId",
      select: "name",
    },
  });
};

export const updateInventoryStockService = async (
  id,
  userId,
  currentStock
) => {
  const inventory = await Inventory.findById(id);

  if (!inventory) {
    throw new Error("Inventory not found");
  }

  const previousStock = inventory.currentStock;

  inventory.currentStock = currentStock;

  if (Number(currentStock) > Number(previousStock)) {
    inventory.lastRestockedAt = new Date();
  }

  inventory.updatedBy = userId;

  await inventory.save();

  return await Inventory.findById(inventory._id).populate({
    path: "productId",
    select:
      "name sku images sellingPrice categoryId",
    populate: {
      path: "categoryId",
      select: "name",
    },
  });
};

export const deleteInventoryService = async (
  id
) => {
  const inventory = await Inventory.findById(id);

  if (!inventory) {
    throw new Error("Inventory not found");
  }

  await inventory.deleteOne();

  return;
};