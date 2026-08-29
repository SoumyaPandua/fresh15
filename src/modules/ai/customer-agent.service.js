import crypto from "crypto";
import Product from "../product/product.model.js";
import Inventory from "../inventory/inventory.model.js";
import Address from "../address/address.model.js";
import AiConversation from "./ai.model.js";
import {
  getMyCartService,
  addToCartService,
  removeCartItemService,
  updateCartItemService,
  clearCartService,
} from "../cart/cart.service.js";
import {
  getMyWishlistService,
  addWishlistService,
  removeWishlistService,
} from "../wishlist/wishlist.service.js";
import { getMyOrdersService, createOrderService } from "../order/order.service.js";
import { getActiveOffersService } from "../offer/offer.service.js";
import { getLoyaltyOverviewService } from "../loyalty/loyalty.service.js";
import { getAvailableDeliverySlotsService } from "../deliverySlot/deliverySlot.service.js";
import { agent as legacyAgent } from "./ai-agent.service.js";
import AppError from "../../utils/AppError.js";

const MAX_INPUT = 1200;
const CONFIRMATION_TTL_MS = 10 * 60 * 1000;

const clean = (value, limit = MAX_INPUT) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, limit);

const normalize = (value) =>
  clean(value, 200)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizePlural = (value) => {
  const text = normalize(value);
  if (text.endsWith("ies")) return `${text.slice(0, -3)}y`;
  if (text.endsWith("oes")) return text.slice(0, -2);
  if (text.endsWith("ses")) return text.slice(0, -2);
  if (text.endsWith("s") && !text.endsWith("ss")) return text.slice(0, -1);
  return text;
};

const safeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isActionMessage = (text) => text.startsWith("__F15_ACTION__");

const parseActionMessage = (text) => {
  if (!isActionMessage(text)) return null;
  try {
    return JSON.parse(text.slice("__F15_ACTION__".length));
  } catch {
    return null;
  }
};

const productUnits = (product) => {
  const raw = String(product?.unit || "").toUpperCase();
  const units = new Set();

  if (raw.includes("KG") || raw.includes("KILO")) units.add("KG");
  if (raw.includes("G") || raw.includes("GRAM")) units.add("GRAM");
  if (raw.includes("ML")) units.add("ML");
  if (raw.includes("L") || raw.includes("LITRE") || raw.includes("LITER")) units.add("L");
  if (raw.includes("PACK")) units.add("PACK");
  if (raw.includes("PIECE") || raw.includes("PCS") || raw.includes("UNIT")) units.add("PIECE");

  if (!units.size && raw) units.add(raw);
  if (!units.size) units.add("PIECE");

  return [...units];
};

const extractRequestedProduct = (text) => {
  const value = clean(text, 300);
  const patterns = [
    /^(?:please\s+)?(?:show|find|search|look\s+for)\s+(?:me\s+)?(.+)$/i,
    /^(?:please\s+)?(?:order|buy|purchase)\s+(?:(\d+(?:\.\d+)?)\s+)?(?:kg|kgs|g|gram|grams|l|ltr|liter|litre|ml|piece|pieces|pack|packs|dozen)?\s*(?:of\s+)?(.+?)(?:\s+for\s+me)?$/i,
    /^(?:please\s+)?(?:add|put|save)\s+(?:(\d+(?:\.\d+)?)\s+)?(?:kg|kgs|g|gram|grams|l|ltr|liter|litre|ml|piece|pieces|pack|packs|dozen)?\s*(?:of\s+)?(.+?)\s+(?:to|into|in)\s+(?:my\s+)?(?:cart|wishlist|wish\s+list)$/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;

    const quantity = Number(match[1] || 1);
    const hasQuantity = Boolean(match[1]);
    const unitMatch = value.match(/\b(kg|kgs|g|gram|grams|l|ltr|liter|litre|ml|piece|pieces|pack|packs|dozen)\b/i);

    return {
      productQuery: clean(match[2] || match[1] || "", 160),
      quantity: Number.isFinite(quantity) ? Math.min(Math.max(quantity, 1), 50) : 1,
      explicitUnit: unitMatch?.[1]?.toUpperCase() || null,
      hasQuantity,
    };
  }

  return null;
};

