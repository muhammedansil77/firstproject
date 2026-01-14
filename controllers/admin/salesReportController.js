import Order from '../../models/Order.js';
import User from '../../models//userSchema.js';
import Product from '../../models/Product.js';
import Coupon from '../../models/Coupon.js';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';


const formatDate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};
const isRevenueOrder = (order) => {

  if (order.orderStatus !== 'Delivered') return false;


  if (order.refundStatus === 'Completed') return false;


  if (order.paymentMethod !== 'COD' && order.paymentStatus !== 'Paid') {
    return false;
  }

  return true;
};



export const getSalesReportPage = async (req, res) => {
  try {
    const { 
      period = 'today', 
      startDate, 
      endDate, 
      paymentMethod = 'all',
      orderStatus = 'all',
      chartType = 'daily',
      exportType
    } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 10; 
    const search = req.query.search || '';

  
    let start, end;
    const now = new Date();

    switch (period) {
      case 'today':
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date();
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        start = new Date(yesterday);
        start.setHours(0, 0, 0, 0);
        end = new Date(yesterday);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        break;
      case 'quarter':
        start = new Date(now);
        start.setMonth(now.getMonth() - 3);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        break;
      case 'year':
        start = new Date(now);
        start.setFullYear(now.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        break;
      case 'custom':
        start = startDate ? new Date(startDate) : new Date(now.setMonth(now.getMonth() - 1));
        start.setHours(0, 0, 0, 0);
        end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);
        break;
      default:
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date();
    }


    const query = {
      createdAt: { $gte: start, $lte: end }
    };

    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }

    if (orderStatus && orderStatus !== 'all') {
      query.orderStatus = orderStatus;
    }

    if (exportType) {
      return handleExport(req, res, query, exportType);
    }
    
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } },
        { 'user.email': { $regex: search, $options: 'i' } },
        { paymentMethod: { $regex: search, $options: 'i' } },
        { orderStatus: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    const totalOrdersCount = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrdersCount / limit);
   
