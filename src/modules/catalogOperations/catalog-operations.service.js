
import crypto from "node:crypto";
import Product from "../product/product.model.js";
import Category from "../category/category.model.js";
import Inventory from "../inventory/inventory.model.js";
import CatalogImportJob from "./catalog-import.model.js";
import cloudinary from "../../config/cloudinary.js";
import AppError from "../../utils/AppError.js";
import { writeAuditLog } from "../audit/audit.service.js";

const MAX_ROWS = 500;
const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 5;
const IMPORT_BATCH = 3;

const normalizeHeader = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
const normalizeText = (value, max = 1000) => String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
const toNumber = (value) => {
  if (value === "" || value == null) return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};

const safeFileName = (value) => normalizeText(value, 160).replace(/[^a-zA-Z0-9._-]/g, "_") || "catalog.csv";
const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const catalogTemplateCsv = () => {
  const headers = ["sku", "name", "description", "category", "unit", "weight", "mrp", "sellingPrice", "stock", "lowStockThreshold", "tags", "isVeg", "isFeatured", "imageUrl1", "imageUrl2", "imageUrl3", "imageUrl4", "imageUrl5"];
  const sample = ["F15-BAN-001", "Banana", "Fresh bananas", "fruits", "KG", "1", "60", "49", "50", "10", "banana,fresh", "true", "false", "https://example.com/banana.jpg", "", "", "", ""];
  return `${headers.map(escapeCsv).join(",")}\n${sample.map(escapeCsv).join(",")}\n`;
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      cell = "";
      if (row.some((v) => String(v).trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (quoted) throw new AppError(422, "CSV_UNTERMINATED_QUOTE", "CSV contains an unterminated quoted field");
  if (cell !== "" || row.length) {
    row.push(cell.replace(/\r$/, ""));
    if (row.some((v) => String(v).trim() !== "")) rows.push(row);
  }
  return rows;
};

const formulaLike = (value) => /^[=+@]/.test(String(value ?? "").trim());
const safeHttpUrl = (value) => {
  try {
    const url = new URL(String(value));
    if (!["http:", "https:"].includes(url.protocol) || url.href.length > 2048) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal" || host === "169.254.169.254") return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b, c, d] = host.split(".").map(Number);
      const privateIp = a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
      if (privateIp) return false;
    }
    return true;
  } catch {
    return false;
  }
};

const parseRow = (headers, values, rowNumber) => {
  const raw = {};
  headers.forEach((header, i) => { raw[header] = normalizeText(values[i], 2000); });

  const normalized = {
    sku: normalizeText(raw.sku, 64).toUpperCase(),
    name: normalizeText(raw.name, 160),
    description: normalizeText(raw.description, 1000),
    category: normalizeText(raw.category, 120),
    unit: normalizeText(raw.unit, 20).toUpperCase(),
    weight: toNumber(raw.weight),
    mrp: toNumber(raw.mrp),
    sellingPrice: toNumber(raw.sellingprice),
    stock: toNumber(raw.stock),
    lowStockThreshold: toNumber(raw.lowstockthreshold),
    tags: normalizeText(raw.tags, 1000).split(",").map((x) => x.trim()).filter(Boolean).slice(0, 30),
    isVeg: raw.isveg === "" ? true : String(raw.isveg).toLowerCase() === "true",
    isFeatured: String(raw.isfeatured).toLowerCase() === "true",
    images: Array.from({ length: MAX_IMAGES }, (_, i) => normalizeText(raw[`imageurl${i + 1}`] || raw[`image_url${i + 1}`], 2048)).filter(Boolean),
  };

  const issues = [];
  const warnings = [];
  if (!normalized.sku) issues.push("SKU is required");
  if (!normalized.name) issues.push("Name is required");
  if (!normalized.category) issues.push("Category is required");
  if (!["KG", "GRAM", "LITER", "ML", "PIECE", "PACK", "DOZEN", "BUNDLE"].includes(normalized.unit)) issues.push("Invalid unit");
  if (normalized.weight == null || normalized.weight < 0) issues.push("Weight must be a non-negative number");
  if (normalized.mrp == null || normalized.mrp <= 0) issues.push("MRP must be greater than 0");
  if (normalized.sellingPrice == null || normalized.sellingPrice < 0) issues.push("Selling price must be non-negative");
  if (normalized.mrp != null && normalized.sellingPrice != null && normalized.sellingPrice > normalized.mrp) issues.push("Selling price cannot exceed MRP");
  if (normalized.stock == null || !Number.isInteger(normalized.stock) || normalized.stock < 0) issues.push("Stock must be a non-negative integer");
  if (normalized.lowStockThreshold != null && (!Number.isInteger(normalized.lowStockThreshold) || normalized.lowStockThreshold < 0)) issues.push("Low stock threshold must be a non-negative integer");
  if (normalized.description.length < 20) warnings.push("Description is short");
  if (!normalized.images.length) warnings.push("No product image supplied");
  if (!normalized.tags.length) warnings.push("Few/no tags supplied");
  for (const image of normalized.images) if (!safeHttpUrl(image)) issues.push(`Invalid or unsafe image URL: ${image.slice(0, 120)}`);
  for (const value of Object.values(raw)) if (formulaLike(value)) issues.push("CSV contains formula-like input");

  return { rowNumber, sku: normalized.sku, raw, normalized, issues, warnings };
};

const loadNormalizedRows = async (csvText) => {
  const text = String(csvText || "");
  if (!text.trim()) throw new AppError(422, "CSV_EMPTY", "CSV file is empty");
  if (Buffer.byteLength(text, "utf8") > MAX_CSV_BYTES) throw new AppError(413, "CSV_TOO_LARGE", "CSV file must be 2 MB or smaller");

  const matrix = parseCsv(text);
  if (matrix.length < 2) throw new AppError(422, "CSV_HEADER_REQUIRED", "CSV must contain a header and at least one data row");
  if (matrix.length - 1 > MAX_ROWS) throw new AppError(413, "CSV_TOO_MANY_ROWS", `Maximum ${MAX_ROWS} rows are allowed per import`);

  const headers = matrix[0].map(normalizeHeader).filter(Boolean);
  const required = ["sku", "name", "category", "unit", "mrp", "sellingprice", "stock"];
  const missing = required.filter((field) => !headers.includes(field));
  if (missing.length) throw new AppError(422, "CSV_REQUIRED_COLUMNS", `Missing required columns: ${missing.join(", ")}`);

  const duplicateColumns = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateColumns.length) throw new AppError(422, "CSV_DUPLICATE_COLUMNS", `Duplicate columns: ${[...new Set(duplicateColumns)].join(", ")}`);

  const rows = matrix.slice(1).map((values, index) => parseRow(headers, values, index + 2));
  const skuCounts = new Map();
  for (const row of rows) skuCounts.set(row.sku, (skuCounts.get(row.sku) || 0) + 1);
  for (const row of rows) if (row.sku && skuCounts.get(row.sku) > 1) row.issues.push("Duplicate SKU in CSV");

  const [existing, categories] = await Promise.all([
    Product.find({ sku: { $in: rows.map((row) => row.sku).filter(Boolean) }, isDeleted: false }).select("_id sku name").lean(),
    Category.find({ isDeleted: false }).select("_id name slug").lean(),
  ]);
  const existingMap = new Map(existing.map((product) => [product.sku, product]));
  const categoryMap = new Map();
  for (const category of categories) {
    categoryMap.set(category.name.toLowerCase(), category);
    categoryMap.set(category.slug.toLowerCase(), category);
  }

  return rows.map((row) => {
    const category = categoryMap.get(row.normalized.category.toLowerCase());
    if (!category) row.issues.push(`Category not found: ${row.normalized.category}`);
    if (row.sku && existingMap.has(row.sku)) row.warnings.push(`Existing SKU will be updated: ${existingMap.get(row.sku).name}`);
    row.normalized.categoryId = category?._id || null;
    return row;
  });
};