const scoreProduct = (product, query) => {
  const normalizedQuery = normalizePlural(query);
  const name = normalizePlural(product?.name);
  const slug = normalizePlural(product?.slug);
  const tags = Array.isArray(product?.tags)
    ? product.tags.map(normalizePlural)
    : [];
  const description = normalize(product?.description);

  let score = 0;
  if (name === normalizedQuery || slug === normalizedQuery) score += 1000;
  if (name.includes(normalizedQuery)) score += 700;
  if (slug.includes(normalizedQuery)) score += 600;
  if (tags.some((tag) => tag === normalizedQuery)) score += 100;
  if (tags.some((tag) => tag.includes(normalizedQuery))) score += 70;
  if (description.includes(normalizedQuery)) score += 30;

  for (const token of normalizedQuery.split(" ")) {
    if (token.length < 2) continue;
    if (name.includes(token)) score += 100;
    if (slug.includes(token)) score += 80;
    if (tags.some((tag) => tag.includes(token))) score += 30;
  }

  return score + (Number(product?.availableStock || 0) > 0 ? 20 : 0);
};

async function searchProducts(query) {
  const normalizedQuery = normalizePlural(query);
  if (!normalizedQuery) return [];

  const regex = new RegExp(safeRegex(normalizedQuery), "i");
  const tokens = normalizedQuery
    .split(/\s+/)
    .filter((token) => token.length >= 2)
    .slice(0, 6);

  const tokenRegexes = tokens.map((token) => new RegExp(safeRegex(token), "i"));
  const products = await Product.find({
    isActive: true,
    isDeleted: false,
    $or: [
      { name: regex },
      { slug: regex },
      { tags: regex },
      { description: regex },
      ...tokenRegexes.flatMap((tokenRegex) => [
        { name: tokenRegex },
        { slug: tokenRegex },
        { tags: tokenRegex },
      ]),
    ],
  })
    .select("name slug images sellingPrice mrp unit stock categoryId tags description")
    .limit(20)
    .lean();

  if (!products.length) return [];

  const inventory = await Inventory.find({
    productId: { $in: products.map((product) => product._id) },
  })
    .select("productId availableStock currentStock reservedStock")
    .lean();

  const stockByProduct = new Map(
    inventory.map((row) => [
      String(row.productId),
      Math.max(
        0,
        Number(
          row.availableStock ??
            Number(row.currentStock || 0) - Number(row.reservedStock || 0),
        ),
      ),
    ]),
  );

  return products
    .map((product) => ({
      id: String(product._id),
      name: product.name,
      slug: product.slug,
      image: product.images?.[0] || null,
      price: Number(product.sellingPrice || 0),
      mrp: Number(product.mrp || 0),
      unit: product.unit,
      units: productUnits(product),
      stock: stockByProduct.get(String(product._id)) ?? Number(product.stock || 0),
      inStock: (stockByProduct.get(String(product._id)) ?? Number(product.stock || 0)) > 0,
      tags: product.tags || [],
      _score: scoreProduct(product, normalizedQuery),
    }))
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...product }) => product);
}

async function getAddresses(userId) {
  return Address.find({ userId })
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();
}

const addressView = (address) => ({
  id: String(address._id),
  label: address.addressType || "ADDRESS",
  addressLine1: address.addressLine1,
  addressLine2: address.addressLine2 || "",
  city: address.city || "",
  state: address.state || "",
  pincode: address.pincode,
  isDefault: Boolean(address.isDefault),
});

const productView = (product) => ({
  id: String(product.id),
  name: product.name,
  image: product.image,
  price: product.price,
  mrp: product.mrp,
  unit: product.unit,
  units: product.units || [],
  stock: product.stock,
  inStock: product.inStock,
});

const setWorkflow = (conversation, patch) => {
  conversation.workflowState = {
    ...(conversation.workflowState?.toObject?.() || conversation.workflowState || {}),
    ...patch,
  };
};

const resetWorkflow = (conversation) => {
  conversation.workflowState = {
    mode: "IDLE",
    intent: null,
    productCandidates: [],
    selectedProductId: null,
    selectedProductName: null,
    requestedQuantity: null,
    requestedUnit: null,
    selectedAddressId: null,
    selectedSlotId: null,
    selectedDateKey: null,
    paymentMethod: null,
    orderId: null,
    orderNumber: null,
    confirmationId: null,
    confirmationExpiresAt: null,
    lastErrorCode: null,
    summary: null,
  };
};

