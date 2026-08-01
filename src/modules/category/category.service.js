import slugify from "slugify";

import Category from "./category.model.js";
import { uploadImage } from "../../config/cloudinary.js";

export const getAllCategoriesService = async () => {
  return await Category.find({ isDeleted: false }).sort({
    displayOrder: 1,
    createdAt: -1,
  });
};

export const getCategoryByIdService = async (id) => {
  const category = await Category.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!category) {
    throw new Error("Category not found");
  }

  return category;
};

export const createCategoryService = async (
  userId,
  body,
  file
) => {
  const slug = slugify(body.name, {
    lower: true,
    strict: true,
  });

  const exists = await Category.findOne({
    slug,
    isDeleted: false,
  });

  if (exists) {
    throw new Error("Category already exists");
  }

  let image = null;

  if (file) {
    const uploaded = await uploadImage(
      file.buffer,
      "fresh15/categories"
    );

    image = uploaded.secure_url;
  }

  return await Category.create({
    ...body,
    slug,
    image,
    createdBy: userId,
  });
};

export const updateCategoryService = async (
  id,
  userId,
  body,
  file
) => {
  const category = await Category.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!category) {
    throw new Error("Category not found");
  }

  if (body.name) {
    category.name = body.name;

    category.slug = slugify(body.name, {
      lower: true,
      strict: true,
    });
  }

  if (file) {
    const uploaded = await uploadImage(
      file.buffer,
      "fresh15/categories"
    );

    category.image = uploaded.secure_url;
  }

  category.description =
    body.description ?? category.description;

  category.displayOrder =
    body.displayOrder ?? category.displayOrder;

  if (body.isActive !== undefined) {
    category.isActive = body.isActive;
  }

  category.updatedBy = userId;

  await category.save();

  return category;
};

export const updateCategoryStatusService = async (
  id,
  userId,
  isActive
) => {
  const category = await Category.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!category) {
    throw new Error("Category not found");
  }

  category.isActive = isActive;
  category.updatedBy = userId;

  await category.save();

  return category;
};

export const deleteCategoryService = async (
  id,
  userId
) => {
  const category = await Category.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!category) {
    throw new Error("Category not found");
  }

  category.isDeleted = true;
  category.updatedBy = userId;

  await category.save();

  return;
};