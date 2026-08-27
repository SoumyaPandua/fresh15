import slugify from "slugify";
import Category from "./category.model.js";
import { uploadImage } from "../../config/cloudinary.js";
import { cached, cacheDeleteByPrefix } from "../../utils/cache.js";

export const getAllCategoriesService = async () => cached(
  "customer:categories:all",
  120,
  () => Category.find({ isDeleted: false, isActive: true })
    .sort({ displayOrder: 1, createdAt: -1 })
    .lean(),
);

export const getCategoryByIdService = async (id) => cached(
  `customer:category:${id}`,
  120,
  async () => {
    const category = await Category.findOne({ _id: id, isDeleted: false }).lean();
    if (!category) throw new Error("Category not found");
    return category;
  },
);

const invalidate = async () => {
  await Promise.all([
    cacheDeleteByPrefix("customer:category"),
    cacheDeleteByPrefix("customer:categories"),
  ]);
};

export const createCategoryService = async (userId, body, file) => {
  const slug = slugify(body.name, { lower: true, strict: true });
  if (await Category.findOne({ slug, isDeleted: false })) {
    throw new Error("Category already exists");
  }

  let image = null;
  if (file) image = (await uploadImage(file.buffer, "fresh15/categories")).secure_url;

  const category = await Category.create({ ...body, slug, image, createdBy: userId });
  await invalidate();
  return category;
};

export const updateCategoryService = async (id, userId, body, file) => {
  const category = await Category.findOne({ _id: id, isDeleted: false });
  if (!category) throw new Error("Category not found");

  if (body.name) {
    category.name = body.name;
    category.slug = slugify(body.name, { lower: true, strict: true });
  }
  if (file) category.image = (await uploadImage(file.buffer, "fresh15/categories")).secure_url;
  category.description = body.description ?? category.description;
  category.displayOrder = body.displayOrder ?? category.displayOrder;
  if (body.isActive !== undefined) category.isActive = body.isActive;
  category.updatedBy = userId;
  await category.save();
  await invalidate();
  return category;
};

export const updateCategoryStatusService = async (id, userId, isActive) => {
  const category = await Category.findOne({ _id: id, isDeleted: false });
  if (!category) throw new Error("Category not found");
  category.isActive = isActive;
  category.updatedBy = userId;
  await category.save();
  await invalidate();
  return category;
};

export const deleteCategoryService = async (id, userId) => {
  const category = await Category.findOne({ _id: id, isDeleted: false });
  if (!category) throw new Error("Category not found");
  category.isDeleted = true;
  category.isActive = false;
  category.updatedBy = userId;
  await category.save();
  await invalidate();
};
