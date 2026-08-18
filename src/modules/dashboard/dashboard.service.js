import User from "../user/user.model.js";
import Product from "../product/product.model.js";
import Order from "../order/order.model.js";
import Inventory from "../inventory/inventory.model.js";
import Wishlist from "../wishlist/wishlist.model.js";
import Cart from "../cart/cart.model.js";

export const getAdminDashboardService =
    async () => {
        const [
            totalUsers,
            totalProducts,
            totalOrders,
            pendingOrders,
            completedOrders,
            cancelledOrders,
            activeProducts,
            outOfStockProducts,
            latestOrders,
            lowStockProducts,
            revenue,
            todayRevenue,
        ] = await Promise.all([
            User.countDocuments(),

            Product.countDocuments(),

            Order.countDocuments(),

            Order.countDocuments({
                orderStatus: "PENDING",
            }),

            Order.countDocuments({
                orderStatus: "DELIVERED",
            }),

            Order.countDocuments({
                orderStatus: "CANCELLED",
            }),

            Product.countDocuments({
                isActive: true,
            }),

            Inventory.countDocuments({
                status: "OUT_OF_STOCK",
            }),

            Order.find()
                .sort({
                    createdAt: -1,
                })
                .limit(10)
                .populate(
                    "userId",
                    "name email"
                ),

            Inventory.find({
                status: {
                    $in: [
                        "LOW_STOCK",
                        "OUT_OF_STOCK",
                    ],
                },
            })
                .populate(
                    "productId",
                    "name images sku"
                )
                .limit(10),

            Order.aggregate([
                {
                    $match: {
                        paymentStatus: "PAID",
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: "$grandTotal",
                        },
                    },
                },
            ]),

            Order.aggregate([
                {
                    $match: {
                        paymentStatus: "PAID",
                        createdAt: {
                            $gte: new Date(
                                new Date().setHours(
                                    0,
                                    0,
                                    0,
                                    0
                                )
                            ),
                        },
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: "$grandTotal",
                        },
                    },
                },
            ]),
        ]);

        const ordersByStatus =
            await Order.aggregate([
                {
                    $group: {
                        _id: "$orderStatus",
                        total: {
                            $sum: 1,
                        },
                    },
                },
            ]);

        const monthlySales =
            await Order.aggregate([
                {
                    $match: {
                        paymentStatus: "PAID",
                    },
                },
                {
                    $group: {
                        _id: {
                            year: {
                                $year: "$createdAt",
                            },
                            month: {
                                $month: "$createdAt",
                            },
                        },
                        totalSales: {
                            $sum: "$grandTotal",
                        },
                    },
                },
                {
                    $sort: {
                        "_id.year": 1,
                        "_id.month": 1,
                    },
                },
            ]);

        const topSellingProducts =
            await Order.aggregate([
                {
                    $unwind: "$items",
                },
                {
                    $group: {
                        _id: "$items.productId",
                        sold: {
                            $sum: "$items.quantity",
                        },
                        revenue: {
                            $sum: "$items.subtotal",
                        },
                        productName: {
                            $first:
                                "$items.productName",
                        },
                    },
                },
                {
                    $sort: {
                        sold: -1,
                    },
                },
                {
                    $limit: 10,
                },
            ]);

        return {
            overview: {
                totalUsers,
                totalProducts,
                activeProducts,
                outOfStockProducts,
                totalOrders,
                pendingOrders,
                completedOrders,
                cancelledOrders,
                totalRevenue:
                    revenue[0]?.total || 0,
                todayRevenue:
                    todayRevenue[0]?.total || 0,
            },
            ordersByStatus,
            monthlySales,
            topSellingProducts,
            latestOrders,
            lowStockProducts,
        };
    };

export const getSellerDashboardService =
    async (sellerId) => {
        const [
            totalProducts,
            activeProducts,
            totalOrders,
            revenue,
            recentOrders,
            topProducts,
        ] = await Promise.all([
            Product.countDocuments({
                createdBy: sellerId,
            }),

            Product.countDocuments({
                createdBy: sellerId,
                isActive: true,
            }),

            Order.countDocuments({
                createdBy: sellerId,
            }),

            Order.aggregate([
                {
                    $match: {
                        createdBy: sellerId,
                        paymentStatus: "PAID",
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: "$grandTotal",
                        },
                    },
                },
            ]),

            Order.find({
                createdBy: sellerId,
            })
                .sort({
                    createdAt: -1,
                })
                .limit(10),

            Product.find({
                createdBy: sellerId,
            })
                .sort({
                    averageRating: -1,
                })
                .limit(5),
        ]);

        return {
            overview: {
                totalProducts,
                activeProducts,
                totalOrders,
                totalRevenue:
                    revenue[0]?.total || 0,
            },

            topProducts,

            recentOrders,
        };
    };

export const getCustomerDashboardService =
    async (userId) => {
        const [
            totalOrders,
            completedOrders,
            pendingOrders,
            cancelledOrders,
            totalSpent,
            recentOrders,
            wishlist,
            cart,
        ] = await Promise.all([
            Order.countDocuments({
                userId,
            }),

            Order.countDocuments({
                userId,
                orderStatus:
                    "DELIVERED",
            }),

            Order.countDocuments({
                userId,
                orderStatus:
                    "PENDING",
            }),

            Order.countDocuments({
                userId,
                orderStatus:
                    "CANCELLED",
            }),

            Order.aggregate([
                {
                    $match: {
                        userId,
                        paymentStatus:
                            "PAID",
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: "$grandTotal",
                        },
                    },
                },
            ]),

            Order.find({
                userId,
            })
                .sort({
                    createdAt: -1,
                })
                .limit(5),

            Wishlist.findOne({
                userId,
            }),

            Cart.findOne({
                userId,
            }),
        ]);

        return {
            overview: {
                totalOrders,
                completedOrders,
                pendingOrders,
                cancelledOrders,
                totalSpent:
                    totalSpent[0]?.total || 0,
            },

            recentOrders,

            wishlistCount:
                wishlist?.totalItems || 0,

            cartCount:
                cart?.totalItems || 0,
        };
    };