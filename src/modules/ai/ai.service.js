import Product from "../product/product.model.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_HISTORY = 8;
const MAX_MESSAGE_LENGTH = 1000;

const STOP_WORDS = new Set([
  "what","which","where","when","how","can","could","would","should","please","show","give","me","some","the","and","for","with","from","that","this","have","want","need","fresh15","price","prices","product","products","item","items","is","are","i","my","to","a","an","of","on","in","at","do","you","your","recommend","suggest","best","good"
]);

function cleanText(value, max = MAX_MESSAGE_LENGTH) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function termsFrom(message) {
  return cleanText(message)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((x) => x.length >= 3 && !STOP_WORDS.has(x))
    .slice(0, 6);
}

async function findProducts(message) {
  const terms = termsFrom(message);
  const regex = terms.length ? new RegExp(terms.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i") : null;

  const filter = { isActive: true, isDeleted: false };
  if (regex) {
    filter.$or = [
      { name: regex },
      { description: regex },
      { tags: regex },
    ];
  }

  let products = await Product.find(filter)
    .select("_id name description sellingPrice mrp stock unit tags averageRating totalReviews images")
    .limit(24)
    .lean();

  if (!products.length) {
    products = await Product.find({ isActive: true, isDeleted: false })
      .select("_id name description sellingPrice mrp stock unit tags averageRating totalReviews images")
      .sort({ isFeatured: -1, averageRating: -1, totalReviews: -1 })
      .limit(24)
      .lean();
  }

  return products.map((p) => ({
    id: String(p._id),
    name: p.name,
    description: cleanText(p.description, 180),
    price: Number(p.sellingPrice ?? 0),
    mrp: Number(p.mrp ?? 0),
    stock: Number(p.stock ?? 0),
    unit: p.unit,
    tags: Array.isArray(p.tags) ? p.tags.slice(0, 8) : [],
    rating: Number(p.averageRating ?? 0),
    reviews: Number(p.totalReviews ?? 0),
    image: Array.isArray(p.images) && p.images[0] ? p.images[0] : null,
  }));
}

function productContext(products) {
  return products.map((p) =>
    `${p.id} | ${p.name} | ₹${p.price} | MRP ₹${p.mrp} | stock ${p.stock} | ${p.unit} | rating ${p.rating} (${p.reviews}) | tags: ${p.tags.join(", ")}`
  ).join("\n");
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-MAX_HISTORY).map((m) => ({
    role: m?.role === "model" ? "model" : "user",
    text: cleanText(m?.text, 1200),
  })).filter((m) => m.text);
}

export async function chatWithFresh15({ message, history = [], cart = [] }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error("AI assistant is not configured on the server yet.");
    error.code = "AI_NOT_CONFIGURED";
    error.statusCode = 503;
    throw error;
  }

  const userMessage = cleanText(message);
  if (!userMessage) {
    const error = new Error("Please enter a message.");
    error.code = "AI_EMPTY_MESSAGE";
    error.statusCode = 422;
    throw error;
  }

  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    const error = new Error(`Message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`);
    error.code = "AI_MESSAGE_TOO_LONG";
    error.statusCode = 422;
    throw error;
  }

  const products = await findProducts(userMessage);
  const safeCart = Array.isArray(cart)
    ? cart.slice(0, 20).map((x) => ({ name: cleanText(x?.name, 80), qty: Number(x?.qty) || 1, price: Number(x?.price) || 0 })).filter((x) => x.name)
    : [];

  const systemInstruction = `You are Fresh15 Assistant, a concise grocery shopping assistant for an Indian quick-commerce app.
Rules:
- Only make factual product claims from the PRODUCT CATALOG below. Never invent products, prices, stock, discounts, delivery times, policies, refunds, or order status.
- If a requested product is not in the catalog, say it is not currently found and suggest only catalog products.
- You can help with grocery recommendations, meal ideas, substitutions, cart planning, product comparisons, and general Fresh15 navigation.
- For medical, dietary, allergy, pregnancy, or other health-sensitive questions, give a brief safety disclaimer and recommend consulting a qualified professional; do not make medical claims.
- Never request passwords, OTPs, card numbers, CVV, or other secrets.
- Keep answers under 120 words unless the user asks for detail.
- Use Indian English and ₹ when discussing prices.
- When recommending products, mention the exact product names and prices from the catalog.

PRODUCT CATALOG:
${productContext(products)}

CURRENT CART:
${safeCart.length ? safeCart.map((x) => `${x.name} x${x.qty} (₹${x.price})`).join("; ") : "empty"}`;

  const contents = [
    ...normalizeHistory(history).map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  const response = await fetch(`${API_URL}/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 300,
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "The AI assistant is temporarily unavailable.");
    error.code = "AI_PROVIDER_ERROR";
    error.statusCode = response.status === 429 ? 429 : 502;
    throw error;
  }

  const reply = payload?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("").trim();
  if (!reply) {
    const error = new Error("The AI assistant did not return a response. Please try again.");
    error.code = "AI_EMPTY_RESPONSE";
    error.statusCode = 502;
    throw error;
  }

  const referencedIds = products.filter((p) => reply.toLowerCase().includes(p.name.toLowerCase())).slice(0, 6).map((p) => p.id);
  return { reply, products: products.filter((p) => referencedIds.includes(p.id)).slice(0, 6), model: MODEL };
}
