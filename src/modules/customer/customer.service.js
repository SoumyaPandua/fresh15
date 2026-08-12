import bcrypt from "bcryptjs";
import crypto from "crypto";

import User from "../user/user.model.js";
import Order from "../order/order.model.js";
import Address from "../address/address.model.js";

const CUSTOMER_ROLE = "CUSTOMER";
const CUSTOMER_PORTAL = "customer";

const getCustomerStats = async (customerIds) => {
  if (!customerIds.length) {
    return new Map();
  }

  const stats = await Order.aggregate([
    {
      $match: {
        userId: {
          $in: customerIds,
        },
      },
    },
    {
      $group: {
        _id: "$userId",
        orders: {
          $sum: 1,
        },
        spent: {
          $sum: "$grandTotal",
        },
      },
    },
  ]);

  return new Map(
    stats.map((item) => [
      String(item._id),
      {
        orders: Number(item.orders || 0),
        spent: Number(item.spent || 0),
      },
    ])
  );
};

const getCustomerCityMap = async (customerIds) => {
  if (!customerIds.length) {
    return new Map();
  }

  const addresses = await Address.find({
    userId: {
      $in: customerIds,
    },
    isDefault: true,
  })
    .select("userId city")
    .lean();

  return new Map(
    addresses.map((address) => [
      String(address.userId),
      address.city || "",
    ])
  );
};

const formatCustomer = (
  customer,
  statsMap,
  cityMap
) => {
  const id = String(customer._id);

  const stats = statsMap.get(id) || {
    orders: 0,
    spent: 0,
  };

  return {
    id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone || "",
    city: cityMap.get(id) || "",
    orders: stats.orders,
    spent: stats.spent,
    joined: customer.createdAt,
    status: customer.isActive
      ? customer.customerTier === "VIP"
        ? "vip"
        : "active"
      : "inactive",
    customerTier: customer.customerTier,
    isActive: customer.isActive,
    profileImage: customer.profileImage || "",
    isEmailVerified: customer.isEmailVerified,
  };
};

export const getCustomersService = async ({
  search = "",
  status = "",
  page = 1,
  limit = 20,
}) => {
  const currentPage = Math.max(
    Number(page) || 1,
    1
  );

  const perPage = Math.min(
    Math.max(Number(limit) || 20, 1),
    100
  );

  const filter = {
    role: CUSTOMER_ROLE,
    portal: CUSTOMER_PORTAL,
  };

  if (status === "active") {
    filter.isActive = true;
    filter.customerTier = "STANDARD";
  }

  if (status === "vip") {
    filter.isActive = true;
    filter.customerTier = "VIP";
  }

  if (status === "inactive") {
    filter.isActive = false;
  }

  if (search.trim()) {
    const searchRegex = new RegExp(
      search.trim(),
      "i"
    );

    filter.$or = [
      {
        name: searchRegex,
      },
      {
        email: searchRegex,
      },
      {
        phone: searchRegex,
      },
    ];
  }

  const total = await User.countDocuments(
    filter
  );

  const customers = await User.find(filter)
    .select(
      "name email phone profileImage customerTier isActive isEmailVerified createdAt"
    )
    .sort({
      createdAt: -1,
    })
    .skip((currentPage - 1) * perPage)
    .limit(perPage)
    .lean();

  const customerIds = customers.map(
    (customer) => customer._id
  );

  const [statsMap, cityMap] =
    await Promise.all([
      getCustomerStats(customerIds),
      getCustomerCityMap(customerIds),
    ]);

  const data = customers.map(
    (customer) =>
      formatCustomer(
        customer,
        statsMap,
        cityMap
      )
  );

  return {
    customers: data,
    pagination: {
      page: currentPage,
      limit: perPage,
      total,
      totalPages: Math.ceil(
        total / perPage
      ),
    },
  };
};

