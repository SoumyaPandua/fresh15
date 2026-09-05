import slugify from "slugify";
import Product from "./product.model.js";
import Category from "../category/category.model.js";
import Inventory from "../inventory/inventory.model.js";
import { uploadImage } from "../../config/cloudinary.js";
import { parsePagination, buildPagination } from "../../utils/pagination.js";
import { processBackInStockAlertService, processPriceDropAlertService } from "../productAlert/productAlert.service.js";
import AppError from "../../utils/AppError.js";
import {
  deleteProductFromSearch,
  indexProductInSearch,
  searchProductsInElasticsearch,
} from "./product-search.service.js";

const getInventorySnapshot = async (productIds) => {
  const rows = await Inventory.find({ productId: { $in: productIds } }).select("productId currentStock availableStock").lean();
  return new Map(rows.map((row) => [String(row.productId), row]));
};

const imageFolder = (category) => {
  const slug = String(category?.slug || category?.name || "uncategorized")
    .trim().replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "uncategorized";
  return `fresh15/products/${slug}`;
};

const syncSearchProduct = (productId) => {
  void indexProductInSearch(productId).catch((error) => {
    console.error("Elasticsearch product sync failed:", error.message);
  });
};

export const getAllProductsService = async (query = {}) => {
  if (String(query.search || "").trim()) {
    const elasticResults = await searchProductsInElasticsearch(query);
    if (elasticResults) return elasticResults;
  }

  const filter = { isDeleted: false };
  const categoryFilter = query.categoryId || query.category;
  if (categoryFilter) filter.categoryId = categoryFilter;
  if (query.isFeatured !== undefined) filter.isFeatured = query.isFeatured === "true";
  if (query.isActive !== undefined) filter.isActive = query.isActive === "true";

  if (query.search) {
    const search = String(query.search).trim();
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const categoryMatches = await Category.find({
      isDeleted: false,
      isActive: true,
      $or: [{ name: { $regex: escaped, $options: "i" } }, { slug: { $regex: escaped, $options: "i" } }],
    }).select("_id").lean();
    filter.$or = [
      { $text: { $search: search } },
      ...(categoryMatches.length ? [{ categoryId: { $in: categoryMatches.map((x) => x._id) } }] : []),
    ];
  }

  const pagination = parsePagination(query);
  const base = Product.find(filter).populate("categoryId", "name slug").sort({ createdAt: -1 });

  if (!pagination.hasPagination) {
    const products = await base.lean();
    const inventory = await getInventorySnapshot(products.map((p) => p._id));
    return products.map((product) => ({
      ...product,
      stock: Number(inventory.get(String(product._id))?.availableStock ?? 0),
    }));
  }

  const [products, total] = await Promise.all([
    base.skip(pagination.skip).limit(pagination.limit).lean(),
    Product.countDocuments(filter),
  ]);
  const inventory = await getInventorySnapshot(products.map((p) => p._id));
  return {
    items: products.map((product) => ({
      ...product,
      stock: Number(inventory.get(String(product._id))?.availableStock ?? 0),
    })),
    pagination: buildPagination({ page: pagination.page, limit: pagination.limit, total }),
  };
};

export const getProductByIdService = async (id) => {
  const product = await Product.findOne({ _id: id, isDeleted: false }).populate("categoryId", "name image slug").lean();
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  const inventory = await Inventory.findOne({ productId: id }).select("availableStock currentStock").lean();
  return { ...product, stock: Number(inventory?.availableStock ?? 0) };
};

export const createProductService = async (userId, body, files) => {
  const category = await Category.findOne({ _id: body.categoryId, isDeleted: false, isActive: true });
  if (!category) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");

  const sku = String(body.sku).trim().toUpperCase();
  const slug = slugify(body.name, { lower: true, strict: true });
  if (await Product.findOne({ slug, isDeleted: false })) throw new AppError(409, "PRODUCT_ALREADY_EXISTS", "Product already exists");
  if (await Product.findOne({ sku, isDeleted: false })) throw new AppError(409, "SKU_ALREADY_EXISTS", "SKU already exists");

  const mrp = Number(body.mrp);
  const sellingPrice = Number(body.sellingPrice);
  if (sellingPrice > mrp) throw new AppError(422, "INVALID_PRICE", "Selling price cannot be greater than MRP");

  const initialStock = Math.max(0, Number(body.stock) || 0);
  const images = [];
  for (const file of files || []) images.push((await uploadImage(file.buffer, imageFolder(category))).secure_url);

  const product = await Product.create({
    categoryId: body.categoryId,
    name: body.name,
    slug,
    description: body.description,
    images,
    unit: body.unit,
    weight: body.weight,
    sku,
    mrp,
    sellingPrice,
    stock: 0,
    tags: body.tags || [],
    isVeg: body.isVeg ?? true,
    isFeatured: body.isFeatured ?? false,
    createdBy: userId,
  });

  await Inventory.create({
    productId: product._id,
    currentStock: initialStock,
    availableStock: initialStock,
    reservedStock: 0,
    lowStockThreshold: 10,
    lastRestockedAt: initialStock > 0 ? new Date() : null,
    createdBy: userId,
  });

  const result = await getProductByIdService(product._id);
  syncSearchProduct(product._id);
  return result;
};