const workflowSnapshot = (conversation) => {
  const state = conversation.workflowState?.toObject?.() || conversation.workflowState || {};
  return {
    mode: state.mode || "IDLE",
    intent: state.intent || null,
    selectedProductId: state.selectedProductId ? String(state.selectedProductId) : null,
    selectedProductName: state.selectedProductName || null,
    requestedQuantity: state.requestedQuantity ?? null,
    requestedUnit: state.requestedUnit || null,
    selectedAddressId: state.selectedAddressId ? String(state.selectedAddressId) : null,
    selectedSlotId: state.selectedSlotId || null,
    selectedDateKey: state.selectedDateKey || null,
    paymentMethod: state.paymentMethod || null,
    orderId: state.orderId ? String(state.orderId) : null,
    orderNumber: state.orderNumber || null,
  };
};

const responseEnvelope = (conversation, reply, extra = {}) => ({
  conversationId: String(conversation._id),
  reply,
  workflow: workflowSnapshot(conversation),
  actions: extra.actions || [],
  ui: extra.ui || null,
  confirmation: extra.confirmation || null,
  payment: extra.payment || null,
  blocked: false,
});

async function saveMessage(conversation, role, content, blocked = false) {
  conversation.messages.push({ role, content, blocked });
  conversation.messageCount += 1;
  conversation.lastActivityAt = new Date();
  await conversation.save();
}

async function createConversation(userId, req, conversationId) {
  let conversation = conversationId
    ? await AiConversation.findOne({
        _id: conversationId,
        userId,
      })
    : null;

  if (!conversation) {
    conversation = await AiConversation.create({
      userId,
      title: "Fresh15 AI Shopping",
      lastIpAddress: req.ip || req.socket?.remoteAddress || null,
      lastUserAgent: req.get("user-agent") || null,
      workflowState: {},
    });
    resetWorkflow(conversation);
  }

  return conversation;
}

async function requireConversation(userId, conversationId, req) {
  const conversation = await createConversation(userId, req, conversationId);
  conversation.lastIpAddress = req.ip || req.socket?.remoteAddress || null;
  conversation.lastUserAgent = req.get("user-agent") || null;
  return conversation;
}

async function productSelectionReply(conversation, intent, candidates, quantity) {
  setWorkflow(conversation, {
    mode: "PRODUCT_SELECTION",
    intent,
    productCandidates: candidates,
    requestedQuantity: quantity ?? null,
    selectedProductId: null,
    selectedProductName: null,
  });

  const items = candidates.map(productView);
  const verb = intent === "ORDER_PRODUCT" ? "order" : intent === "ADD_TO_CART" ? "add" : "view";

  return {
    reply:
      items.length === 1
        ? `I found ${items[0].name}.`
        : `I found ${items.length} related options. Which one would you like to ${verb}?`,
    ui: {
      type: "PRODUCT_LIST",
      payload: { products: items, intent },
    },
  };
}

async function continueOrderAfterProduct(conversation, userId, product, quantity, explicitUnit) {
  const units = product.units || productUnits(product);

  setWorkflow(conversation, {
    mode: units.length > 1 || !explicitUnit ? "UNIT_SELECTION" : "ADDRESS_SELECTION",
    intent: "ORDER_PRODUCT",
    selectedProductId: product.id,
    selectedProductName: product.name,
    requestedQuantity: quantity,
    requestedUnit: explicitUnit || (units.length === 1 ? units[0] : null),
  });

  if (units.length > 1 || !explicitUnit) {
    const defaultUnit = units.length === 1 ? units[0] : null;
    return responseEnvelope(
      conversation,
      defaultUnit
        ? `You asked for ${quantity} ${product.name}. This product is sold as ${defaultUnit}. Is that what you mean?`
        : `How would you like ${quantity} ${product.name}?`,
      {
        ui: {
          type: "UNIT_PICKER",
          payload: {
            product: productView(product),
            quantity,
            options: units,
          },
        },
      },
    );
  }

  await addToCartService(userId, {
    productId: product.id,
    quantity,
  });

  return chooseAddress(conversation, userId);
}

async function chooseAddress(conversation, userId) {
  const addresses = await getAddresses(userId);

  setWorkflow(conversation, {
    mode: "ADDRESS_SELECTION",
    intent: "ORDER_PRODUCT",
  });

  if (!addresses.length) {
    return responseEnvelope(
      conversation,
      "You don't have a saved delivery address yet. Please add one to continue.",
      {
        ui: {
          type: "ADDRESS_PICKER",
          payload: {
            addresses: [],
            addAddress: true,
          },
        },
      },
    );
  }

  if (addresses.length === 1) {
    return validateAddress(conversation, userId, String(addresses[0]._id));
  }

  return responseEnvelope(
    conversation,
    "Which address should I use for this order?",
    {
      ui: {
        type: "ADDRESS_PICKER",
        payload: {
          addresses: addresses.map(addressView),
          addAddress: true,
        },
      },
    },
  );
}

