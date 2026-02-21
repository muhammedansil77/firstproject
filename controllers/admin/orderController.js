
import Order from "../../models/Order.js";
import User from "../../models/userSchema.js";
import { getAdminOrdersService ,
  updateOrderStatusService ,
    getFormattedOrderDetailsService,
  cancelUserOrderService
} from "../../services/orderService.js";

export const loadAdminOrders = async (req, res) => {
  try {
    const result = await getAdminOrdersService(req.query);

    return res.render("admin/order", {
      orders: result.orders,
      currentPage: result.pagination.currentPage,
      totalPages: result.pagination.totalPages,
      totalOrders: result.pagination.totalOrders,
      limit: result.pagination.limit,

      statusFilter: result.filters.statusFilter,
      searchQuery: result.filters.searchQuery,
      sortBy: result.filters.sortBy,
      startDate: result.filters.startDate,
      endDate: result.filters.endDate,

      statusCounts: result.statusCounts,

      layout: "admin/layouts/main",
      title: "Orders Management",
      pageJS: "order.js"
    });

  } catch (error) {
    console.error("Error loading admin orders:", error);
    req.flash("error", "Error loading orders: " + error.message);
    return res.redirect("/admin/dashboard");
  }
};


export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;

    await updateOrderStatusService(orderId, status, notes, req.admin?._id);

    return res.json({
      success: true,
      message: "Order status updated successfully"
    });

  } catch (err) {
    console.error("updateOrderStatus error:", err);

    return res.status(
      err.message === "Order not found" ? 404 : 400
    ).json({
      success: false,
      message: err.message || "Error updating order status"
    });
  }
};



export const viewOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const formattedOrder = await getFormattedOrderDetailsService(orderId, false);

    return res.render("admin/order-details", {
      order: formattedOrder,
      title: "Order Details",
      pageTitle: "Order Details",
      pageJS: "order-details.js"
    });

  } catch (error) {
    console.error("Error getting order details:", error);
    req.flash("error", error.message || "Error getting order details");
    return res.redirect("/admin/orders");
  }
};


export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const formattedOrder = await getFormattedOrderDetailsService(orderId, true);

    return res.json({
      success: true,
      order: formattedOrder
    });

  } catch (error) {
    console.error("Error getting order details:", error);

    return res.status(error.message === "Order not found" ? 404 : 500).json({
      success: false,
      message: error.message || "Error getting order details"
    });
  }
};


export const clearFilters = async (req, res) => {
  return res.redirect("/admin/orders");
};


export const cancelUserOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    await cancelUserOrderService(orderId, userId);

    return res.json({
      success: true,
      message: "Order cancelled successfully"
    });

  } catch (err) {
    console.error("Cancel order error:", err);

    return res.status(err.message === "Order not found" ? 404 : 400).json({
      success: false,
      message: err.message || "Failed to cancel order"
    });
  }
};