import Product from "./product.model.js";
import Inventory from "../inventory/inventory.model.js";
import {
  elasticsearchConfig,
  elasticsearchRequest,
  isElasticsearchConfigured,
} from "../../config/elasticsearch.js";

const DEFAULT_SEARCH_SIZE = 100;
const DEFAULT_SYNC_INTERVAL_MS = 15000;
const FAILURE_COOLDOWN_MS = 30000;
const MAX_SYNC_BATCH = 250;

const indexBody = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },
  mappings: {
    dynamic: false,
    properties: {
      productId: { type: "keyword" },
      categoryId: { type: "keyword" },
      categoryName: {
        type: "text",
        fields: { keyword: { type: "keyword" } },
      },
      categorySlug: { type: "keyword" },
      name: {
        type: "search_as_you_type",
        fields: { keyword: { type: "keyword" } },
      },
      slug: { type: "keyword" },
      description: { type: "text" },
      tags: {
        type: "text",
        fields: { keyword: { type: "keyword" } },
      },
      sku: { type: "keyword" },
      unit: { type: "keyword" },
      weight: { type: "double" },
      mrp: { type: "double" },
      sellingPrice: { type: "double" },
      averageRating: { type: "double" },
      totalReviews: { type: "integer" },
      isVeg: { type: "boolean" },
      isFeatured: { type: "boolean" },
      isActive: { type: "boolean" },
      isDeleted: { type: "boolean" },
      createdAt: { type: "date" },
      updatedAt: { type: "date" },
    },
  },
};

let indexReady = false;
let circuitOpenUntil = 0;
let syncTimer = null;
let syncRunning = false;
let lastSyncAt = null;

const markSearchFailure = (error) => {
  circuitOpenUntil = Date.now() + FAILURE_COOLDOWN_MS;
  console.error("Elasticsearch search unavailable:", error?.message || error);
};

const circuitOpen = () => circuitOpenUntil > Date.now();

const normalizeId = (value) => String(value?._id || value?.productId || value);

const normalizeCategory = (category) => {
  if (!category) {
    return { id: "", name: "", slug: "" };
  }

  return {
    id: normalizeId(category),
    name: String(category.name || ""),
    slug: String(category.slug || ""),
  };
};

const toSearchDocument = (product) => {
  const category = normalizeCategory(product.categoryId);

  return {
    productId: String(product._id),
    categoryId: category.id,
    categoryName: category.name,
    categorySlug: category.slug,
    name: String(product.name || ""),
    slug: String(product.slug || ""),
    description: String(product.description || ""),
    tags: Array.isArray(product.tags) ? product.tags.map((tag) => String(tag)) : [],
    sku: String(product.sku || ""),
    unit: String(product.unit || ""),
    weight: Number(product.weight || 0),
    mrp: Number(product.mrp || 0),
    sellingPrice: Number(product.sellingPrice || 0),
    averageRating: Number(product.averageRating || 0),
    totalReviews: Number(product.totalReviews || 0),
    isVeg: product.isVeg !== false,
    isFeatured: product.isFeatured === true,
    isActive: product.isActive !== false,
    isDeleted: product.isDeleted === true,
    createdAt: product.createdAt || new Date(),
    updatedAt: product.updatedAt || new Date(),
  };
};

const ensureIndex = async () => {
  if (!isElasticsearchConfigured() || indexReady) return false;
  if (circuitOpen()) return false;

  try {
    await elasticsearchRequest(
      `/${encodeURIComponent(elasticsearchConfig.index)}`,
      { method: "HEAD" },
    );
    indexReady = true;
    return true;
  } catch (error) {
    if (Number(error?.status) !== 404) {
      markSearchFailure(error);
      return false;
    }
  }

  try {
    await elasticsearchRequest(
      `/${encodeURIComponent(elasticsearchConfig.index)}`,
      {
        method: "PUT",
        body: JSON.stringify(indexBody),
      },
    );
    indexReady = true;
    return true;
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (
      Number(error?.status) === 400 &&
      (message.includes("resource_already_exists") || message.includes("already exists"))
    ) {
      indexReady = true;
      return true;
    }

    markSearchFailure(error);
    return false;
  }
};