export const updateProductService = async (id, userId, body, files) => {
  const product = await Product.findOne({ _id: id, isDeleted: false });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");

  const previousPrice = Number(product.sellingPrice);
  const inventory = await Inventory.findOne({ productId: id });
  let category;

  if (body.categoryId) {
    category = await Category.findOne({ _id: body.categoryId, isDeleted: false, isActive: true });
    if (!category) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
    product.categoryId = body.categoryId;
  } else {
    category = await Category.findById(product.categoryId).select("name slug").lean();
  }

  if (body.name && body.name !== product.name) {
    const slug = slugify(body.name, { lower: true, strict: true });
    if (await Product.findOne({ slug, isDeleted: false, _id: { $ne: id } })) throw new AppError(409, "PRODUCT_ALREADY_EXISTS", "Product name already exists");
    product.name = body.name;
    product.slug = slug;
  }

  if (body.sku && body.sku.toUpperCase() !== product.sku) {
    const sku = body.sku.toUpperCase();
    if (await Product.findOne({ sku, isDeleted: false, _id: { $ne: id } })) throw new AppError(409, "SKU_ALREADY_EXISTS", "SKU already exists");
    product.sku = sku;
  }

  const mrp = body.mrp !== undefined ? Number(body.mrp) : Number(product.mrp);
  const sellingPrice = body.sellingPrice !== undefined ? Number(body.sellingPrice) : Number(product.sellingPrice);
  if (sellingPrice > mrp) throw new AppError(422, "INVALID_PRICE", "Selling price cannot be greater than MRP");

  if (files?.length) {
    product.images = [];
    for (const file of files) product.images.push((await uploadImage(file.buffer, imageFolder(category))).secure_url);
  }

  if (body.description !== undefined) product.description = body.description;
  if (body.unit !== undefined) product.unit = body.unit;
  if (body.weight !== undefined) product.weight = body.weight;
  if (body.mrp !== undefined) product.mrp = mrp;
  if (body.sellingPrice !== undefined) product.sellingPrice = sellingPrice;
  if (body.tags !== undefined) product.tags = body.tags;
  if (body.isVeg !== undefined) product.isVeg = body.isVeg;
  if (body.isFeatured !== undefined) product.isFeatured = body.isFeatured;
  if (body.isActive !== undefined) product.isActive = body.isActive;

  if (body.stock !== undefined) {
    if (!inventory) throw new AppError(409, "INVENTORY_NOT_FOUND", "Inventory not found");
    const previousCurrentStock = Number(inventory.currentStock || 0);
    const nextStock = Number(body.stock);
    if (!Number.isInteger(nextStock) || nextStock < 0) throw new AppError(422, "INVALID_STOCK", "Stock must be a non-negative integer");
    if (nextStock < Number(inventory.reservedStock)) throw new AppError(409, "STOCK_RESERVATION_CONFLICT", `Stock cannot be reduced below reserved quantity (${inventory.reservedStock})`);

    const previousAvailable = Number(inventory.availableStock ?? 0);
    const reserved = Number(inventory.reservedStock || 0);
    inventory.currentStock = nextStock;
    inventory.availableStock = Math.max(0, nextStock - reserved);
    if (nextStock > previousCurrentStock || nextStock > previousAvailable) inventory.lastRestockedAt = new Date();
    inventory.updatedBy = userId;
    await inventory.save();
  }

  product.stock = 0;
  product.updatedBy = userId;
  await product.save();

  try {
    await processPriceDropAlertService({ productId: product._id, previousPrice, currentPrice: Number(product.sellingPrice) });
    if (body.stock !== undefined && inventory) {
      const available = Number(inventory.availableStock ?? 0);
      if (available > 0) await processBackInStockAlertService({ productId: product._id, previousAvailableStock: 0, currentAvailableStock: available });
    }
  } catch (error) {
    console.error("Product alert processing failed:", error.message);
  }

  const result = await getProductByIdService(product._id);
  syncSearchProduct(product._id);
  return result;
};

export const updateProductStatusService = async (id, userId, isActive) => {
  const product = await Product.findOne({ _id: id, isDeleted: false });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  product.isActive = isActive;
  product.stock = 0;
  product.updatedBy = userId;
  await product.save();

  const result = await getProductByIdService(product._id);
  syncSearchProduct(product._id);
  return result;
};

export const deleteProductService = async (id, userId) => {
  const product = await Product.findOne({ _id: id, isDeleted: false });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  product.isDeleted = true;
  product.stock = 0;
  product.updatedBy = userId;
  await product.save();

  void deleteProductFromSearch(product._id).catch((error) => {
    console.error("Elasticsearch product delete sync failed:", error.message);
  });
};