async function validateAddress(conversation, userId, addressId) {
  const address = await Address.findOne({
    _id: addressId,
    userId,
  }).lean();

  if (!address) {
    throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");
  }

  const slots = await getAvailableDeliverySlotsService(userId, address._id);
  const normalizedSlots = Array.isArray(slots)
    ? slots
    : slots?.slots || [];

  if (!normalizedSlots.length) {
    const addresses = await getAddresses(userId);
    setWorkflow(conversation, {
      mode: "ADDRESS_SELECTION",
      selectedAddressId: null,
      lastErrorCode: "ADDRESS_NOT_SERVICEABLE",
    });

    return responseEnvelope(
      conversation,
      `I can't place this order to ${address.addressType || "this address"} (${address.pincode}) because no delivery slot is currently available there.`,
      {
        ui: {
          type: "ADDRESS_PICKER",
          payload: {
            addresses: addresses.map(addressView),
            addAddress: true,
          },
        },
      },
    );
  }

  setWorkflow(conversation, {
    mode: "DELIVERY_SLOT_SELECTION",
    selectedAddressId: address._id,
  });

  const slotItems = normalizedSlots.slice(0, 12).map((slot) => ({
    id: String(slot.slotId || slot._id || ""),
    dateKey: slot.dateKey || "",
    label: slot.label || "Available slot",
    startsAt: slot.startsAt || null,
    endsAt: slot.endsAt || null,
    promisedAt: slot.promisedAt || null,
    etaMinutes: slot.etaMinutes ?? null,
  }));

  if (!slotItems.length) {
    throw new AppError(
      409,
      "DELIVERY_SLOT_UNAVAILABLE",
      "No delivery slot is currently available",
    );
  }

  if (slotItems.length === 1) {
    setWorkflow(conversation, {
      mode: "PAYMENT_SELECTION",
      selectedSlotId: slotItems[0].id,
      selectedDateKey: slotItems[0].dateKey,
    });

    return responseEnvelope(
      conversation,
      "This address is serviceable. Which payment method would you like to use?",
      {
        ui: {
          type: "PAYMENT_PICKER",
          payload: { methods: ["COD", "ONLINE"] },
        },
      },
    );
  }

  return responseEnvelope(
    conversation,
    "Which delivery time works for you?",
    {
      ui: {
        type: "SLOT_PICKER",
        payload: {
          slots: slotItems,
        },
      },
    },
  );
}

async function checkoutSummary(conversation, userId, paymentMethod) {
  const state = workflowSnapshot(conversation);
  const cart = await getMyCartService(userId);
  const address = await Address.findOne({
    _id: state.selectedAddressId,
    userId,
  }).lean();

  if (!address) {
    throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");
  }

  const slotResult = await getAvailableDeliverySlotsService(
    userId,
    address._id,
  );
  const slots = Array.isArray(slotResult)
    ? slotResult
    : slotResult?.slots || [];
  const slot = slots.find(
    (item) =>
      String(item.slotId || item._id || "") === String(state.selectedSlotId) &&
      String(item.dateKey || "") === String(state.selectedDateKey || ""),
  );

  if (!slot) {
    throw new AppError(
      409,
      "DELIVERY_SLOT_UNAVAILABLE",
      "The selected delivery slot is no longer available",
    );
  }

  const subtotal = Number(cart?.subtotal || 0);
  const minimumOrder = Number(
    slot.minOrder ?? slotResult?.minOrder ?? 0,
  );

  if (minimumOrder > 0 && subtotal < minimumOrder) {
    throw new AppError(
      422,
      "MIN_ORDER_NOT_MET",
      `Minimum order value for this area is ₹${Math.ceil(minimumOrder)}`,
    );
  }

  const summary = {
    items: (cart?.items || []).map((item) => ({
      productId: String(item.productId?._id || item.productId),
      name: item.productId?.name || "Item",
      quantity: Number(item.quantity || 0),
      unit: item.productId?.unit || "",
      price: Number(item.price || item.productId?.sellingPrice || 0),
      subtotal: Number(item.subtotal || 0),
    })),
    subtotal,
    totalQuantity: Number(cart?.totalQuantity || 0),
    address: addressView(address),
    slot: {
      id: String(slot.slotId || slot._id || ""),
      dateKey: slot.dateKey || "",
      label: slot.label || "Selected delivery slot",
      promisedAt: slot.promisedAt || null,
      etaMinutes: slot.etaMinutes ?? null,
      deliveryFee: Number(slot.deliveryFee ?? slot.baseDeliveryFee ?? slotResult?.deliveryFee ?? 0),
      minOrder: minimumOrder,
    },
    paymentMethod,
    total:
      Number(subtotal) +
      Number(slot.deliveryFee ?? slot.baseDeliveryFee ?? slotResult?.deliveryFee ?? 0),
  };

  const confirmationId = crypto.randomBytes(18).toString("hex");
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS);

  setWorkflow(conversation, {
    mode: "CHECKOUT_REVIEW",
    paymentMethod,
    confirmationId,
    confirmationExpiresAt: expiresAt,
    summary,
  });

  return responseEnvelope(
    conversation,
    "Please review your order before I place it.",
    {
      ui: {
        type: "ORDER_SUMMARY",
        payload: summary,
      },
      confirmation: {
        confirmationId,
        action: "place_order",
        summary,
        expiresAt,
      },
    },
  );
}