const indexProductDocument = async (product) => {
  const ready = await ensureIndex();
  if (!ready) return false;

  const id = String(product._id);
  await elasticsearchRequest(
    `/${encodeURIComponent(elasticsearchConfig.index)}/_doc/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(toSearchDocument(product)),
    },
  );

  return true;
};

export const indexProductInSearch = async (productId) => {
  if (!isElasticsearchConfigured()) return false;

  try {
    const product = await Product.findById(productId)
      .populate("categoryId", "name slug")
      .lean();

    if (!product) return false;

    return await indexProductDocument(product);
  } catch (error) {
    markSearchFailure(error);
    return false;
  }
};

export const deleteProductFromSearch = async (productId) => {
  if (!isElasticsearchConfigured() || circuitOpen()) return false;

  try {
    const ready = await ensureIndex();
    if (!ready) return false;

    await elasticsearchRequest(
      `/${encodeURIComponent(elasticsearchConfig.index)}/_doc/${encodeURIComponent(productId)}`,
      { method: "DELETE" },
    );

    return true;
  } catch (error) {
    if (Number(error?.status) === 404) return true;
    markSearchFailure(error);
    return false;
  }
};

const bulkIndexProducts = async (products) => {
  if (!products.length) return true;

  const lines = [];
  for (const product of products) {
    lines.push(
      JSON.stringify({
        index: {
          _index: elasticsearchConfig.index,
          _id: String(product._id),
        },
      }),
    );
    lines.push(JSON.stringify(toSearchDocument(product)));
  }

  const body = `${lines.join("\n")}\n`;
  const result = await elasticsearchRequest("/_bulk", {
    method: "POST",
    headers: { "Content-Type": "application/x-ndjson" },
    body,
  });

  if (result?.errors) {
    const firstError = (result.items || [])
      .map((item) => item?.index?.error)
      .find(Boolean);

    throw new Error(
      firstError?.reason || "Elasticsearch bulk indexing failed",
    );
  }

  return true;
};

export const syncAllProductsToSearch = async () => {
  if (!isElasticsearchConfigured() || circuitOpen() || syncRunning) return false;

  syncRunning = true;

  try {
    const ready = await ensureIndex();
    if (!ready) return false;

    let lastId = null;
    let synced = 0;

    while (true) {
      const filter = { isDeleted: false };
      if (lastId) filter._id = { $gt: lastId };

      const products = await Product.find(filter)
        .populate("categoryId", "name slug")
        .sort({ _id: 1 })
        .limit(MAX_SYNC_BATCH)
        .lean();

      if (!products.length) break;

      await bulkIndexProducts(products);
      synced += products.length;
      lastId = products[products.length - 1]._id;
    }

    lastSyncAt = new Date(Date.now() - 1000);
    console.log(`✅ Elasticsearch full product sync completed: ${synced} products`);
    return true;
  } catch (error) {
    markSearchFailure(error);
    return false;
  } finally {
    syncRunning = false;
  }
};

const buildSearchQuery = (query = {}) => {
  const text = String(query.search || "").trim();
  const filters = [{ term: { isDeleted: false } }];

  if (query.categoryId || query.category) {
    filters.push({
      term: { categoryId: String(query.categoryId || query.category) },
    });
  }

  if (query.isFeatured !== undefined) {
    filters.push({ term: { isFeatured: query.isFeatured === "true" } });
  }

  if (query.isActive !== undefined) {
    filters.push({ term: { isActive: query.isActive === "true" } });
  } else {
    filters.push({ term: { isActive: true } });
  }

  return {
    bool: {
      filter: filters,
      must: [
        {
          bool: {
            should: [
              {
                multi_match: {
                  query: text,
                  type: "best_fields",
                  fields: [
                    "name^6",
                    "name._2gram^5",
                    "name._3gram^5",
                    "sku^4",
                    "tags^3",
                    "categoryName^2",
                    "description",
                  ],
                  operator: "and",
                },
              },
              {
                match_phrase_prefix: {
                  name: { query: text, boost: 6 },
                },
              },
              {
                prefix: {
                  sku: { value: text.toUpperCase(), boost: 5 },
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
      ],
    },
  };
};

const getInventoryMap = async (productIds) => {
  if (!productIds.length) return new Map();

  const rows = await Inventory.find({
    productId: { $in: productIds },
  })
    .select("productId availableStock currentStock")
    .lean();

  return new Map(
    rows.map((row) => [String(row.productId), row]),
  );
};

export const searchProductsInElasticsearch = async (query = {}) => {
  if (!isElasticsearchConfigured() || circuitOpen()) return null;

  const pageProvided = query.page !== undefined || query.limit !== undefined;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(
    Math.max(1, Number(query.limit) || DEFAULT_SEARCH_SIZE),
    DEFAULT_SEARCH_SIZE,
  );

  try {
    const ready = await ensureIndex();
    if (!ready) return null;

    const from = pageProvided ? (page - 1) * limit : 0;
    const size = pageProvided ? limit : DEFAULT_SEARCH_SIZE;

    const result = await elasticsearchRequest(
      `/${encodeURIComponent(elasticsearchConfig.index)}/_search`,
      {
        method: "POST",
        body: JSON.stringify({
          track_total_hits: true,
          from,
          size,
          sort: [
            "_score",
            { createdAt: { order: "desc" } },
          ],
          query: buildSearchQuery(query),
          _source: ["productId"],
        }),
      },
    );

    const hits = result?.hits?.hits || [];
    const ids = hits
      .map((hit) => String(hit?._source?.productId || hit?._id || ""))
      .filter(Boolean);

    if (!ids.length) {
      if (pageProvided) {
        const total = Number(
          result?.hits?.total?.value ?? result?.hits?.total ?? 0,
        );
        return {
          items: [],
          pagination: {
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit)),
          },
        };
      }

      return [];
    }

    const products = await Product.find({
      _id: { $in: ids },
      isDeleted: false,
      ...(query.categoryId || query.category
        ? { categoryId: query.categoryId || query.category }
        : {}),
      ...(query.isActive !== undefined
        ? { isActive: query.isActive === "true" }
        : {}),
      ...(query.isFeatured !== undefined
        ? { isFeatured: query.isFeatured === "true" }
        : {}),
    })
      .populate("categoryId", "name slug")
      .lean();

    const byId = new Map(
      products.map((product) => [String(product._id), product]),
    );

    const ordered = ids
      .map((id) => byId.get(id))
      .filter(Boolean);

    const inventory = await getInventoryMap(
      ordered.map((product) => product._id),
    );

    const withStock = ordered.map((product) => ({
      ...product,
      stock: Number(
        inventory.get(String(product._id))?.availableStock ?? 0,
      ),
    }));

    if (!pageProvided) return withStock;

    const total = Number(
      result?.hits?.total?.value ?? result?.hits?.total ?? withStock.length,
    );

    return {
      items: withStock,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  } catch (error) {
    markSearchFailure(error);
    return null;
  }
};

export const syncChangedProductsToSearch = async () => {
  if (
    !isElasticsearchConfigured() ||
    circuitOpen() ||
    syncRunning
  ) {
    return false;
  }

  const since = lastSyncAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
  const startedAt = new Date();

  syncRunning = true;

  try {
    const ready = await ensureIndex();
    if (!ready) return false;

    let cursor = since;
    let changed = 0;

    while (true) {
      const products = await Product.find({
        updatedAt: { $gte: cursor },
      })
        .populate("categoryId", "name slug")
        .sort({ updatedAt: 1, _id: 1 })
        .limit(MAX_SYNC_BATCH)
        .lean();

      if (!products.length) break;

      await bulkIndexProducts(products);
      changed += products.length;

      const last = products[products.length - 1];
      cursor = last.updatedAt || cursor;

      if (products.length < MAX_SYNC_BATCH) break;
      cursor = new Date(cursor.getTime() + 1);
    }

    lastSyncAt = startedAt;

    if (changed) {
      console.log(`🔄 Elasticsearch incremental product sync: ${changed} products`);
    }

    return true;
  } catch (error) {
    markSearchFailure(error);
    return false;
  } finally {
    syncRunning = false;
  }
};

export const startProductSearchSyncWorker = ({
  intervalMs = DEFAULT_SYNC_INTERVAL_MS,
} = {}) => {
  if (!isElasticsearchConfigured() || syncTimer) return;

  void syncAllProductsToSearch();

  syncTimer = setInterval(() => {
    void syncChangedProductsToSearch();
  }, Math.max(5000, Number(intervalMs) || DEFAULT_SYNC_INTERVAL_MS));

  syncTimer.unref?.();
};

export const stopProductSearchSyncWorker = () => {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = null;
};
