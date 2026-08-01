import sendResponse from "../../utils/sendResponse.js";

import {
  createProductService,
  deleteProductService,
  getAllProductsService,
  getProductByIdService,
  updateProductService,
  updateProductStatusService,
} from "./product.service.js";

export const getAllProducts = async (req, res) => {
  try {
    const products = await getAllProductsService(req.query);

    return sendResponse(
      res,
      200,
      true,
      "Products fetched successfully",
      products
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await getProductByIdService(req.params.id);

    return sendResponse(
      res,
      200,
      true,
      "Product fetched successfully",
      product
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

export const createProduct = async (req, res) => {
  try {
    const product = await createProductService(
      req.user._id,
      req.body,
      req.files
    );

    return sendResponse(
      res,
      201,
      true,
      "Product created successfully",
      product
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await updateProductService(
      req.params.id,
      req.user._id,
      req.body,
      req.files
    );

    return sendResponse(
      res,
      200,
      true,
      "Product updated successfully",
      product
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

export const updateProductStatus = async (req, res) => {
  try {
    const product = await updateProductStatusService(
      req.params.id,
      req.user._id,
      req.body.isActive
    );

    return sendResponse(
      res,
      200,
      true,
      "Product status updated successfully",
      product
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await deleteProductService(
      req.params.id,
      req.user._id
    );

    return sendResponse(
      res,
      200,
      true,
      "Product deleted successfully"
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};