async function confirmOrder(conversation, userId, confirmationId, req) {
  const state = conversation.workflowState?.toObject?.() || conversation.workflowState || {};

  if (!state.confirmationId || state.confirmationId !== confirmationId) {
    throw new AppError(403, "AI_CONFIRMATION_INVALID", "Invalid order confirmation");
  }

  if (
    !state.confirmationExpiresAt ||
    new Date(state.confirmationExpiresAt).getTime() < Date.now()
  ) {
    resetWorkflow(conversation);
    throw new AppError(
      409,
      "ORDER_CONFIRMATION_EXPIRED",
      "This order confirmation has expired. Please ask me to prepare it again.",
    );
  }

  const summary = state.summary || {};
  const order = await createOrderService(userId, {
    addressId: state.selectedAddressId,
    deliverySlotId: state.selectedSlotId,
    deliveryDateKey: state.selectedDateKey,
    paymentMethod: state.paymentMethod === "ONLINE" ? "ONLINE" : "COD",
  });

  const orderId = String(order?._id || order?.id || "");
  const orderNumber = String(order?.orderNumber || orderId);

  setWorkflow(conversation, {
    mode: state.paymentMethod === "ONLINE" ? "PAYMENT_PENDING" : "ORDER_COMPLETED",
    confirmationId: null,
    confirmationExpiresAt: null,
    orderId,
    orderNumber,
  });

  await saveMessage(
    conversation,
    "assistant",
    state.paymentMethod === "ONLINE"
      ? `Order ${orderNumber} is ready. Please complete the Razorpay payment to finish the order.`
      : `Order ${orderNumber} has been placed successfully with Cash on Delivery.`,
  );

  return responseEnvelope(
    conversation,
    state.paymentMethod === "ONLINE"
      ? `Order ${orderNumber} is ready. Please complete the Razorpay payment.`
      : `Order ${orderNumber} has been placed successfully with Cash on Delivery.`,
    {
      payment:
        state.paymentMethod === "ONLINE"
          ? { required: true, orderId }
          : null,
      ui:
        state.paymentMethod === "ONLINE"
          ? {
              type: "PAYMENT_PENDING",
              payload: {
                orderId,
                orderNumber,
              },
            }
          : {
              type: "ORDER_SUCCESS",
              payload: {
                orderId,
                orderNumber,
                trackingUrl: `/orders/${orderId}`,
              },
            },
    },
  );
}

