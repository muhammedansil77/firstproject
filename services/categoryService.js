import Category from "../models/Category.js";

export const getCategoriesService = async (query) => {
  let { page = 1, limit = 10, search = "", status = "all", sort = "latest" } = query;

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;
  const skip = (page - 1) * limit;

  const filter = { isDeleted: { $ne: true } };

  // Search filter
  if (search && String(search).trim()) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedSearch, "i");

    filter.$or = [
      { name: regex },
      { description: regex }
    ];
  }

  // Status filter
  if (status === "active") {
    filter.active = true;
  } else if (status === "blocked") {
    filter.active = false;
  }

  // Sorting
  let sortOrder = {};
  switch (sort.toLowerCase()) {
    case "a-z":
      sortOrder = { name: 1 };
      break;
    case "z-a":
      sortOrder = { name: -1 };
      break;
    case "latest":
      sortOrder = { createdAt: -1 };
      break;
    case "oldest":
      sortOrder = { createdAt: 1 };
      break;
    default:
      sortOrder = { createdAt: -1 };
  }

  const totalItems = await Category.countDocuments(filter);

  const categories = await Category.find(filter)
    .sort(sortOrder)
    .skip(skip)
    .limit(limit)
    .lean();

  const totalPages = Math.ceil(totalItems / limit) || 0;

  return {
    categories,
    totalItems,
    totalPages,
    currentPage: page,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null,
    filters: { search, status, sort }
  };
};
export const createCategoryService = async ({ name, description }, file) => {
  if (!name || name.trim().length < 2) {
    throw new Error("Name too short");
  }

  const trimmedName = name.trim();

  const exists = await Category.findOne({
    name: { $regex: `^${trimmedName}$`, $options: "i" },
    isDeleted: false
  });

  if (exists) {
    throw new Error("Category already exists");
  }

  let imagePath = null;
  if (file) {
    imagePath = `/uploads/categories/${file.filename}`;
  }

  const newCat = new Category({
    name: trimmedName,
    description: description ? description.trim() : "",
    active: true,
    itemCount: 0,
    imagePath
  });

  const saved = await newCat.save();

  return saved.toObject();
};
export const updateCategoryService = async (id, body, file) => {
  const { name, description } = body;

  // validation
  if (!name || name.trim().length < 2) {
    throw new Error("Name must be at least 2 characters");
  }

  // find category
  const category = await Category.findById(id);
  if (!category) {
    throw new Error("Category not found");
  }

  // duplicate check
  const exists = await Category.findOne({
    _id: { $ne: id },
    name: { $regex: `^${name.trim()}$`, $options: "i" },
    isDeleted: false
  });

  if (exists) {
    throw new Error("Category already exists");
  }

  // update fields
  category.name = name.trim();
  category.description = description ? description.trim() : "";

  if (file) {
    category.imagePath = `/uploads/categories/${file.filename}`;
  }

  const updated = await category.save();
  return updated.toObject();
};