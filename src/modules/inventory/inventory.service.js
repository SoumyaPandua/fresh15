
import Inventory from "./inventory.model.js";
import Product from "../product/product.model.js";
import { processBackInStockAlertService } from "../productAlert/productAlert.service.js";

const populateInventory = (id) =>
  Inventory.findById(id).populate({
    path: "productId",
    select: "name slug sku images sellingPrice categoryId isActive stock",
    populate: {
      path: "categoryId",
      select: "name",
    },
  });

const syncProductStock = async (productId, currentStock) => {
  await Product.findByIdAndUpdate(productId, {
    $set: {
      stock: Number(currentStock),
    },
  });
};

export const getAllInventoryService = async (query) => {
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  const inventory = await Inventory.find(filter)
    .populate({
      path: "productId",
      select:
        "name slug sku images sellingPrice categoryId isActive stock",
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
      "name slug sku images sellingPrice categoryId isActive stock",
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

  const currentStock = Number(body.currentStock);
  const reservedStock = Number(body.reservedStock || 0);

  if (reservedStock > currentStock) {
    throw new Error(
      "Reserved stock cannot be greater than current stock"
    );
  }

  const inventory = await Inventory.create({
    productId: body.productId,
    currentStock,
    reservedStock,
    lowStockThreshold:
      body.lowStockThreshold !== undefined
        ? Number(body.lowStockThreshold)
        : 10,
    lastRestockedAt:
      currentStock > 0 ? new Date() : null,
    createdBy: userId,
  });

  await syncProductStock(product._id, currentStock);

  return await populateInventory(inventory._id);
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

  const previousStock = Number(inventory.currentStock);
  const previousAvailableStock = Number(inventory.availableStock);

  if (body.currentStock !== undefined) {
    const nextStock = Number(body.currentStock);

    if (!Number.isInteger(nextStock) || nextStock < 0) {
      throw new Error(
        "Current stock must be a non-negative integer"
      );
    }

    inventory.currentStock = nextStock;
  }

  // Reserved stock is system-managed by order reservation/finalization.
  // Keep this field readable but do not allow an admin stock edit to
  // accidentally corrupt active reservations.
  if (body.reservedStock !== undefined) {
    const nextReserved = Number(body.reservedStock);

    if (
      !Number.isInteger(nextReserved) ||
      nextReserved < 0
    ) {
      throw new Error(
        "Reserved stock must be a non-negative integer"
      );
    }

    if (nextReserved > Number(inventory.currentStock)) {
      throw new Error(
        "Reserved stock cannot be greater than current stock"
      );
    }

    inventory.reservedStock = nextReserved;
  }

  if (body.lowStockThreshold !== undefined) {
    const threshold = Number(body.lowStockThreshold);

    if (!Number.isInteger(threshold) || threshold < 0) {
      throw new Error(
        "Low stock threshold must be a non-negative integer"
      );
    }

    inventory.lowStockThreshold = threshold;
  }

  if (
    Number(inventory.currentStock) > previousStock
  ) {
    inventory.lastRestockedAt = new Date();
  }

  inventory.updatedBy = userId;

  await inventory.save();

  await syncProductStock(
    inventory.productId,
    inventory.currentStock
  );

  try {
    await processBackInStockAlertService({
      productId: inventory.productId,
      previousAvailableStock,
      currentAvailableStock: Number(inventory.availableStock),
    });
  } catch (alertError) {
    console.error("Back-in-stock alert processing failed:", alertError.message);
  }

  return await populateInventory(inventory._id);
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

  const nextStock = Number(currentStock);

  if (!Number.isInteger(nextStock) || nextStock < 0) {
    throw new Error(
      "Current stock must be a non-negative integer"
    );
  }

  if (nextStock < Number(inventory.reservedStock)) {
    throw new Error(
      `Stock cannot be reduced below reserved quantity (${inventory.reservedStock})`
    );
  }

  const previousStock = Number(inventory.currentStock);
  const previousAvailableStock = Number(inventory.availableStock);

  inventory.currentStock = nextStock;

  if (nextStock > previousStock) {
    inventory.lastRestockedAt = new Date();
  }

  inventory.updatedBy = userId;

  await inventory.save();

  await syncProductStock(
    inventory.productId,
    nextStock
  );

  try {
    await processBackInStockAlertService({
      productId: inventory.productId,
      previousAvailableStock,
      currentAvailableStock: Number(inventory.availableStock),
    });
  } catch (alertError) {
    console.error("Back-in-stock alert processing failed:", alertError.message);
  }

  return await populateInventory(inventory._id);
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