async function handleAction(conversation, userId, action, req) {
  const type = String(action?.type || "").toUpperCase();
  const payload = action?.payload || {};
  const state = conversation.workflowState?.toObject?.() || conversation.workflowState || {};

  if (type === "PRODUCT_SELECTED") {
    const product = (state.productCandidates || []).find(
      (candidate) => String(candidate.id) === String(payload.productId),
    );

    if (!product) {
      throw new AppError(409, "PRODUCT_SELECTION_INVALID", "That product is no longer available");
    }

    if (state.intent === "ORDER_PRODUCT") {
      return continueOrderAfterProduct(
        conversation,
        userId,
        product,
        Number(state.requestedQuantity || 1),
        null,
      );
    }

    if (state.intent === "ADD_TO_CART") {
      await addToCartService(userId, {
        productId: product.id,
        quantity: Number(state.requestedQuantity || 1),
      });
      resetWorkflow(conversation);
      return responseEnvelope(
        conversation,
        `${product.name} was added to your cart.`,
        {
          ui: {
            type: "CART_SUMMARY",
            payload: await getMyCartService(userId),
          },
        },
      );
    }

    if (state.intent === "ADD_TO_WISHLIST") {
      await addWishlistService(userId, { productId: product.id });
      resetWorkflow(conversation);
      return responseEnvelope(conversation, `${product.name} was added to your wishlist.`);
    }

    resetWorkflow(conversation);
    return responseEnvelope(
      conversation,
      `Here is ${product.name}.`,
      { ui: { type: "PRODUCT_LIST", payload: { products: [productView(product)] } } },
    );
  }

  if (type === "UNIT_SELECTED") {
    const product = (state.productCandidates || []).find(
      (candidate) => String(candidate.id) === String(state.selectedProductId),
    ) || await searchProducts(state.selectedProductName || "");

    const selected = Array.isArray(product) ? product[0] : product;
    if (!selected) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");

    if (!selected.units.includes(String(payload.unit).toUpperCase())) {
      throw new AppError(422, "UNIT_INVALID", "That unit is not supported for this product");
    }

    setWorkflow(conversation, {
      mode: "ADDRESS_SELECTION",
      requestedUnit: String(payload.unit).toUpperCase(),
    });

    await addToCartService(userId, {
      productId: selected.id,
      quantity: Number(state.requestedQuantity || 1),
    });

    return chooseAddress(conversation, userId);
  }

  if (type === "ADDRESS_SELECTED") {
    return validateAddress(conversation, userId, String(payload.addressId));
  }

  if (type === "SLOT_SELECTED") {
    setWorkflow(conversation, {
      mode: "PAYMENT_SELECTION",
      selectedSlotId: String(payload.slotId),
      selectedDateKey: String(payload.dateKey || ""),
    });

    return responseEnvelope(
      conversation,
      "Which payment method would you like to use?",
      {
        ui: {
          type: "PAYMENT_PICKER",
          payload: { methods: ["COD", "ONLINE"] },
        },
      },
    );
  }

  if (type === "PAYMENT_SELECTED") {
    const method = String(payload.method || "").toUpperCase();
    if (!["COD", "ONLINE"].includes(method)) {
      throw new AppError(422, "PAYMENT_METHOD_INVALID", "Unsupported payment method");
    }
    return checkoutSummary(conversation, userId, method);
  }

  if (type === "CONFIRM_ORDER") {
    return confirmOrder(
      conversation,
      userId,
      String(payload.confirmationId || state.confirmationId || ""),
      req,
    );
  }

  if (type === "CANCEL_WORKFLOW") {
    resetWorkflow(conversation);
    await conversation.save();
    return responseEnvelope(conversation, "Okay, I cancelled that shopping step. Nothing was changed.");
  }

  if (type === "CLEAR_CART") {
    await clearCartService(userId);
    resetWorkflow(conversation);
    return responseEnvelope(conversation, "Your cart has been cleared.");
  }

  if (type === "CART_REMOVE") {
    const cart = await getMyCartService(userId);
    const item = (cart?.items || []).find(
      (entry) => String(entry.productId?._id || entry.productId) === String(payload.productId),
    );
    if (!item) throw new AppError(404, "CART_ITEM_NOT_FOUND", "That item is not in your cart");
    const result = await removeCartItemService(userId, String(payload.productId));
    resetWorkflow(conversation);
    return responseEnvelope(conversation, `${item.productId?.name || "Item"} was removed from your cart.`, {
      ui: { type: "CART_SUMMARY", payload: result },
    });
  }

  return responseEnvelope(conversation, "I couldn't process that selection. Please try again.");
}