const allOrdersForStats = await Order.find(query)
  .populate('items.product', 'name category')
  .populate('coupon');



    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images category')
      .populate('items.variant', 'name color size')
      .populate('coupon', 'code name discountType discountValue')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });

  
    const totalUsers = await User.countDocuments({});
    const newUsersThisPeriod = await User.countDocuments({
      createdAt: { $gte: start, $lte: end }
    });

  
    let totalRevenue = 0;
    let totalOrders = orders.length;
    let totalItemsSold = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalShipping = 0;
    let averageOrderValue = 0;
    
    const paymentMethods = {};
    const orderStatuses = {};
    const topProducts = {};
    const dailySales = {};
    const hourlySales = {};
    const categorySales = {};
    const couponUsage = {};

  allOrdersForStats.forEach(order => {
      const revenueEligible = isRevenueOrder(order);

      if (revenueEligible) {
        totalRevenue += order.finalAmount || 0;
      }

      if (revenueEligible) {
        order.items.forEach(item => {
          totalItemsSold += item.quantity || 0;

          if (item.product) {
            const productId = item.product._id.toString();
            if (!topProducts[productId]) {
              topProducts[productId] = {
                product: item.product,
                quantity: 0,
                revenue: 0
              };
            }
            topProducts[productId].quantity += item.quantity || 0;
            topProducts[productId].revenue += item.total || 0;
          }

          if (item.product && item.product.category) {
            const category = item.product.category;
            if (!categorySales[category]) {
              categorySales[category] = {
                quantity: 0,
                revenue: 0
              };
            }
            categorySales[category].quantity += item.quantity || 0;
            categorySales[category].revenue += item.total || 0;
          }
        });
      }

      if (revenueEligible) {
        totalDiscount += order.discount || 0;
        totalTax += order.tax || 0;
        totalShipping += order.shipping || 0;
      }

      const paymentMethod = order.paymentMethod || 'Unknown';
      paymentMethods[paymentMethod] = (paymentMethods[paymentMethod] || 0) + 1;

      const status = order.orderStatus || 'Unknown';
      orderStatuses[status] = (orderStatuses[status] || 0) + 1;

      const dateStr = formatDate(order.createdAt);
      if (!dailySales[dateStr]) {
        dailySales[dateStr] = { revenue: 0, orders: 0 };
      }

      if (revenueEligible) {
        dailySales[dateStr].revenue += order.finalAmount || 0;
        dailySales[dateStr].orders += 1;
      }

      const hour = order.createdAt.getHours();
      if (!hourlySales[hour]) {
        hourlySales[hour] = { revenue: 0, orders: 0 };
      }

      if (revenueEligible) {
        hourlySales[hour].revenue += order.finalAmount || 0;
        hourlySales[hour].orders += 1;
      }

      if (revenueEligible && order.coupon) {
        const couponCode = order.couponCode || 'Unknown';
        if (!couponUsage[couponCode]) {
          couponUsage[couponCode] = {
            code: couponCode,
            name: order.coupon.name || 'Unknown',
            usage: 0,
            discount: 0
          };
        }
        couponUsage[couponCode].usage += 1;
        couponUsage[couponCode].discount += order.couponDiscount || 0;
      }
    });


    averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
  
    const conversionRate = totalUsers > 0 ? (totalOrdersCount / totalUsers) * 100 : 0;


    const bestSellingProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          orderStatus: 'Delivered'
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
          orderCount: { $addToSet: '$_id' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: '$productDetails.name',
          sku: '$productDetails.sku',
          category: '$productDetails.category',
          totalQuantity: 1,
          totalRevenue: 1,
          orderCount: { $size: '$orderCount' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

   
    const bestSellingCategories = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          orderStatus: 'Delivered'
        }
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$productDetails.category',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
          productCount: { $addToSet: '$items.product' },
          orderCount: { $addToSet: '$_id' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      { $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          categoryName: '$categoryDetails.name',
          totalQuantity: 1,
          totalRevenue: 1,
          productCount: { $size: '$productCount' },
          orderCount: { $size: '$orderCount' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

   
    const sortedTopProducts = Object.values(topProducts)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

   
    const sortedCategories = Object.entries(categorySales)
      .map(([category, data]) => ({
        category,
        ...data
      }))
      .sort((a, b) => b.revenue - a.revenue);

 
    const dailySalesArray = Object.entries(dailySales)
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...data
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    
    const hourlySalesArray = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      revenue: hourlySales[hour]?.revenue || 0,
      orders: hourlySales[hour]?.orders || 0
    }));


    const paymentMethodsArray = Object.entries(paymentMethods).map(([method, count]) => ({
      method,
      count
    }));


    const orderStatusesArray = Object.entries(orderStatuses).map(([status, count]) => ({
      status,
      count
    }));
    const charts = {
  dailySales: dailySalesArray,
  hourlySales: hourlySalesArray,
  paymentMethods: paymentMethodsArray,
  orderStatuses: orderStatusesArray,
  topProducts: sortedTopProducts,
  bestSellingProducts,
  bestSellingCategories,
  categories: sortedCategories,
  coupons: Object.values(couponUsage)
};


    const getFilterParams = () => {
      let params = '';
      if (period && period !== 'today') params += `&period=${period}`;
      if (paymentMethod && paymentMethod !== 'all') params += `&paymentMethod=${paymentMethod}`;
      if (orderStatus && orderStatus !== 'all') params += `&orderStatus=${orderStatus}`;
      if (startDate) params += `&startDate=${formatDate(startDate)}`;
      if (endDate) params += `&endDate=${formatDate(endDate)}`;
      return params;
    };

    res.render('admin/sales', {
      title: 'Dashboard Report',
      pageJS: 'sales.js',
        pageData: `
    <script>
      window.DASHBOARD_DATA = ${JSON.stringify(charts)};
    </script>
  `,
      orders,
      getFilterParams,
      stats: {
        totalRevenue,
        totalOrders: totalOrdersCount,
        totalItemsSold,
        totalDiscount,
        totalTax,
        totalShipping,
        averageOrderValue: averageOrderValue.toFixed(2),
        conversionRate: conversionRate.toFixed(2),
        newUsers: newUsersThisPeriod
      },
    charts,
      filters: {
        period,
        startDate: formatDate(start),
        endDate: formatDate(end),
        paymentMethod,
        orderStatus,
        chartType
      },
      dateRange: {
        start: formatDate(start),
        end: formatDate(end),
        startObj: start,
        endObj: end
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalOrders: totalOrdersCount
      },
      search
    });

  } catch (error) {
    console.error('Error in sales report:', error);
    res.status(500).render('error', {
      message: 'Failed to generate sales report',
      error: req.app.get('env') === 'development' ? error : {}
    });
  }
};

