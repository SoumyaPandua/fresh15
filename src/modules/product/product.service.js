
import slugify from "slugify";

import Product from "./product.model.js";
import Category from "../category/category.model.js";
import Inventory from "../inventory/inventory.model.js";
import { uploadImage } from "../../config/cloudinary.js";
import { parsePagination, buildPagination } from "../../utils/pagination.js";
import { processBackInStockAlertService, processPriceDropAlertService } from "../productAlert/productAlert.service.js";

export const getAllProductsService = async (query) => {
  const filter = {
    isDeleted: false,
  };

  if (query.categoryId) {
    filter.categoryId = query.categoryId;
  }

  if (query.isFeatured !== undefined) {
    filter.isFeatured = query.isFeatured === "true";
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === "true";
  }

  if (query.search) {
    filter.$text = {
      $search: query.search,
    };
  }

  const pagination = parsePagination(query);
  const base = Product.find(filter).populate("categoryId", "name").sort({ createdAt: -1 });
  if (!pagination.hasPagination) return await base;

  const [products, total] = await Promise.all([
    base.skip(pagination.skip).limit(pagination.limit),
    Product.countDocuments(filter),
  ]);

  return {
    items: products,
    pagination: buildPagination({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getProductByIdService = async (id) => {
  const product = await Product.findOne({
    _id: id,
    isDeleted: false,
  }).populate("categoryId", "name image");

  if (!product) {
    throw new Error("Product not found");
  }

  return product;
};

export const createProductService = async (
  userId,
  body,
  files
) => {
  const category = await Category.findOne({
    _id: body.categoryId,
    isDeleted: false,
    isActive: true,
  });

  if (!category) {
    throw new Error("Category not found");
  }

  const slug = slugify(body.name, {
    lower: true,
    strict: true,
  });

  const existingName = await Product.findOne({
    slug,
    isDeleted: false,
  });

  if (existingName) {
    throw new Error("Product already exists");
  }

  const existingSku = await Product.findOne({
    sku: body.sku.toUpperCase(),
    isDeleted: false,
  });

  if (existingSku) {
    throw new Error("SKU already exists");
  }

  if (Number(body.sellingPrice) > Number(body.mrp)) {
    throw new Error("Selling price cannot be greater than MRP");
  }

  const initialStock = Math.max(0, Number(body.stock) || 0);
  const images = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadImage(
        file.buffer,
        "fresh15/products"
      );

      images.push(uploaded.secure_url);
    }
  }

  const product = await Product.create({
    categoryId: body.categoryId,
    name: body.name,
    slug,
    description: body.description,
    images,
    unit: body.unit,
    weight: body.weight,
    sku: body.sku.toUpperCase(),
    mrp: body.mrp,
    sellingPrice: body.sellingPrice,
    stock: initialStock,
    tags: body.tags || [],
    isVeg: body.isVeg ?? true,
    isFeatured: body.isFeatured ?? false,
    createdBy: userId,
  });

  await Inventory.create({
    productId: product._id,
    currentStock: initialStock,
    reservedStock: 0,
    lowStockThreshold: 10,
    lastRestockedAt:
      initialStock > 0 ? new Date() : null,
    createdBy: userId,
  });

  return await Product.findById(product._id).populate(
    "categoryId",
    "name"
  );
};

export const updateProductService = async (
  id,
  userId,
  body,
  files
) => {
  const product = await Product.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!product) {
    throw new Error("Product not found");
  }

  const previousPrice = Number(product.sellingPrice);
  const previousStock = Number(product.stock);

  if (body.categoryId) {
    const category = await Category.findOne({
      _id: body.categoryId,
      isDeleted: false,
      isActive: true,
    });

    if (!category) {
      throw new Error("Category not found");
    }

    product.categoryId = body.categoryId;
  }

  if (body.name && body.name !== product.name) {
    const slug = slugify(body.name, {
      lower: true,
      strict: true,
    });

    const existingProduct = await Product.findOne({
      slug,
      isDeleted: false,
      _id: { $ne: id },
    });

    if (existingProduct) {
      throw new Error("Product name already exists");
    }

    product.name = body.name;
    product.slug = slug;
  }

  if (body.sku && body.sku.toUpperCase() !== product.sku) {
    const existingSku = await Product.findOne({
      sku: body.sku.toUpperCase(),
      isDeleted: false,
      _id: { $ne: id },
    });

    if (existingSku) {
      throw new Error("SKU already exists");
    }

    product.sku = body.sku.toUpperCase();
  }

  const mrp =
    body.mrp !== undefined
      ? Number(body.mrp)
      : Number(product.mrp);

  const sellingPrice =
    body.sellingPrice !== undefined
      ? Number(body.sellingPrice)
      : Number(product.sellingPrice);

  if (sellingPrice > mrp) {
    throw new Error("Selling price cannot be greater than MRP");
  }

  if (files && files.length > 0) {
    const uploadedImages = [];

    for (const file of files) {
      const uploaded = await uploadImage(
        file.buffer,
        "fresh15/products"
      );

      uploadedImages.push(uploaded.secure_url);
    }

    product.images = uploadedImages;
  }

  if (body.description !== undefined) {
    product.description = body.description;
  }

  if (body.unit !== undefined) {
    product.unit = body.unit;
  }

  if (body.weight !== undefined) {
    product.weight = body.weight;
  }

  if (body.mrp !== undefined) {
    product.mrp = body.mrp;
  }

  if (body.sellingPrice !== undefined) {
    product.sellingPrice = body.sellingPrice;
  }

  if (body.tags !== undefined) {
    product.tags = body.tags;
  }

  if (body.isVeg !== undefined) {
    product.isVeg = body.isVeg;
  }

  if (body.isFeatured !== undefined) {
    product.isFeatured = body.isFeatured;
  }

  if (body.isActive !== undefined) {
    product.isActive = body.isActive;
  }

  if (body.stock !== undefined) {
    const nextStock = Number(body.stock);

    if (!Number.isInteger(nextStock) || nextStock < 0) {
      throw new Error("Stock must be a non-negative integer");
    }

    const inventory = await Inventory.findOne({
      productId: product._id,
    });

    if (inventory) {
      if (nextStock < Number(inventory.reservedStock)) {
        throw new Error(
          `Stock cannot be reduced below reserved quantity (${inventory.reservedStock})`
        );
      }

      const previousStock = Number(inventory.currentStock);
      inventory.currentStock = nextStock;

      if (nextStock > previousStock) {
        inventory.lastRestockedAt = new Date();
      }

      inventory.updatedBy = userId;
      await inventory.save();
    }

    product.stock = nextStock;
  }

  product.updatedBy = userId;

  await product.save();

  try {
    await processPriceDropAlertService({
      productId: product._id,
      previousPrice,
      currentPrice: Number(product.sellingPrice),
    });

    if (body.stock !== undefined) {
      const inventory = await Inventory.findOne({
        productId: product._id,
      }).select("availableStock");

      if (
        Number(inventory?.availableStock ?? product.stock) > 0 &&
        previousStock <= 0
      ) {
        await processBackInStockAlertService({
          productId: product._id,
          previousAvailableStock: previousStock,
          currentAvailableStock: Number(
            inventory?.availableStock ?? product.stock
          ),
        });
      }
    }
  } catch (alertError) {
    // Alert delivery must never make a successful catalog update fail.
    console.error("Product alert processing failed:", alertError.message);
  }

  return await Product.findById(product._id).populate(
    "categoryId",
    "name"
  );
};

export const updateProductStatusService = async (
  id,
  userId,
  isActive
) => {
  const product = await Product.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!product) {
    throw new Error("Product not found");
  }

  product.isActive = isActive;
  product.updatedBy = userId;

  await product.save();

  return product;
};

export const deleteProductService = async (
  id,
  userId
) => {
  const product = await Product.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!product) {
    throw new Error("Product not found");
  }

  product.isDeleted = true;
  product.updatedBy = userId;

  await product.save();

  return;
};