export const previewCatalogImport = async (csvText) => {
  const rows = await loadNormalizedRows(csvText);
  const validCount = rows.filter((row) => row.issues.length === 0).length;
  return {
    fileName: "catalog.csv",
    rowCount: rows.length,
    validCount,
    invalidCount: rows.length - validCount,
    warningCount: rows.reduce((sum, row) => sum + row.warnings.length, 0),
    canCommit: validCount > 0,
    rows: rows.map((row) => ({
      rowNumber: row.rowNumber,
      sku: row.sku,
      name: row.normalized.name,
      category: row.normalized.category,
      sellingPrice: row.normalized.sellingPrice,
      mrp: row.normalized.mrp,
      stock: row.normalized.stock,
      imageCount: row.normalized.images.length,
      issues: row.issues,
      warnings: row.warnings,
    })),
  };
};

export const createCatalogImport = async (userId, csvText, fileName = "catalog.csv") => {
  const rows = await loadNormalizedRows(csvText);
  const validRows = rows.filter((row) => row.issues.length === 0);
  if (!validRows.length) throw new AppError(422, "CSV_NO_VALID_ROWS", "No valid rows are available to import");

  const importKey = crypto.createHash("sha256").update(`${userId}:${csvText}`).digest("hex");
  const existing = await CatalogImportJob.findOne({ importKey });
  if (existing) return existing;

  const job = await CatalogImportJob.create({
    importKey,
    createdBy: userId,
    status: "QUEUED",
    fileName: safeFileName(fileName),
    rowCount: rows.length,
    skippedCount: rows.length - validRows.length,
    rows: rows.map((row) => ({
      rowNumber: row.rowNumber,
      sku: row.sku,
      raw: row.raw,
      normalized: row.normalized,
      issues: row.issues,
      warnings: row.warnings,
      status: row.issues.length ? "SKIPPED" : "PENDING",
      imageStatus: row.issues.length ? "NOT_REQUIRED" : (row.normalized.images.length ? "PENDING" : "NOT_REQUIRED"),
    })),
  });

  await writeAuditLog({
    actorId: userId,
    action: "CATALOG_IMPORT_QUEUED",
    resourceType: "CatalogImportJob",
    resourceId: job._id,
    details: { rowCount: job.rowCount, validCount: validRows.length, skippedCount: job.skippedCount, fileName: job.fileName },
    statusCode: 202,
  });

  return job;
};