export const getCustomerSummaryService =
  async () => {
    const [
      totalCustomers,
      inactiveCustomers,
      vipCustomers,
      lifetimeValueResult,
    ] = await Promise.all([
      User.countDocuments({
        role: CUSTOMER_ROLE,
        portal: CUSTOMER_PORTAL,
      }),

      User.countDocuments({
        role: CUSTOMER_ROLE,
        portal: CUSTOMER_PORTAL,
        isActive: false,
      }),

      User.countDocuments({
        role: CUSTOMER_ROLE,
        portal: CUSTOMER_PORTAL,
        customerTier: "VIP",
        isActive: true,
      }),

      Order.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "customer",
          },
        },
        {
          $unwind: "$customer",
        },
        {
          $match: {
            "customer.role":
              CUSTOMER_ROLE,
            "customer.portal":
              CUSTOMER_PORTAL,
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

    return {
      totalCustomers,
      vipCustomers,
      inactiveCustomers,
      lifetimeValue:
        Number(
          lifetimeValueResult?.[0]
            ?.total || 0
        ),
    };
  };

export const createCustomerService = async (
  body
) => {
  const name = String(
    body.name || ""
  ).trim();

  const email = String(
    body.email || ""
  )
    .trim()
    .toLowerCase();

  const phone = String(
    body.phone || ""
  ).trim();

  const city = String(
    body.city || ""
  ).trim();

  if (!name || !email) {
    throw new Error(
      "Name and email are required"
    );
  }

  const existingUser =
    await User.findOne({
      email,
    });

  if (existingUser) {
    throw new Error(
      "Email already registered"
    );
  }

  /*
   * Admin-created customers do not provide a
   * password in the Platform Hub UI.
   *
   * Generate a random password so the account
   * remains structurally valid. The customer can
   * use the existing forgot-password flow later.
   */
  const temporaryPassword =
    crypto.randomBytes(24).toString("hex");

  const password =
    await bcrypt.hash(
      temporaryPassword,
      10
    );

  const customer =
    await User.create({
      name,
      email,
      phone,
      password,
      role: CUSTOMER_ROLE,
      portal: CUSTOMER_PORTAL,
      customerTier:
        body.customerTier === "VIP"
          ? "VIP"
          : "STANDARD",
      isEmailVerified: true,
      isActive:
        body.status !== "inactive",
      profileImage:
        body.profileImage || "",
    });

  if (city) {
    await Address.create({
      userId: customer._id,
      fullName: name,
      phone: phone || "0000000000",
      addressLine1: "Admin created customer",
      city,
      state: "Unknown",
      country: "India",
      pincode: "000000",
      isDefault: true,
    });
  }

  return {
    id: customer._id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    city,
    customerTier:
      customer.customerTier,
    isActive:
      customer.isActive,
    joined: customer.createdAt,
  };
};

export const updateCustomerStatusService =
  async (
    customerId,
    status
  ) => {
    const customer =
      await User.findOne({
        _id: customerId,
        role: CUSTOMER_ROLE,
        portal: CUSTOMER_PORTAL,
      });

    if (!customer) {
      throw new Error(
        "Customer not found"
      );
    }

    if (
      !["active", "inactive"].includes(
        status
      )
    ) {
      throw new Error(
        "Invalid customer status"
      );
    }

    customer.isActive =
      status === "active";

    await customer.save();

    return {
      id: customer._id,
      isActive:
        customer.isActive,
      status:
        customer.customerTier ===
          "VIP" &&
          customer.isActive
          ? "vip"
          : customer.isActive
            ? "active"
            : "inactive",
    };
  };

export const updateCustomerTierService =
  async (
    customerId,
    tier
  ) => {
    const customer =
      await User.findOne({
        _id: customerId,
        role: CUSTOMER_ROLE,
        portal: CUSTOMER_PORTAL,
      });

    if (!customer) {
      throw new Error(
        "Customer not found"
      );
    }

    if (
      !["STANDARD", "VIP"].includes(
        tier
      )
    ) {
      throw new Error(
        "Invalid customer tier"
      );
    }

    customer.customerTier = tier;

    await customer.save();

    return {
      id: customer._id,
      customerTier:
        customer.customerTier,
      status:
        !customer.isActive
          ? "inactive"
          : customer.customerTier ===
            "VIP"
            ? "vip"
            : "active",
    };
  };

export const deleteCustomerService =
  async (customerId) => {
    const customer =
      await User.findOne({
        _id: customerId,
        role: CUSTOMER_ROLE,
        portal: CUSTOMER_PORTAL,
      });

    if (!customer) {
      throw new Error(
        "Customer not found"
      );
    }

    const hasOrders =
      await Order.exists({
        userId: customer._id,
      });

    if (hasOrders) {
      throw new Error(
        "Customer with existing orders cannot be deleted. Mark the customer inactive instead."
      );
    }

    await Address.deleteMany({
      userId: customer._id,
    });

    await customer.deleteOne();
  };