import User from "../user/user.model.js";
import Product from "../product/product.model.js";
import Order from "../order/order.model.js";
import Inventory from "../inventory/inventory.model.js";
import Wishlist from "../wishlist/wishlist.model.js";
import Cart from "../cart/cart.model.js";

const startOfDay = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
};

const daysAgo = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
};

export const getAdminRevenueService = async () => {
    const last30Days = daysAgo(30);
    const baseMatch = {
        createdAt: { $gte: last30Days },
        isDeleted: { $ne: true },
    };

    const [
        grossRevenue,
        refundedRevenue,
        orderStats,
        dailyRevenue,
        categoryRevenue,
    ] = await Promise.all([
        Order.aggregate([
            {
                $match: {
                    ...baseMatch,
                    paymentStatus: "PAID",
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$grandTotal" },
                },
            },
        ]),
        Order.aggregate([
            {
                $match: {
                    ...baseMatch,
                    paymentStatus: "REFUNDED",
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$grandTotal" },
                },
            },
        ]),
        Order.aggregate([
            {
                $match: {
                    ...baseMatch,
                    paymentStatus: "PAID",
                },
            },
            {
                $group: {
                    _id: null,
                    orders: { $sum: 1 },
                    revenue: { $sum: "$grandTotal" },
                },
            },
        ]),
        Order.aggregate([
            {
                $match: {
                    ...baseMatch,
                    paymentStatus: "PAID",
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$createdAt",
                        },
                    },
                    revenue: { $sum: "$grandTotal" },
                    orders: { $sum: 1 },
                },
            },
            { $sort: { "_id": 1 } },
        ]),
        Order.aggregate([
            {
                $match: {
                    ...baseMatch,
                    paymentStatus: "PAID",
                },
            },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "product",
                },
            },
            {
                $unwind: {
                    path: "$product",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "product.categoryId",
                    foreignField: "_id",
                    as: "category",
                },
            },
            {
                $unwind: {
                    path: "$category",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $group: {
                    _id: {
                        $ifNull: ["$category.name", "Other"],
                    },
                    revenue: { $sum: "$items.subtotal" },
                },
            },
            { $sort: { revenue: -1 } },
        ]),
    ]);

    const gross = Number(grossRevenue[0]?.total || 0);
    const refunds = Number(refundedRevenue[0]?.total || 0);
    const orders = Number(orderStats[0]?.orders || 0);
    const net = gross - refunds;
    const aov = orders > 0 ? gross / orders : 0;

    const dailyMap = new Map(
        dailyRevenue.map((item) => [
            item._id,
            {
                date: item._id,
                revenue: Number(item.revenue || 0),
                orders: Number(item.orders || 0),
            },
        ])
    );

    const revenueSeries = [];

    for (let i = 29; i >= 0; i -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = date.toISOString().slice(0, 10);

        revenueSeries.push(
            dailyMap.get(key) || {
                date: key,
                revenue: 0,
                orders: 0,
            }
        );
    }

    const categoryTotal = categoryRevenue.reduce(
        (sum, item) => sum + Number(item.revenue || 0),
        0
    );

    const categoryMix = categoryRevenue.map((item) => ({
        name: item._id,
        value:
            categoryTotal > 0
                ? Number(
                      (
                          (Number(item.revenue || 0) / categoryTotal) *
                          100
                      ).toFixed(1)
                  )
                : 0,
        revenue: Number(item.revenue || 0),
    }));

    return {
        overview: {
            grossRevenue: gross,
            netRevenue: net,
            refunds,
            aov: Number(aov.toFixed(2)),
            totalOrders: orders,
        },
        revenueSeries,
        categoryMix,
    };
};

