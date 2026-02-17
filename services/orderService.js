import Order from "../models/Order.js";
import User from "../models/userSchema.js";

export const getAdminOrdersService = async (queryParams) => {
  let {
    page = 1,
    limit = 10,
    status,
    search,
    sort = "newest",
    startDate,
    endDate
  } = queryParams;

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;

  let query = {};


  if (status && status !== "all") {
    query.orderStatus = status;
  }


  if (startDate || endDate) {
    query.createdAt = {};

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query.createdAt.$gte = start;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }


  if (search && search.trim() !== "") {
    const searchRegex = new RegExp(search.trim(), "i");

    const searchConditions = [{ orderNumber: searchRegex }];

   
    if (search.length === 24 && /^[0-9a-fA-F]{24}$/.test(search)) {
      searchConditions.push({ _id: search });
    }

 
    const cleanSearch = search.trim().toUpperCase();
    if (cleanSearch.startsWith("ORD")) {
      searchConditions.push({
        orderNumber: { $regex: cleanSearch.replace("ORD", ""), $options: "i" }
      });
    }


    const users = await User.find({
      $or: [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ]
    }).select("_id");

    if (users.length > 0) {
      searchConditions.push({ user: { $in: users.map((u) => u._id) } });
    }

    query.$or = searchConditions;
  }


  let sortOption = {};
  switch (sort) {
    case "newest":
      sortOption = { createdAt: -1 };
      break;
    case "oldest":
      sortOption = { createdAt: 1 };
      break;
    case "amount-high":
      sortOption = { finalAmount: -1 };
      break;
    case "amount-low":
      sortOption = { finalAmount: 1 };
      break;
    default:
      sortOption = { createdAt: -1 };
  }


  const totalOrders = await Order.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limit);


  const orders = await Order.find(query)
    .populate({
      path: "user",
      select: "fullName email phone",
      model: User
    })
    .populate({
      path: "address",
      select: "fullName phone addressLine1 city state pincode"
    })
    .sort(sortOption)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();


  const statusCounts = await Order.aggregate([
    {
      $group: {
        _id: "$orderStatus",
        count: { $sum: 1 }
      }
    }
  ]);

  const statusCountsMap = {
    Placed: 0,
    Confirmed: 0,
    Shipped: 0,
    OutForDelivery: 0,
    Delivered: 0,
    Cancelled: 0
  };

  statusCounts.forEach((item) => {
    if (item._id) {
      statusCountsMap[item._id] = item.count;
    }
  });


  const formattedOrders = orders.map((order) => ({
    ...order,
    _id: order._id.toString(),
    orderDate: order.createdAt
      ? new Date(order.createdAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "N/A",
    formattedAmount: new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2
    }).format(order.finalAmount || 0),

    customerName: order.address?.fullName || order.user?.fullName || "N/A",
    customerPhone: order.address?.phone || order.user?.phone || "N/A",

    displayOrderNumber:
      order.orderNumber || `ORD-${order._id.slice(-8).toUpperCase()}`
  }));

  return {
    orders: formattedOrders,
    pagination: {
      currentPage: page,
      totalPages,
      totalOrders,
      limit
    },
    filters: {
      statusFilter: status || "all",
      searchQuery: search || "",
      sortBy: sort,
      startDate: startDate || "",
      endDate: endDate || ""
    },
    statusCounts: statusCountsMap
  };
};
export const updateOrderStatusService = async (orderId, status, notes, adminId) => {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new Error("Order not found");
  }


  if (order.orderStatus === "Delivered") {
    throw new Error("Delivered orders cannot be modified");
  }


  if (order.orderStatus === "Cancelled") {
    throw new Error("Cancelled orders cannot be modified");
  }

  const validStatuses = [
    "Placed",
    "Confirmed",
    "Shipped",
    "OutForDelivery",
    "Delivered",
    "Cancelled"
  ];

  if (!validStatuses.includes(status)) {
    throw new Error("Invalid status");
  }


  order.orderStatus = status;


  order.statusHistory ??= [];
  order.statusHistory.push({
    status,
    changedAt: new Date(),
    notes: notes || "",
    changedBy: adminId || null
  });


  if (status === "Delivered" && order.paymentMethod === "COD") {
    order.paymentStatus = "Paid";
  }

  await order.save();

  return true;
};


export const getFormattedOrderDetailsService = async (orderId, isLean = true) => {
  let query = Order.findById(orderId)
    .populate("user", "fullName email phone")
    .populate({
      path: "items.product",
      select: "name images"
    })
    .populate({
      path: "items.variant",
      select: "size color images price"
    });

  if (isLean) query = query.lean();

  const order = await query;

  if (!order) {
    throw new Error("Order not found");
  }

  const orderObj = isLean ? order : order.toObject();

  // Defaults
  const orderWithDefaults = {
    ...orderObj,
    cancellationReason: orderObj.cancellationReason || "No reason provided",
    cancellationReasonCode: orderObj.cancellationReasonCode || "not_specified",
    cancelledAt: orderObj.cancelledAt || null,
    cancelledBy: orderObj.cancelledBy || "user",
    statusHistory: orderObj.statusHistory || [],
    paymentStatus: orderObj.paymentStatus || "Pending"
  };

  // Formatting
  const formattedOrder = {
    ...orderWithDefaults,
    orderNumber:
      orderWithDefaults.orderNumber ||
      `ORD-${orderWithDefaults._id.toString().slice(-8).toUpperCase()}`,

    orderDate: new Date(orderWithDefaults.createdAt).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }),

    formattedAmount: new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2
    }).format(orderWithDefaults.finalAmount || 0),

    items: (orderWithDefaults.items || []).map((item) => ({
      ...item,
      product: item.product || { name: "Product", images: [] },
      variant: item.variant || { size: null, color: null, images: [] },

      formattedPrice: new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2
      }).format(item.price || 0),

      formattedTotal: new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2
      }).format(item.total || 0)
    }))
  };

  return formattedOrder;
};


export const cancelUserOrderService = async (orderId, userId) => {
  const order = await Order.findOne({
    _id: orderId,
    user: userId
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (!["Placed", "Confirmed"].includes(order.orderStatus)) {
    throw new Error("This order cannot be cancelled");
  }

  order.orderStatus = "Cancelled";
  order.paymentStatus =
    order.paymentMethod === "COD" ? "Cancelled" : "Refund Initiated";

  order.statusHistory ??= [];
  order.statusHistory.push({
    status: "Cancelled",
    changedAt: new Date(),
    notes: "Cancelled by user",
    changedBy: userId
  });

  await order.save();

  return true;
};