const cloudinaryFolder = (category) => `fresh15/products/${String(category?.slug || category?.name || "uncategorized").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "uncategorized"}`;

const processImages = async (urls, category) => {
  const images = [];
  for (const url of urls.slice(0, MAX_IMAGES)) {
    if (!safeHttpUrl(url)) throw new AppError(422, "INVALID_IMAGE_URL", "Image URL is invalid or unsafe");
    const result = await cloudinary.uploader.upload(url, {
      folder: cloudinaryFolder(category),
      resource_type: "image",
      use_filename: false,
      unique_filename: true,
      transformation: [{ width: 1600, height: 1600, crop: "limit", quality: "auto", fetch_format: "auto" }],
      eager: [
        { width: 1200, height: 1200, crop: "limit", quality: "auto", fetch_format: "auto" },
        { width: 600, height: 600, crop: "fill", gravity: "auto", quality: "auto", fetch_format: "auto" },
        { width: 300, height: 300, crop: "fill", gravity: "auto", quality: "auto", fetch_format: "auto" },
      ],
      eager_async: false,
    });
    images.push(result.secure_url);
  }
  return images;
};

const buildUniqueSlug = async (name, sku, currentId = null) => {
  const base = String(name || sku).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "product";
  const suffix = String(sku).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  let slug = `${base}-${suffix}`.replace(/-+/g, "-");
  const query = { slug, isDeleted: false };
  if (currentId) query._id = { $ne: currentId };
  if (await Product.exists(query)) slug = `${slug}-${crypto.randomBytes(3).toString("hex")}`;
  return slug;
};

