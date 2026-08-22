import { body, param, query } from "express-validator";
const itemRules = [
  body("items").optional().isArray({ max: 40 }).withMessage("A grocery list can contain at most 40 items"),
  body("items.*.productId").optional().isMongoId().withMessage("Invalid product in grocery list"),
  body("items.*.quantity").optional().isInt({ min: 1, max: 50 }).withMessage("Quantity must be between 1 and 50"),
];
export const createGroceryListValidation = [
  body("name").trim().notEmpty().withMessage("List name is required").isLength({ max: 80 }).withMessage("List name cannot exceed 80 characters"),
  body("description").optional({ nullable: true }).trim().isLength({ max: 240 }).withMessage("Description cannot exceed 240 characters"),
  body("listType").optional().isIn(["WEEKLY_ESSENTIALS", "CUSTOM"]).withMessage("Invalid grocery list type"),
  body("repeatInterval").optional().isIn(["NONE", "WEEKLY"]).withMessage("Invalid repeat interval"),
  body("isPinned").optional().isBoolean().withMessage("isPinned must be boolean"),
  ...itemRules,
];
export const updateGroceryListValidation = [
  param("id").isMongoId().withMessage("Invalid grocery list id"),
  body("name").optional().trim().notEmpty().isLength({ max: 80 }).withMessage("Invalid list name"),
  body("description").optional({ nullable: true }).trim().isLength({ max: 240 }).withMessage("Description cannot exceed 240 characters"),
  body("listType").optional().isIn(["WEEKLY_ESSENTIALS", "CUSTOM"]).withMessage("Invalid grocery list type"),
  body("repeatInterval").optional().isIn(["NONE", "WEEKLY"]).withMessage("Invalid repeat interval"),
  body("isPinned").optional().isBoolean().withMessage("isPinned must be boolean"),
  ...itemRules,
];
export const groceryListIdValidation = [param("id").isMongoId().withMessage("Invalid grocery list id")];
export const adminGroceryListValidation = [query("limit").optional().isInt({ min: 1, max: 200 }).withMessage("Invalid limit")];