const handleExport = async (req, res, query, exportType) => {
  try {
    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'name')
      .populate('items.variant', 'name')
      .populate('coupon', 'code name')
      .sort({ createdAt: -1 });

    if (exportType === 'csv') {
      let csvContent = 'Order ID,Order Date,Customer,Email,Phone,Items,Quantity,Amount,Payment Method,Order Status,Coupon Used,Coupon Discount\n';
      
      orders.forEach(order => {
        const orderDate = new Date(order.createdAt).toLocaleString();
        const customer = order.user?.name || 'Guest';
        const email = order.user?.email || 'N/A';
        const phone = order.user?.phone || 'N/A';
        
        order.items.forEach(item => {
          const itemName = item.product?.name || 'Unknown Product';
          if (item.variant?.name) {
            itemName += ` (${item.variant.name})`;
          }
          
          csvContent += `"${order.orderNumber}","${orderDate}","${customer}","${email}","${phone}","${itemName}","${item.quantity}","${item.total}","${order.paymentMethod}","${order.orderStatus}","${order.couponCode || 'None'}","${order.couponDiscount || 0}"\n`;
        });
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=sales-report.csv');
      res.send(csvContent);
      
    } else if (exportType === 'pdf') {

  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');

  doc.pipe(res);


  doc.fontSize(18).text('Sales Report', { align: 'center' });
  doc.moveDown();

  doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`);
  doc.moveDown(2);


  doc.fontSize(11).text(
    'Order No | Date | Customer | Amount | Payment | Status',
    { underline: true }
  );
  doc.moveDown();


  orders.forEach(order => {
    doc.text(
      `${order.orderNumber} | ` +
      `${new Date(order.createdAt).toLocaleDateString()} | ` +
      `${order.user?.name || 'Guest'} | ` +
      `₹${order.finalAmount} | ` +
      `${order.paymentMethod} | ` +
      `${order.orderStatus}`
    );
  });

  doc.moveDown(2);


  const totalRevenue = orders
    .filter(o => o.orderStatus === 'Delivered' && o.paymentStatus === 'Paid')
    .reduce((sum, o) => sum + o.finalAmount, 0);

  doc.fontSize(12).text(`Total Revenue: ₹${totalRevenue}`, {
    align: 'right'
  });

  doc.end();
} else if (exportType === 'excel') {
    
      res.json({ 
        success: true, 
        message: 'Excel export not yet implemented',
        data: orders 
      });
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, error: 'Export failed' });
  }
};


export const getDashboardData = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date();
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);


    const todayOrders = await Order.find({
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });

    const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
    const todayOrdersCount = todayOrders.length;

 
    const yesterdayOrders = await Order.find({
      createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd }
    });

    const yesterdayRevenue = yesterdayOrders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
    const yesterdayOrdersCount = yesterdayOrders.length;


    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthOrders = await Order.find({
      createdAt: { $gte: monthStart, $lte: todayEnd }
    });

    const monthRevenue = monthOrders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);

 
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearOrders = await Order.find({
      createdAt: { $gte: yearStart, $lte: todayEnd }
    });

    const yearRevenue = yearOrders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);

   
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const dayOrders = await Order.find({
        createdAt: { $gte: dayStart, $lte: dayEnd }
      });

      const dayRevenue = dayOrders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
      
      last7Days.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: dayRevenue,
        orders: dayOrders.length
      });
    }

  
    const topProductsAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: monthStart, $lte: todayEnd } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 }
    ]);

 
    const topProducts = await Promise.all(
      topProductsAgg.map(async (item) => {
        const product = await Product.findById(item._id).select('name');
        return {
          product: product?.name || 'Unknown',
          quantity: item.totalQuantity,
          revenue: item.totalRevenue
        };
      })
    );

    res.json({
      success: true,
      data: {
        today: {
          revenue: todayRevenue,
          orders: todayOrdersCount,
          change: yesterdayRevenue > 0 
            ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(1)
            : 0
        },
        month: {
          revenue: monthRevenue
        },
        year: {
          revenue: yearRevenue
        },
        last7Days,
        topProducts
      }
    });

  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
};