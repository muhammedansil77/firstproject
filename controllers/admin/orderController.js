
import Order from "../../models/Order.js";
import User from "../../models/userSchema.js";

export const loadAdminOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sort = 'newest',
      startDate,
      endDate
    } = req.query;

    console.log('Received Query Parameters:', {
      page, limit, status, search, sort, startDate, endDate
    });
let query= {}
 
    // let query = {
    //   paymentMethod:"Razorpay",
    //   orderStatus: "Delliv"
    // };

   
    if (status && status !== 'all') {
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

   
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      
   
      const searchConditions = [
        { orderNumber: searchRegex }
      ];
      
    
      if (search.length === 24 && /^[0-9a-fA-F]{24}$/.test(search)) {
        searchConditions.push({ _id: search });
      }
      
     
      const cleanSearch = search.trim().toUpperCase();
      if (cleanSearch.startsWith('ORD')) {
        searchConditions.push({ 
          orderNumber: { $regex: cleanSearch.replace('ORD', ''), $options: 'i' } 
        });
      }
      
   
      const users = await User.find({
        $or: [
          { fullName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex }
        ]
      }).select('_id');
      
      if (users.length > 0) {
        searchConditions.push({ user: { $in: users.map(u => u._id) } });
      }
      
      query.$or = searchConditions;
    }
  
   
    let sortOption = {};
    switch (sort) {
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'amount-high':
        sortOption = { finalAmount: -1 };
        break;
      case 'amount-low':
        sortOption = { finalAmount: 1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const totalOrders = await Order.countDocuments(query);
    console.log('Total orders found:', totalOrders);

   
    const orders = await Order.find(query)
      .populate({
        path: 'user',
        select: 'fullName email phone',
        model: User
      })
      .populate({
        path: 'address', 
        select: 'fullName phone addressLine1 city state pincode'
      })
      .sort(sortOption)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    console.log('Orders found:', orders.length);

    const totalPages = Math.ceil(totalOrders / parseInt(limit));

   
    const statusCounts = await Order.aggregate([
      {
        $group: {
          _id: '$orderStatus',
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

    statusCounts.forEach(item => {
      if (item._id) {
        statusCountsMap[item._id] = item.count;
      }
    });


    const formattedOrders = orders.map(order => ({
      ...order,
      _id: order._id.toString(),
      orderDate: order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'N/A',
      formattedAmount: new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
      }).format(order.finalAmount || 0),
  
      customerName: order.address?.fullName || order.user?.fullName || 'N/A',
      customerPhone: order.address?.phone || order.user?.phone || 'N/A',
      
      displayOrderNumber: order.orderNumber || `ORD-${order._id.slice(-8).toUpperCase()}`
    }));

    res.render('admin/order', {
      orders: formattedOrders,
      currentPage: parseInt(page),
      totalPages,
      totalOrders,
      limit: parseInt(limit),
      statusFilter: status || 'all',
      searchQuery: search || '',
      sortBy: sort,
      startDate: startDate || '',
      endDate: endDate || '',
      statusCounts: statusCountsMap,
      layout: "admin/layouts/main",
      title: 'Orders Management',
      pageJS: 'order.js',
    });
  } catch (error) {
    console.error('Error loading admin orders:', error);
    req.flash('error', 'Error loading orders: ' + error.message);
    res.redirect('/admin/dashboard');
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

  
    if (order.orderStatus === 'Delivered') {
      return res.status(400).json({
        success: false,
        message: 'Delivered orders cannot be modified'
      });
    }
    if (order.orderStatus === 'Cancelled') {
  return res.status(400).json({
    success: false,
    message: 'Cancelled orders cannot be modified'
  });
}

    const validStatuses = [
      'Placed',
      'Confirmed',
      'Shipped',
      'OutForDelivery',
      'Delivered',
      'Cancelled'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }


    order.orderStatus = status;

    order.statusHistory ??= [];
    order.statusHistory.push({
      status,
      changedAt: new Date(),
      notes: notes || '',
      changedBy: req.admin?._id || null
    });

 
    if (status === 'Delivered' && order.paymentMethod === 'COD') {
      order.paymentStatus = 'Paid';
    }

    await order.save();

    res.json({
      success: true,
      message: 'Order status updated successfully'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Error updating order status'
    });
  }
};



export const viewOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('user', 'fullName email')
      .populate({
        path: "items.product",
        select: "name images"
      })
      .populate({
        path: "items.variant",
        select: "size color images price"
      });

    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/admin/orders');
    }

 
    const orderWithDefaults = {
      ...order.toObject(),
     
      cancellationReason: order.cancellationReason || 'No reason provided',
      cancellationReasonCode: order.cancellationReasonCode || 'not_specified',
      cancelledAt: order.cancelledAt || null,
      cancelledBy: order.cancelledBy || 'user',
      statusHistory: order.statusHistory || [],
      paymentStatus: order.paymentStatus || 'Pending'
    };


    const formattedOrder = {
      ...orderWithDefaults,
      orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-8).toUpperCase()}`,
      orderDate: new Date(order.createdAt).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      formattedAmount: new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
      }).format(order.finalAmount || 0),
      items: order.items.map(item => ({
        ...item,
        product: item.product || { name: 'Product', images: [] },
        variant: item.variant || { size: null, color: null, images: [] },
        formattedPrice: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2
        }).format(item.price || 0),
        formattedTotal: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2
        }).format(item.total || 0)
      }))
    };

    res.render('admin/order-details', {
      order: formattedOrder,
      title: 'Order Details',
      pageTitle: 'Order Details',
      pageJS: 'order-details.js',
    });
  } catch (error) {
    console.error('Error getting order details:', error);
    req.flash('error', 'Error getting order details');
    res.redirect('/admin/orders');
  }
};

export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('user', 'fullName email phone')
      .populate({
        path: 'items.product',
        select: 'name images'
      })
      .populate({
        path: 'items.variant',
        select: 'size color images price'
      })
      .lean();

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

  
    const formattedOrder = {
      ...order,
      orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-8).toUpperCase()}`,
      orderDate: new Date(order.createdAt).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      formattedAmount: new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
      }).format(order.finalAmount || 0),
      items: order.items.map(item => ({
        ...item,
        product: item.product || { name: 'Product', images: [] },
        variant: item.variant || { size: null, color: null, images: [] },
        formattedPrice: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2
        }).format(item.price || 0),
        formattedTotal: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2
        }).format(item.total || 0)
      }))
    };

    res.json({
      success: true,
      order: formattedOrder
    });
  } catch (error) {
    console.error('Error getting order details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting order details' 
    });
  }
};

export const clearFilters = async (req, res) => {
  try {
   
    res.redirect('/admin/orders');
  } catch (error) {
    console.error('Error clearing filters:', error);
    req.flash('error', 'Error clearing filters');
    res.redirect('/admin/orders');
  }
};
export const cancelUserOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findOne({
      _id: orderId,
      user: userId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (!["Placed", "Confirmed"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "This order cannot be cancelled"
      });
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

    return res.json({
      success: true,
      message: "Order cancelled successfully"
    });

  } catch (err) {
    console.error("Cancel order error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order"
    });
  }
};