import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";

import {
  createCategoryService,
  deleteCategoryService,
  getAllCategoriesService,
  getCategoryByIdService,
  updateCategoryService,
  updateCategoryStatusService,
} from "./category.service.js";

export const getAllCategories = async (req, res) => {
  try {
    const data = await getAllCategoriesService();

    return sendResponse(
      res,
      200,
      true,
      "Categories fetched successfully",
      data
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const data = await getCategoryByIdService(req.params.id);

    return sendResponse(
      res,
      200,
      true,
      "Category fetched successfully",
      data
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const createCategory = async (req, res) => {
  try {
    const data = await createCategoryService(
      req.user._id,
      req.body,
      req.file
    );

    return sendResponse(
      res,
      201,
      true,
      "Category created successfully",
      data
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateCategory = async (req, res) => {
  try {
    const data = await updateCategoryService(
      req.params.id,
      req.user._id,
      req.body,
      req.file
    );

    return sendResponse(
      res,
      200,
      true,
      "Category updated successfully",
      data
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateCategoryStatus = async (
  req,
  res
) => {
  try {
    const data = await updateCategoryStatusService(
      req.params.id,
      req.user._id,
      req.body.isActive
    );

    return sendResponse(
      res,
      200,
      true,
      "Category status updated successfully",
      data
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const deleteCategory = async (req, res) => {
  try {
    await deleteCategoryService(
      req.params.id,
      req.user._id
    );

    return sendResponse(
      res,
      200,
      true,
      "Category deleted successfully"
    );
  } catch (error) {
    return sendError(res, error);
  }
};