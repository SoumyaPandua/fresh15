import Product from "../product/product.model.js";
import Inventory from "../inventory/inventory.model.js";
import AppError from "../../utils/AppError.js";

const clean = (value, limit = 160) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, limit);

const normalize = (value) =>
  clean(value, 200)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const singularize = (word) => {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (word.endsWith("ses")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
};

const canonicalTokens = (value) =>
  normalize(value)
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize);

const canonicalText = (value) => canonicalTokens(value).join(" ");

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const slugifyFallback = (name) =>
  normalize(name).replace(/\s+/g, "-").replace(/-+/g, "-");

const productUrl = (product) =>
  `/products/${encodeURIComponent(product.slug || slugifyFallback(product.name))}`;

const aliasesForToken = (token) => {
  const aliases = new Set([token]);

  if (token === "orange") aliases.add("oranges");
  if (token === "pineapple") aliases.add("pineapples");
  if (token === "mango") aliases.add("mangoes");
  if (token === "potato") aliases.add("potatoes");
  if (token === "tomato") aliases.add("tomatoes");
  if (token === "berry") aliases.add("berries");
  if (token === "leaf") aliases.add("leaves");

  return [...aliases];
};

const buildCandidateRegexes = (queryTokens) => {
  const variants = new Set();

  for (const token of queryTokens) {
    for (const alias of aliasesForToken(token)) {
      variants.add(alias);
    }
  }

  return [...variants].map(
    (value) => new RegExp(escapeRegex(value), "i"),
  );
};

const scoreMatch = (product, queryTokens, queryCanonical, stock) => {
  const nameTokens = canonicalTokens(product.name);
  const slugTokens = canonicalTokens(product.slug || "");
  const tagTokens = Array.isArray(product.tags)
    ? product.tags.flatMap(canonicalTokens)
    : [];
  const description = canonicalText(product.description || "");

  const nameCanonical = nameTokens.join(" ");
  const slugCanonical = slugTokens.join(" ");

  let score = 0;

  if (nameCanonical === queryCanonical) score += 5000;
  if (slugCanonical === queryCanonical) score += 4500;

  if (nameCanonical.includes(queryCanonical)) score += 2000;
  if (slugCanonical.includes(queryCanonical)) score += 1800;

  const matchedTokens = queryTokens.filter(
    (token) =>
      nameTokens.includes(token) ||
      slugTokens.includes(token) ||
      tagTokens.includes(token) ||
      nameTokens.some((value) => value.includes(token)) ||
      slugTokens.some((value) => value.includes(token)),
  );

  score += matchedTokens.length * 500;

  for (const token of queryTokens) {
    if (nameTokens.includes(token)) score += 250;
    else if (nameTokens.some((value) => value.includes(token))) score += 150;

    if (slugTokens.includes(token)) score += 200;
    if (tagTokens.includes(token)) score += 120;
    if (description.includes(token)) score += 40;
  }

  if (stock > 0) score += 100;

  // Prefer a product whose visible name actually contains the searched concept.
  // This prevents a broad category/tag hit from outranking a direct product name.
  if (queryTokens.some((token) => nameTokens.includes(token))) score += 350;

  return score;
};

export async function discoverProducts(query, { limit = 8 } = {}) {
  const rawQuery = clean(query);

  if (!rawQuery) {
    throw new AppError(
      422,
      "PRODUCT_QUERY_REQUIRED",
      "Please tell me what product you would like to see.",
    );
  }

  const queryTokens = canonicalTokens(rawQuery);
  const queryCanonical = queryTokens.join(" ");

  if (!queryTokens.length) return [];

  const regexes = buildCandidateRegexes(queryTokens);

  const searchClauses = regexes.flatMap((regex) => [
    { name: regex },
    { slug: regex },
    { tags: regex },
    { description: regex },
  ]);

  const products = await Product.find({
    isActive: true,
    isDeleted: false,
    $or: searchClauses,
  })
    .select(
      "name slug images sellingPrice mrp unit sku categoryId tags description averageRating",
    )
    .limit(40)
    .lean();

  if (!products.length) return [];

  const inventories = await Inventory.find({
    productId: { $in: products.map((product) => product._id) },
  })
    .select("productId availableStock currentStock reservedStock")
    .lean();

  const stockById = new Map(
    inventories.map((row) => [
      String(row.productId),
      Math.max(
        0,
        Number(
          row.availableStock ??
            Number(row.currentStock || 0) -
              Number(row.reservedStock || 0),
        ),
      ),
    ]),
  );

  return products
    .map((product) => {
      const stock =
        stockById.get(String(product._id)) ??
        0;

      return {
        id: String(product._id),
        name: String(product.name || ""),
        slug: String(product.slug || slugifyFallback(product.name)),
        url: productUrl(product),
        image: product.images?.[0] || null,
        price: Number(product.sellingPrice || 0),
        mrp: Number(product.mrp || 0),
        unit: product.unit || "unit",
        stock,
        inStock: stock > 0,
        rating: Number(product.averageRating || 0),
        _score: scoreMatch(product, queryTokens, queryCanonical, stock),
      };
    })
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, Math.max(1, Math.min(12, limit)))
    .map(({ _score, ...product }) => product);
}

export const buildDiscoveryResponse = (query, products) => {
  const cleanedQuery = clean(query, 80);

  if (!products.length) {
    return {
      reply:
        `I couldn't find any Fresh15 products related to “${cleanedQuery}” right now. ` +
        "Try another name, such as a fruit, vegetable, dairy item, or grocery.",
      ui: {
        type: "PRODUCT_LIST",
        payload: {
          query: cleanedQuery,
          products: [],
          linksOnly: true,
        },
      },
    };
  }

  return {
    reply:
      products.length === 1
        ? `I found ${products[0].name}.`
        : `I found ${products.length} products related to “${cleanedQuery}”.`,
    ui: {
      type: "PRODUCT_LIST",
      payload: {
        query: cleanedQuery,
        products,
        linksOnly: true,
      },
    },
  };
};