export const getAdminDashboardService = async () => {
    const last30Days = daysAgo(30);
    const today = startOfDay();

    const [
        totalUsers,
        activeCustomers,
        totalProducts,
        totalOrders,
        pendingOrders,
        liveOrders,
        completedOrders,
        cancelledOrders,
        activeProducts,
        outOfStockProducts,
        totalPartners,
        onlinePartners,
        revenue30d,
        latestOrders,
        lowStockProducts,
        dailySales,
        hourlyOrders,
        categorySales,
        topSellingProducts,
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: "CUSTOMER", isActive: true }),
        Product.countDocuments({ isDeleted: { $ne: true } }),
        Order.countDocuments({
            createdAt: { $gte: last30Days },
            isDeleted: { $ne: true },
        }),
        Order.countDocuments({ orderStatus: "PENDING", isDeleted: { $ne: true } }),
        Order.countDocuments({ orderStatus: "OUT_FOR_DELIVERY", isDeleted: { $ne: true } }),
        Order.countDocuments({ orderStatus: "DELIVERED", isDeleted: { $ne: true } }),
        Order.countDocuments({ orderStatus: "CANCELLED", isDeleted: { $ne: true } }),
        Product.countDocuments({ isActive: true, isDeleted: { $ne: true } }),
        Inventory.countDocuments({ status: "OUT_OF_STOCK" }),
        User.countDocuments({ role: "PARTNER" }),
        User.countDocuments({ role: "PARTNER", isActive: true, isOnline: true }),
        Order.aggregate([
            { $match: { paymentStatus: "PAID", createdAt: { $gte: last30Days }, isDeleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } },
        ]),
        Order.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(10).populate("userId", "name email profileImage"),
        Inventory.find({ status: { $in: ["LOW_STOCK", "OUT_OF_STOCK"] } }).populate("productId", "name images sku sellingPrice stock").limit(10),
        Order.aggregate([
            { $match: { paymentStatus: "PAID", createdAt: { $gte: last30Days }, isDeleted: { $ne: true } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$grandTotal" }, orders: { $sum: 1 } } },
            { $sort: { "_id": 1 } },
        ]),
        Order.aggregate([
            { $match: { createdAt: { $gte: today }, isDeleted: { $ne: true } } },
            { $group: { _id: { $hour: "$createdAt" }, orders: { $sum: 1 } } },
            { $sort: { "_id": 1 } },
        ]),
        Order.aggregate([
            { $match: { paymentStatus: "PAID", createdAt: { $gte: last30Days }, isDeleted: { $ne: true } } },
            { $unwind: "$items" },
            { $lookup: { from: "products", localField: "items.productId", foreignField: "_id", as: "product" } },
            { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
            { $lookup: { from: "categories", localField: "product.categoryId", foreignField: "_id", as: "category" } },
            { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
            { $group: { _id: { $ifNull: ["$category.name", "Other"] }, revenue: { $sum: "$items.subtotal" } } },
            { $sort: { revenue: -1 } },
        ]),
        Order.aggregate([
            { $match: { createdAt: { $gte: last30Days }, isDeleted: { $ne: true } } },
            { $unwind: "$items" },
            { $group: { _id: "$items.productId", sold: { $sum: "$items.quantity" }, revenue: { $sum: "$items.subtotal" }, productName: { $first: "$items.productName" } } },
            { $sort: { sold: -1 } },
            { $limit: 5 },
        ]),
    ]);

    const topProductIds = topSellingProducts.map((item) => item._id).filter(Boolean);
    const topProductDocs = await Product.find({ _id: { $in: topProductIds } }).select("name sellingPrice stock images").lean();
    const productMap = new Map(topProductDocs.map((product) => [String(product._id), product]));

    const maxCategoryRevenue = categorySales.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
    const categoryMix = categorySales.map((item) => ({
        name: item._id,
        value: maxCategoryRevenue > 0 ? Number(((Number(item.revenue || 0) / maxCategoryRevenue) * 100).toFixed(1)) : 0,
    }));

    const dailySalesMap = new Map(dailySales.map((item) => [item._id, { date: item._id, revenue: Number(item.revenue || 0), orders: Number(item.orders || 0) }]));
    const revenueSeries = [];

    for (let i = 29; i >= 0; i -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = date.toISOString().slice(0, 10);
        revenueSeries.push(dailySalesMap.get(key) || { date: key, revenue: 0, orders: 0 });
    }

    const hourlyOrdersMap = new Map(hourlyOrders.map((item) => [Number(item._id), Number(item.orders || 0)]));
    const hourlySeries = Array.from({ length: 24 }, (_, hour) => ({
        hour: `${String(hour).padStart(2, "0")}:00`,
        orders: hourlyOrdersMap.get(hour) || 0,
    }));

    const formattedTopProducts = topSellingProducts.map((item) => {
        const product = productMap.get(String(item._id));
        return {
            id: String(item._id),
            name: product?.name || item.productName || "Unknown product",
            price: Number(product?.sellingPrice || 0),
            stock: Number(product?.stock || 0),
            sold: Number(item.sold || 0),
            revenue: Number(item.revenue || 0),
            image: product?.images?.[0] || "",
        };
    });

    return {
        overview: {
            totalUsers,
            activeCustomers,
            totalProducts,
            activeProducts,
            outOfStockProducts,
            totalOrders,
            pendingOrders,
            liveOrders,
            completedOrders,
            cancelledOrders,
            totalRevenue: Number(revenue30d[0]?.total || 0),
            activePartners: onlinePartners,
            totalPartners,
            todayRevenue: 0,
        },
        revenueSeries,
        categoryMix,
        hourlyOrders: hourlySeries,
        latestOrders,
        topSellingProducts: formattedTopProducts,
        lowStockProducts,
    };
};

export const getSellerDashboardService = async (sellerId) => {
    const [totalProducts, activeProducts, totalOrders, revenue, recentOrders, topProducts] = await Promise.all([
        Product.countDocuments({ createdBy: sellerId }),
        Product.countDocuments({ createdBy: sellerId, isActive: true }),
        Order.countDocuments({ createdBy: sellerId }),
        Order.aggregate([
            { $match: { createdBy: sellerId, paymentStatus: "PAID" } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } },
        ]),
        Order.find({ createdBy: sellerId }).sort({ createdAt: -1 }).limit(10),
        Product.find({ createdBy: sellerId }).sort({ averageRating: -1 }).limit(5),
    ]);

    return {
        overview: {
            totalProducts,
            activeProducts,
            totalOrders,
            totalRevenue: revenue[0]?.total || 0,
        },
        topProducts,
        recentOrders,
    };
};

export const getCustomerDashboardService = async (userId) => {
    const [totalOrders, completedOrders, pendingOrders, cancelledOrders, totalSpent, recentOrders, wishlist, cart] = await Promise.all([
        Order.countDocuments({ userId }),
        Order.countDocuments({ userId, orderStatus: "DELIVERED" }),
        Order.countDocuments({ userId, orderStatus: "PENDING" }),
        Order.countDocuments({ userId, orderStatus: "CANCELLED" }),
        Order.aggregate([
            { $match: { userId, paymentStatus: "PAID" } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } },
        ]),
        Order.find({ userId }).sort({ createdAt: -1 }).limit(5),
        Wishlist.findOne({ userId }),
        Cart.findOne({ userId }),
    ]);

    return {
        overview: {
            totalOrders,
            completedOrders,
            pendingOrders,
            cancelledOrders,
            totalSpent: totalSpent[0]?.total || 0,
        },
        recentOrders,
        wishlistCount: wishlist?.totalItems || 0,
        cartCount: cart?.totalItems || 0,
    };
};