const finalizeInventory = async (productId, data, userId) => {
  let inventory = await Inventory.findOne({ productId });
  const previousCurrentStock = Number(inventory?.currentStock || 0);
  if (!inventory) {
    inventory = await Inventory.create({
      productId,
      currentStock: data.stock,
      availableStock: data.stock,
      reservedStock: 0,
      lowStockThreshold: data.lowStockThreshold ?? 10,
      lastRestockedAt: data.stock > 0 ? new Date() : null,
      createdBy: userId,
    });
    return inventory;
  }
  if (data.stock < Number(inventory.reservedStock || 0)) throw new AppError(409, "STOCK_RESERVATION_CONFLICT", `Stock cannot be below reserved quantity (${inventory.reservedStock})`);
  inventory.currentStock = data.stock;
  inventory.lowStockThreshold = data.lowStockThreshold ?? inventory.lowStockThreshold;
  if (data.stock > previousCurrentStock) inventory.lastRestockedAt = new Date();
  inventory.updatedBy = userId;
  await inventory.save();
  return inventory;
};

const upsertRow = async (job, row) => {
  const data = row.normalized;
  const category = await Category.findById(data.categoryId).select("_id name slug").lean();
  if (!category) throw new AppError(409, "CATEGORY_NOT_FOUND", "Category is no longer available");

  const existing = await Product.findOne({ sku: row.sku, isDeleted: false });
  const slug = existing?.slug || await buildUniqueSlug(data.name, row.sku, existing?._id);
  const images = await processImages(data.images || [], category);
  const productData = {
    categoryId: category._id,
    name: data.name,
    slug,
    description: data.description,
    unit: data.unit,
    weight: data.weight,
    sku: row.sku,
    mrp: data.mrp,
    sellingPrice: data.sellingPrice,
    stock: 0,
    tags: data.tags,
    isVeg: data.isVeg,
    isFeatured: data.isFeatured,
    isActive: true,
    isDeleted: false,
    updatedBy: job.createdBy,
  };
  if (images.length) productData.images = images;

  const product = existing || new Product({ ...productData, createdBy: job.createdBy });
  Object.assign(product, productData);
  if (!product.createdBy) product.createdBy = job.createdBy;
  await product.save();
  await finalizeInventory(product._id, data, job.createdBy);
  return product;
};

export const processCatalogImportJob = async (jobId) => {
  const job = await CatalogImportJob.findById(jobId);
  if (!job || ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "CANCELLED"].includes(job.status)) return job;

  job.status = "PROCESSING";
  job.startedAt = job.startedAt || new Date();
  await job.save();

  while (true) {
    const current = await CatalogImportJob.findById(job._id);
    const row = current?.rows.find((item) => item.status === "PENDING");
    if (!row) break;
    try {
      row.imageStatus = row.normalized.images?.length ? "PROCESSING" : "NOT_REQUIRED";
      await current.save();
      const product = await upsertRow(current, row);
      row.status = "PROCESSED";
      row.imageStatus = row.normalized.images?.length ? "PROCESSED" : "NOT_REQUIRED";
      row.productId = product._id;
      current.successCount += 1;
    } catch (error) {
      row.status = "FAILED";
      row.imageStatus = row.normalized.images?.length ? "FAILED" : "NOT_REQUIRED";
      row.error = normalizeText(error?.message || "Import failed", 500);
      current.failedCount += 1;
    }
    current.processedCount = current.successCount + current.failedCount + current.skippedCount;
    await current.save();
  }

  const finalJob = await CatalogImportJob.findById(job._id);
  if (!finalJob) return null;
  finalJob.status = finalJob.failedCount > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
  finalJob.completedAt = new Date();
  await finalJob.save();

  await writeAuditLog({
    actorId: finalJob.createdBy,
    action: finalJob.status === "COMPLETED" ? "CATALOG_IMPORT_COMPLETED" : "CATALOG_IMPORT_COMPLETED_WITH_ERRORS",
    resourceType: "CatalogImportJob",
    resourceId: finalJob._id,
    details: { rowCount: finalJob.rowCount, successCount: finalJob.successCount, failedCount: finalJob.failedCount, skippedCount: finalJob.skippedCount },
    statusCode: 200,
  });

  return finalJob;
};

