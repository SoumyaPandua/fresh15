import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import { cached, cacheDeleteByPrefix, stableCacheKey } from "../../utils/cache.js";
import {
  createProductService,
  deleteProductService,
  getAllProductsService,
  getProductByIdService,
  updateProductService,
  updateProductStatusService,
} from "./product.service.js";

const publicProductKey = (query) => stableCacheKey("customer:products", query);

export const getAllProducts = async (req, res) => {
  try {
    const hasSearch = Boolean(req.query.search || req.query.categoryId || req.query.category || req.query.isFeatured || req.query.isActive);
    const hasPagination = Boolean(req.query.page || req.query.limit);
    const products = !hasSearch && !hasPagination
      ? await cached(publicProductKey({}), 60, () => getAllProductsService(req.query))
      : await getAllProductsService(req.query);

    return sendResponse(res, 200, true, "Products fetched successfully", products);
  } catch (error) {
    return sendError(res, error);
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await cached(
      `customer:product:${req.params.id}`,
      300,
      () => getProductByIdService(req.params.id),
    );
    return sendResponse(res, 200, true, "Product fetched successfully", product);
  } catch (error) {
    return sendError(res, error);
  }
};

const invalidateProducts = async (id) => {
  await Promise.all([
    cacheDeleteByPrefix("customer:products"),
    id ? cacheDeleteByPrefix(`customer:product:${id}`) : Promise.resolve(),
  ]);
};

export const createProduct = async (req, res) => {
  try {
    const product = await createProductService(req.user._id, req.body, req.files);
    await invalidateProducts(product?._id);
    return sendResponse(res, 201, true, "Product created successfully", product);
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await updateProductService(req.params.id, req.user._id, req.body, req.files);
    await invalidateProducts(req.params.id);
    return sendResponse(res, 200, true, "Product updated successfully", product);
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateProductStatus = async (req, res) => {
  try {
    const product = await updateProductStatusService(req.params.id, req.user._id, req.body.isActive);
    await invalidateProducts(req.params.id);
    return sendResponse(res, 200, true, "Product status updated successfully", product);
  } catch (error) {
    return sendError(res, error);
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await deleteProductService(req.params.id, req.user._id);
    await invalidateProducts(req.params.id);
    return sendResponse(res, 200, true, "Product deleted successfully");
  } catch (error) {
    return sendError(res, error);
  }
};
