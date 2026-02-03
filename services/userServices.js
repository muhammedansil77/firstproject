import User from "../models/userSchema.js";
import Order from "../models/Order.js";

export const getUsersWithFilters = async (query) => {
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const perPage = parseInt(query.perPage || "11", 10);
  const search = (query.search || "").trim();
  const status = (query.status || "all").toLowerCase();
  const sort = (query.sort || "latest").toLowerCase();

  const filter = { isAdmin: false };

 
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    filter.$or = [
      { fullName: regex },
      { email: regex },
      { phone: regex }
    ];
  }


  if (status === "verified") filter.isVerified = true;
  else if (status === "unverified") filter.isVerified = false;
  else if (status === "blocked") filter.isBlocked = true;
  else if (status === "active") filter.isBlocked = false;


  let sortOrder = { createdAt: -1 };
  if (sort === "a-z") sortOrder = { fullName: 1 };
  else if (sort === "z-a") sortOrder = { fullName: -1 };
  else if (sort === "oldest") sortOrder = { createdAt: 1 };

  const totalUsers = await User.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(totalUsers / perPage));
  const skip = (page - 1) * perPage;


  const orderCounts = await Order.aggregate([
    {
      $group: {
        _id: "$user",
        count: { $sum: 1 }
      }
    }
  ]);

  const orderMap = {};
  orderCounts.forEach(o => {
    orderMap[o._id.toString()] = o.count;
  });

  const users = await User.find(filter)
    .select("fullName email isVerified isBlocked createdAt phone")
    .sort(sortOrder)
    .skip(skip)
    .limit(perPage)
    .lean();

  users.forEach(user => {
    user.orderCount = orderMap[user._id.toString()] || 0;
  });

  return {
    users,
    pagination: {
      totalUsers,
      totalPages,
      perPage,
      page,
      hasPrev: page > 1,
      hasNext: page < totalPages
    }
  };
};