export const retryFailedCatalogImport = async (userId, jobId) => {
  const job = await CatalogImportJob.findById(jobId);
  if (!job) throw new AppError(404, "CATALOG_IMPORT_NOT_FOUND", "Catalog import not found");
  const failedRows = job.rows.filter((row) => row.status === "FAILED");
  if (!failedRows.length) throw new AppError(409, "NO_FAILED_ROWS", "This import has no failed rows to retry");
  for (const row of failedRows) {
    row.status = "PENDING";
    row.error = null;
    row.imageStatus = row.normalized.images?.length ? "PENDING" : "NOT_REQUIRED";
  }
  job.failedCount = 0;
  job.processedCount = job.successCount + job.skippedCount;
  job.status = "QUEUED";
  job.startedAt = null;
  job.completedAt = null;
  job.lastError = null;
  await job.save();

  await writeAuditLog({
    actorId: userId,
    action: "CATALOG_IMPORT_RETRY_QUEUED",
    resourceType: "CatalogImportJob",
    resourceId: job._id,
    details: { retryRows: failedRows.length },
    statusCode: 202,
  });
  return job;
};

export const getCatalogImports = async ({ page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const filter = {};
  const [items, total] = await Promise.all([
    CatalogImportJob.find(filter).select("createdBy status fileName rowCount processedCount successCount failedCount skippedCount startedAt completedAt createdAt").populate("createdBy", "name email").sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    CatalogImportJob.countDocuments(filter),
  ]);
  return { items, pagination: { page: safePage, limit: safeLimit, total, pages: Math.max(1, Math.ceil(total / safeLimit)) } };
};

export const getCatalogImport = async (id) => {
  const job = await CatalogImportJob.findById(id).populate("createdBy", "name email").lean();
  if (!job) throw new AppError(404, "CATALOG_IMPORT_NOT_FOUND", "Catalog import not found");
  return job;
};

export const getCatalogImportReportCsv = async (id) => {
  const job = await CatalogImportJob.findById(id).lean();
  if (!job) throw new AppError(404, "CATALOG_IMPORT_NOT_FOUND", "Catalog import not found");
  const headers = ["rowNumber", "sku", "name", "category", "status", "sellingPrice", "mrp", "stock", "issues", "warnings", "error"];
  const rows = job.rows.map((row) => [
    row.rowNumber,
    row.sku,
    row.normalized?.name || "",
    row.normalized?.category || "",
    row.status,
    row.normalized?.sellingPrice ?? "",
    row.normalized?.mrp ?? "",
    row.normalized?.stock ?? "",
    (row.issues || []).join(" | "),
    (row.warnings || []).join(" | "),
    row.error || "",
  ]);
  return `${headers.map(escapeCsv).join(",")}\n${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;
};

const scoreProduct = ({ product, inventory }) => {
  let score = 0;
  const issues = [];
  if (String(product.name || "").trim().length >= 3) score += 15; else issues.push("Missing/short name");
  if (String(product.sku || "").trim()) score += 10; else issues.push("Missing SKU");
  if (product.categoryId) score += 15; else issues.push("Missing category");
  if (String(product.description || "").trim().length >= 40) score += 15; else issues.push("Description needs improvement");
  if (Number(product.mrp) > 0 && Number(product.sellingPrice) >= 0 && Number(product.sellingPrice) <= Number(product.mrp)) score += 15; else issues.push("Invalid pricing");
  if (Array.isArray(product.images) && product.images.length > 0) score += 15; else issues.push("No image");
  if (Array.isArray(product.tags) && product.tags.length >= 2) score += 5; else issues.push("Few/no tags");
  if (inventory) score += 10; else issues.push("Inventory record missing");
  return { score, grade: score >= 85 ? "GOOD" : score >= 65 ? "NEEDS_WORK" : "POOR", issues };
};

export const getCatalogQuality = async ({ limit = 100 } = {}) => {
  const safeLimit = Math.min(200, Math.max(10, Number(limit) || 100));
  const products = await Product.find({ isDeleted: false }).populate("categoryId", "name slug").sort({ updatedAt: -1 }).lean();
  const inventory = await Inventory.find({ productId: { $in: products.map((product) => product._id) } }).select("productId availableStock").lean();
  const invMap = new Map(inventory.map((row) => [String(row.productId), row]));
  const items = products.map((product) => {
    const quality = scoreProduct({ product, inventory: invMap.get(String(product._id)) });
    const stock = Number(invMap.get(String(product._id))?.availableStock ?? 0);
    return {
      id: String(product._id),
      name: product.name,
      sku: product.sku,
      category: product.categoryId?.name || "—",
      image: product.images?.[0] || null,
      sellingPrice: Number(product.sellingPrice || 0),
      stock,
      isActive: product.isActive !== false,
      ...quality,
    };
  }).sort((a, b) => a.score - b.score);

  const total = items.length;
  const averageScore = total ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / total) : 0;
  return {
    summary: {
      total,
      averageScore,
      good: items.filter((item) => item.grade === "GOOD").length,
      needsWork: items.filter((item) => item.grade === "NEEDS_WORK").length,
      poor: items.filter((item) => item.grade === "POOR").length,
      missingImages: items.filter((item) => item.issues.includes("No image")).length,
      badPricing: items.filter((item) => item.issues.includes("Invalid pricing")).length,
      lowStock: items.filter((item) => item.stock > 0 && item.stock <= 10).length,
      outOfStock: items.filter((item) => item.stock === 0).length,
    },
    items: items.slice(0, safeLimit),
  };
};

export const getCatalogOperationsOverview = async () => {
  const [products, activeProducts, categories, imports, quality] = await Promise.all([
    Product.countDocuments({ isDeleted: false }),
    Product.countDocuments({ isDeleted: false, isActive: true }),
    Category.countDocuments({ isDeleted: false, isActive: true }),
    CatalogImportJob.countDocuments({}),
    getCatalogQuality({ limit: 200 }),
  ]);

  const inventoryStats = await Inventory.aggregate([
    { $group: { _id: null, totalUnits: { $sum: "$currentStock" }, availableUnits: { $sum: "$availableStock" }, reservedUnits: { $sum: "$reservedStock" } } },
  ]);

  const failedImports = await CatalogImportJob.countDocuments({ status: { $in: ["FAILED", "COMPLETED_WITH_ERRORS"] } });
  const queuedImports = await CatalogImportJob.countDocuments({ status: { $in: ["QUEUED", "PROCESSING"] } });

  return {
    products,
    activeProducts,
    categories,
    imports,
    failedImports,
    queuedImports,
    quality: quality.summary,
    inventory: inventoryStats[0] || { totalUnits: 0, availableUnits: 0, reservedUnits: 0 },
  };
};

export const processPendingCatalogImports = async (limit = IMPORT_BATCH) => {
  const claimed = [];
  for (let i = 0; i < limit; i += 1) {
    const job = await CatalogImportJob.findOneAndUpdate(
      { status: "QUEUED" },
      { $set: { status: "PROCESSING", startedAt: new Date() } },
      { sort: { createdAt: 1 }, new: true },
    );
    if (!job) break;
    claimed.push(job._id);
  }
  for (const jobId of claimed) {
    try {
      await processCatalogImportJob(jobId);
    } catch (error) {
      await CatalogImportJob.updateOne(
        { _id: jobId },
        { $set: { status: "FAILED", lastError: normalizeText(error?.message || "Import failed"), completedAt: new Date() } },
      );
    }
  }
  return claimed.length;
};
