import Product from "../product/product.model.js";
import ProductAlert from "./productAlert.model.js";
import { sendNotificationService } from "../notification/notification.service.js";
import { parsePagination, buildPagination } from "../../utils/pagination.js";

const toBoolean = (value, fallback = false) =>
  value === undefined ? fallback : value === true || value === "true";

const populateAlert = (query) =>
  query.populate({
    path: "productId",
    select:
      "name slug images sellingPrice mrp stock isActive isDeleted unit sku",
  });

export const getMyProductAlertsService = async (userId) => {
  return await populateAlert(
    ProductAlert.find({
      userId,
      $or: [{ backInStock: true }, { priceDrop: true }],
    }).sort({ updatedAt: -1 })
  );
};

export const getMyProductAlertForProductService = async (
  userId,
  productId
) => {
  const alert = await ProductAlert.findOne({
    userId,
    productId,
  });

  return alert || null;
};

export const upsertProductAlertService = async (
  userId,
  productId,
  body
) => {
  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
    isActive: true,
  }).select(
    "name slug images sellingPrice mrp stock isActive isDeleted unit sku"
  );

  if (!product) {
    throw new Error("Product not found");
  }

  const existing = await ProductAlert.findOne({
    userId,
    productId,
  });

  const backInStock = toBoolean(
    body.backInStock,
    existing?.backInStock ?? false
  );
  const priceDrop = toBoolean(
    body.priceDrop,
    existing?.priceDrop ?? false
  );

  if (!backInStock && !priceDrop) {
    throw new Error(
      "Enable at least one alert type"
    );
  }

  const inAppEnabled = toBoolean(
    body.inAppEnabled,
    existing?.inAppEnabled ?? true
  );

  const emailEnabled = toBoolean(
    body.emailEnabled,
    existing?.emailEnabled ?? false
  );

  if (!inAppEnabled && !emailEnabled) {
    throw new Error(
      "Enable at least one notification channel"
    );
  }

  let targetPrice = existing?.targetPrice ?? null;

  if (Object.prototype.hasOwnProperty.call(body, "targetPrice")) {
    targetPrice =
      body.targetPrice === null ||
      body.targetPrice === "" ||
      body.targetPrice === undefined
        ? null
        : Number(body.targetPrice);

    if (
      targetPrice !== null &&
      (!Number.isFinite(targetPrice) ||
        targetPrice < 0)
    ) {
      throw new Error("Invalid target price");
    }
  }

  if (!priceDrop) {
    targetPrice = null;
  }

  const update = {
    backInStock,
    priceDrop,
    targetPrice,
    inAppEnabled,
    emailEnabled,
  };

  const alert = await ProductAlert.findOneAndUpdate(
    { userId, productId },
    {
      $set: update,
      $setOnInsert: {
        userId,
        productId,
        lastNotifiedPrice: Number(product.sellingPrice),
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return await populateAlert(
    ProductAlert.findById(alert._id)
  );
};

export const deleteMyProductAlertService = async (
  userId,
  productId
) => {
  const result = await ProductAlert.deleteOne({
    userId,
    productId,
  });

  if (!result.deletedCount) {
    throw new Error("Product alert not found");
  }

  return null;
};

const sendAlertNotification = async ({
  alert,
  product,
  type,
  title,
  message,
  metadata,
}) => {
  const channels = [];

  if (alert.inAppEnabled) {
    channels.push("IN_APP");
  }

  if (alert.emailEnabled) {
    channels.push("EMAIL");
  }

  for (const channel of channels) {
    try {
      await sendNotificationService({
        userId: alert.userId,
        title,
        message,
        type,
        channel,
        metadata,
        createdBy: alert.userId,
      });
    } catch (error) {
      // A failed email must not prevent the in-app alert from being created.
      console.error(
        `Product alert ${channel} notification failed for ${product._id}:`,
        error.message
      );
    }
  }
};

const PRICE_DROP_MIN_PERCENT = 2;
const PRICE_DROP_MIN_AMOUNT = 1;

export const processBackInStockAlertService = async ({
  productId,
  previousAvailableStock,
  currentAvailableStock,
}) => {
  if (
    Number(previousAvailableStock) > 0 ||
    Number(currentAvailableStock) <= 0
  ) {
    return 0;
  }

  const alerts = await ProductAlert.find({
    productId,
    backInStock: true,
  });

  if (!alerts.length) return 0;

  const product = await Product.findById(productId).select(
    "name slug images sellingPrice mrp stock isActive isDeleted unit sku"
  );

  if (!product || product.isDeleted || product.isActive === false) {
    return 0;
  }

  let notified = 0;

  for (const alert of alerts) {
    // Atomic one-shot claim prevents duplicate notifications when
    // multiple inventory updates race at the same time.
    const claimed = await ProductAlert.findOneAndUpdate(
      {
        _id: alert._id,
        backInStock: true,
      },
      {
        $set: {
          backInStock: false,
          backInStockNotifiedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!claimed) continue;

    await sendAlertNotification({
      alert: claimed,
      product,
      type: "BACK_IN_STOCK",
      title: `${product.name} is back in stock`,
      message: `${product.name} is available again. Get it before it sells out.`,
      metadata: {
        productId: product._id.toString(),
        productName: product.name,
        productSlug: product.slug,
        alertType: "BACK_IN_STOCK",
        price: Number(product.sellingPrice),
      },
    });

    if (!claimed.priceDrop) {
      await ProductAlert.deleteOne({ _id: claimed._id });
    }

    notified += 1;
  }

  return notified;
};

export const processPriceDropAlertService = async ({
  productId,
  previousPrice,
  currentPrice,
}) => {
  const previous = Number(previousPrice);
  const current = Number(currentPrice);

  if (
    !Number.isFinite(previous) ||
    !Number.isFinite(current) ||
    current >= previous
  ) {
    return 0;
  }

  const alerts = await ProductAlert.find({
    productId,
    priceDrop: true,
  });

  if (!alerts.length) return 0;

  const product = await Product.findById(productId).select(
    "name slug images sellingPrice mrp stock isActive isDeleted unit sku"
  );

  if (!product || product.isDeleted || product.isActive === false) {
    return 0;
  }

  let notified = 0;

  for (const alert of alerts) {
    const baseline =
      alert.lastNotifiedPrice === null ||
      alert.lastNotifiedPrice === undefined
        ? previous
        : Number(alert.lastNotifiedPrice);

    const amountDrop = baseline - current;
    const percentDrop =
      baseline > 0
        ? (amountDrop / baseline) * 100
        : 0;

    const targetCrossed =
      alert.targetPrice !== null &&
      alert.targetPrice !== undefined &&
      previous > Number(alert.targetPrice) &&
      current <= Number(alert.targetPrice);

    const meaningfulDrop =
      current < baseline &&
      amountDrop >= PRICE_DROP_MIN_AMOUNT &&
      percentDrop >= PRICE_DROP_MIN_PERCENT;

    if (!targetCrossed && !meaningfulDrop) {
      continue;
    }

    // Atomic claim/deduplication. A price can trigger at most once until
    // it moves below the last notified price again.
    const claimed = await ProductAlert.findOneAndUpdate(
      {
        _id: alert._id,
        priceDrop: true,
        $or: [
          { lastPriceDropNotifiedAt: null },
          {
            lastPriceDropNotifiedAt: {
              $lt: new Date(Date.now() - 5 * 60 * 1000),
            },
          },
        ],
      },
      {
        $set: {
          lastNotifiedPrice: current,
          lastPriceDropNotifiedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!claimed) continue;

    const targetText = claimed.targetPrice
      ? ` It has reached your target of ₹${Number(
          claimed.targetPrice
        ).toFixed(2)}.`
      : "";

    await sendAlertNotification({
      alert: claimed,
      product,
      type: "PRICE_DROP",
      title: `${product.name} price dropped`,
      message: `${product.name} is now ₹${current.toFixed(
        2
      )}, down from ₹${baseline.toFixed(2)}.${targetText}`,
      metadata: {
        productId: product._id.toString(),
        productName: product.name,
        productSlug: product.slug,
        alertType: "PRICE_DROP",
        previousPrice: baseline,
        currentPrice: current,
        targetPrice: claimed.targetPrice,
        dropAmount: Number(amountDrop.toFixed(2)),
        dropPercent: Number(percentDrop.toFixed(2)),
      },
    });

    notified += 1;
  }

  return notified;
};


export const getAdminProductAlertsService = async (query = {}) => {
  const filter = {
    $or: [{ backInStock: true }, { priceDrop: true }],
  };

  if (query.productId) {
    filter.productId = query.productId;
  }

  if (query.type === "BACK_IN_STOCK") {
    filter.backInStock = true;
  }

  if (query.type === "PRICE_DROP") {
    filter.priceDrop = true;
  }

  const pagination = parsePagination(query);

  const base = ProductAlert.find(filter)
    .populate({
      path: "productId",
      select: "name slug images sellingPrice mrp stock isActive isDeleted unit sku",
    })
    .populate({
      path: "userId",
      select: "name email phone",
    })
    .sort({ updatedAt: -1 });

  if (!pagination.hasPagination) {
    return await base.limit(500);
  }

  const [items, total] = await Promise.all([
    base.skip(pagination.skip).limit(pagination.limit),
    ProductAlert.countDocuments(filter),
  ]);

  return {
    items,
    pagination: buildPagination({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getAdminProductAlertSummaryService = async () => {
  const [total, backInStock, priceDrop, topProducts] =
    await Promise.all([
      ProductAlert.countDocuments({
        $or: [{ backInStock: true }, { priceDrop: true }],
      }),
      ProductAlert.countDocuments({ backInStock: true }),
      ProductAlert.countDocuments({ priceDrop: true }),
      ProductAlert.aggregate([
        {
          $group: {
            _id: "$productId",
            subscribers: { $sum: 1 },
            backInStockSubscribers: {
              $sum: { $cond: ["$backInStock", 1, 0] },
            },
            priceDropSubscribers: {
              $sum: { $cond: ["$priceDrop", 1, 0] },
            },
          },
        },
        { $sort: { subscribers: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            productId: "$_id",
            name: "$product.name",
            image: { $arrayElemAt: ["$product.images", 0] },
            sellingPrice: "$product.sellingPrice",
            stock: "$product.stock",
            subscribers: 1,
            backInStockSubscribers: 1,
            priceDropSubscribers: 1,
          },
        },
      ]),
    ]);

  return {
    total,
    backInStock,
    priceDrop,
    topProducts,
  };
};