async function handleIntent(conversation, user, userId, text, req) {
  const action = parseActionMessage(text);
  if (action) return handleAction(conversation, userId, action, req);

  const state = conversation.workflowState?.toObject?.() || conversation.workflowState || {};
  const value = normalize(text);

  if (
    state.mode === "PRODUCT_SELECTION" &&
    (state.productCandidates || []).length
  ) {
    const candidates = state.productCandidates;
    const selected =
      candidates.find((product) => normalize(product.name) === value) ||
      candidates.find((product) => normalize(product.name).includes(value)) ||
      (candidates.length === 1 ? candidates[0] : null);

    if (!selected) {
      return responseEnvelope(conversation, "Please choose one of the products shown above.", {
        ui: {
          type: "PRODUCT_LIST",
          payload: {
            products: candidates.map(productView),
            intent: state.intent,
          },
        },
      });
    }

    return handleAction(conversation, userId, {
      type: "PRODUCT_SELECTED",
      payload: { productId: selected.id },
    }, req);
  }

  if (state.mode === "UNIT_SELECTION") {
    const unit = value.toUpperCase().replace(/\s+/g, "");
    const allowed = ["KG", "GRAM", "G", "ML", "L", "PACK", "PIECE", "PIECES", "DOZEN"];
    if (allowed.includes(unit)) {
      return handleAction(conversation, userId, {
        type: "UNIT_SELECTED",
        payload: { unit: unit === "PIECES" ? "PIECE" : unit },
      }, req);
    }
    return responseEnvelope(conversation, "Please choose one of the available units.", {
      ui: {
        type: "UNIT_PICKER",
        payload: {
          quantity: state.requestedQuantity,
          product: {
            id: String(state.selectedProductId || ""),
            name: state.selectedProductName,
          },
          options: (state.productCandidates?.[0]?.units || []),
        },
      },
    });
  }

  if (state.mode === "ADDRESS_SELECTION") {
    const addresses = await getAddresses(userId);
    const selected =
      addresses.find((address) => normalize(address.addressType) === value) ||
      addresses.find((address) => `${normalize(address.addressType)} ${normalize(address.pincode)}`.includes(value));

    if (!selected) {
      return chooseAddress(conversation, userId);
    }

    return handleAction(conversation, userId, {
      type: "ADDRESS_SELECTED",
      payload: { addressId: String(selected._id) },
    }, req);
  }

  if (state.mode === "DELIVERY_SLOT_SELECTION") {
    const slotsResult = await getAvailableDeliverySlotsService(
      userId,
      state.selectedAddressId,
    );
    const slots = Array.isArray(slotsResult) ? slotsResult : slotsResult?.slots || [];
    const selected = slots.find(
      (slot) => normalize(slot.label).includes(value),
    );
    if (!selected) {
      return responseEnvelope(conversation, "Please choose one of the available delivery slots.", {
        ui: {
          type: "SLOT_PICKER",
          payload: {
            slots: slots.map((slot) => ({
              id: String(slot.slotId || slot._id || ""),
              dateKey: slot.dateKey || "",
              label: slot.label || "",
              etaMinutes: slot.etaMinutes ?? null,
            })),
          },
        },
      });
    }
    return handleAction(conversation, userId, {
      type: "SLOT_SELECTED",
      payload: {
        slotId: String(selected.slotId || selected._id || ""),
        dateKey: selected.dateKey || "",
      },
    }, req);
  }

  if (state.mode === "PAYMENT_SELECTION") {
    const method = value.includes("razor") || value.includes("online") ? "ONLINE" : value.includes("cod") || value.includes("cash") ? "COD" : null;
    if (!method) {
      return responseEnvelope(conversation, "Please choose COD or Razorpay.", {
        ui: {
          type: "PAYMENT_PICKER",
          payload: { methods: ["COD", "ONLINE"] },
        },
      });
    }
    return handleAction(conversation, userId, {
      type: "PAYMENT_SELECTED",
      payload: { method },
    }, req);
  }

  if (state.mode === "CHECKOUT_REVIEW") {
    if (/^(yes|confirm|place|place order|proceed|continue)\b/i.test(value)) {
      return handleAction(conversation, userId, {
        type: "CONFIRM_ORDER",
        payload: { confirmationId: state.confirmationId },
      }, req);
    }
    if (/cancel|no|stop|change/i.test(value)) {
      return handleAction(conversation, userId, {
        type: "CANCEL_WORKFLOW",
        payload: {},
      }, req);
    }
  }

  if (/^(hi|hello|hey)\b/i.test(value)) {
    resetWorkflow(conversation);
    return responseEnvelope(
      conversation,
      "Hi! I’m Fresh15 Agent. I can find products, manage your cart and wishlist, and guide you through checkout.",
    );
  }

  if (/\b(cart|basket)\b/i.test(value)) {
    const cart = await getMyCartService(userId);
    resetWorkflow(conversation);
    return responseEnvelope(conversation, "Here is your current cart.", {
      ui: { type: "CART_SUMMARY", payload: cart },
    });
  }

  if (/\bwishlist|wish list|favorites?\b/i.test(value)) {
    const wishlist = await getMyWishlistService(userId);
    resetWorkflow(conversation);
    return responseEnvelope(conversation, "Here is your wishlist.", {
      ui: { type: "WISHLIST", payload: wishlist },
    });
  }

  if (/\b(my )?(orders?|order history)\b/i.test(value)) {
    const orders = await getMyOrdersService(userId, { page: 1, limit: 10 });
    resetWorkflow(conversation);
    return responseEnvelope(conversation, "Here are your recent orders.", {
      ui: { type: "ORDER_LIST", payload: orders },
    });
  }

  if (/clear (my )?(cart|basket)/i.test(text)) {
    return handleAction(conversation, userId, { type: "CLEAR_CART", payload: {} }, req);
  }

  const productIntent = extractRequestedProduct(text);
  if (productIntent) {
    const isShow = /^(show|find|search|look)/i.test(text);
    const isOrder = /^(order|buy|purchase)/i.test(text);
    const isWishlist = /\bwishlist|wish list|favorites?\b/i.test(text);
    const isCartAdd = /\b(cart|basket)\b/i.test(text) && /\b(add|put|include)\b/i.test(text);
    const intent = isShow
      ? "SHOW_PRODUCT"
      : isOrder
        ? "ORDER_PRODUCT"
        : isWishlist
          ? "ADD_TO_WISHLIST"
          : isCartAdd
            ? "ADD_TO_CART"
            : "SHOW_PRODUCT";

    const candidates = await searchProducts(productIntent.productQuery);

    if (!candidates.length) {
      resetWorkflow(conversation);
      return responseEnvelope(
        conversation,
        `I couldn't find any Fresh15 product related to “${productIntent.productQuery}” right now. You can try another fruit, vegetable, or grocery item.`,
      );
    }

    if (candidates.length === 1) {
      if (intent === "SHOW_PRODUCT") {
        resetWorkflow(conversation);
        return responseEnvelope(
          conversation,
          `I found ${candidates[0].name}.`,
          {
            ui: {
              type: "PRODUCT_LIST",
              payload: { products: [productView(candidates[0])], intent },
            },
          },
        );
      }

      if (intent === "ORDER_PRODUCT") {
        return continueOrderAfterProduct(
          conversation,
          userId,
          candidates[0],
          productIntent.quantity,
          productIntent.explicitUnit,
        );
      }

      if (intent === "ADD_TO_CART") {
        await addToCartService(userId, {
          productId: candidates[0].id,
          quantity: productIntent.quantity,
        });
        resetWorkflow(conversation);
        return responseEnvelope(
          conversation,
          `${candidates[0].name} was added to your cart.`,
          {
            ui: {
              type: "CART_SUMMARY",
              payload: await getMyCartService(userId),
            },
          },
        );
      }

      if (intent === "ADD_TO_WISHLIST") {
        await addWishlistService(userId, {
          productId: candidates[0].id,
        });
        resetWorkflow(conversation);
        return responseEnvelope(
          conversation,
          `${candidates[0].name} was added to your wishlist.`,
        );
      }
    }

    const reply = productSelectionReply(
      conversation,
      intent,
      candidates,
      productIntent.quantity,
    );
    await conversation.save();
    return responseEnvelope(
      conversation,
      reply.reply,
      { ui: reply.ui },
    );
  }

  const legacy = await legacyAgent({
    user,
    message: text,
    req,
    conversationId: String(conversation._id),
  });

  return {
    conversationId: String(conversation._id),
    reply: legacy.reply,
    workflow: workflowSnapshot(conversation),
    actions: legacy.actions || [],
    ui: null,
    confirmation: legacy.confirmation || null,
    payment: null,
    blocked: Boolean(legacy.blocked),
  };
}

export async function customerAgent({ user, message, conversationId, req }) {
  if (String(user?.role || "").toUpperCase() !== "CUSTOMER") {
    throw new AppError(403, "AI_CUSTOMER_ONLY", "This AI agent is available only for customers");
  }

  const text = clean(message);
  if (!text) {
    throw new AppError(422, "AI_MESSAGE_REQUIRED", "Message is required");
  }

  const conversation = await requireConversation(
    user._id,
    conversationId,
    req,
  );

  conversation.messages.push({
    role: "user",
    content: isActionMessage(text) ? "[UI_ACTION]" : text,
  });
  conversation.messageCount += 1;
  conversation.lastActivityAt = new Date();

  const result = await handleIntent(conversation, user, user._id, text, req);

  conversation.messages.push({
    role: "assistant",
    content: result.reply,
  });
  conversation.messageCount += 1;
  conversation.lastActivityAt = new Date();
  await conversation.save();

  return result;
}
