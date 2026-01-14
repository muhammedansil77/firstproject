
import RefundRequest from '../../models/RefundRequest.js';
import Order from '../../models/Order.js';
import User from '../../models/userSchema.js';
import Wallet from "../../models/Wallet.js";
import mongoose from 'mongoose';


const CLOUDINARY_PLACEHOLDER =
  'https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/placeholders/no-image.png';

function resolveImage(img) {
  if (!img) return CLOUDINARY_PLACEHOLDER;
  if (img.startsWith('http')) return img; // Cloudinary
  return CLOUDINARY_PLACEHOLDER;
}





export const getAllReturns = async (req, res) => {
  try {
    const { 
      status, 
      method, 
      startDate, 
      endDate, 
      search,
      sort = 'newest',
      page = 1,
      limit = 10
    } = req.query;
    
 
    let query = {};
    
   
    if (status && status !== 'all') {
      query.status = status;
    }
    
   
    if (method && method !== 'all') {
      query.refundMethod = method;
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
      
 
      const searchConditions = [];
      
    
    if (mongoose.Types.ObjectId.isValid(search.trim())) {
  searchConditions.push({
    _id: new mongoose.Types.ObjectId(search.trim())
  });
}

      
   
      const orders = await Order.find({
        orderNumber: searchRegex
      }).select('_id');
      
      if (orders.length > 0) {
        searchConditions.push({ 
          order: { $in: orders.map(o => o._id) } 
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
        searchConditions.push({ 
          user: { $in: users.map(u => u._id) } 
        });
      }
      
     
      searchConditions.push({ reason: searchRegex });
      
      if (searchConditions.length > 0) {
        query.$or = searchConditions;
      }
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
        sortOption = { refundAmount: -1 };
        break;
      case 'amount-low':
        sortOption = { refundAmount: 1 };
        break;
      case 'status':
        sortOption = { status: 1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }
    
   
    const currentPage = parseInt(page);
    const perPage = parseInt(limit);
    const skip = (currentPage - 1) * perPage;
    

    const totalReturns = await RefundRequest.countDocuments(query);
    const totalPages = Math.ceil(totalReturns / perPage);
    

    const returns = await RefundRequest.find(query)
      .populate({
        path: 'order',
        select: 'orderNumber createdAt finalAmount'
      })
      .populate({
        path: 'user',
        select: 'fullName email phone'
      })
      .populate({
        path: 'items.product',
        select: 'name images'
      })
      .populate({
        path: 'items.variant',
        select: 'color size'
      })
      .sort(sortOption)
      .skip(skip)
      .limit(perPage)
      .lean();
    
  
    const total = await RefundRequest.countDocuments();
    const pending = await RefundRequest.countDocuments({ status: 'pending' });
    const approved = await RefundRequest.countDocuments({ status: 'approved' });
    const completed = await RefundRequest.countDocuments({ 
      status: 'refund_completed' 
    });
    
  
    const formattedReturns = returns.map(returnReq => ({
      ...returnReq,
      displayId: `REF-${returnReq._id.toString().slice(-8).toUpperCase()}`,
      formattedDate: returnReq.createdAt ? 
        new Date(returnReq.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }) : 'N/A',
      formattedTime: returnReq.createdAt ?
        new Date(returnReq.createdAt).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit'
        }) : 'N/A',
      formattedAmount: new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
      }).format(returnReq.refundAmount || 0),
      statusText: returnReq.status ? 
        returnReq.status.charAt(0).toUpperCase() + returnReq.status.slice(1).replace('_', ' ') : 
        'N/A'
    }));
    
    res.render('admin/returnList', {
      title: 'Return Management - LuxTime Admin',
      returns: formattedReturns,
      returnStats: {
        total,
        pending,
        approved,
        completed
      },
      currentPage,
      totalPages,
      totalReturns,
      perPage,
      statusFilter: status || 'all',
      methodFilter: method || 'all',
      searchQuery: search || '',
      sortBy: sort,
      startDate: startDate || '',
      endDate: endDate || '',
      user: req.session.admin || {},
      currentPath: '/admin/returns',
      pageJS: "return.js",
    });
    
  } catch (error) {
    console.error('Get all returns error:', error);
    res.status(500).render('error', { 
      title: 'Error - LuxTime Admin',
      error: 'Failed to load return requests' 
    });
  }
};




export const updateReturnStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const returnReq = await RefundRequest.findById(id);
    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return not found' });
    }
    
    returnReq.status = status;
    returnReq.updatedAt = new Date();
    
   
    switch (status) {
      case 'approved':
        returnReq.approvedAt = new Date();
        break;
      case 'pickup_scheduled':
        returnReq.pickupScheduledAt = new Date();
        break;
      case 'picked_up':
        returnReq.pickedUpAt = new Date();
        break;
      case 'refund_initiated':
        returnReq.refundInitiatedAt = new Date();
        break;
      case 'refund_completed':
        returnReq.refundCompletedAt = new Date();
        break;
    }
    
    await returnReq.save();
    
    res.json({ success: true, message: 'Status updated successfully' });
    
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


export const bulkUpdateReturns = async (req, res) => {
  try {
    const { returnIds, status } = req.body;
    
    const result = await RefundRequest.updateMany(
      { _id: { $in: returnIds } },
      { 
        $set: { 
          status: status,
          updatedAt: new Date()
        }
      }
    );
    
    res.json({ 
      success: true, 
      message: 'Bulk update successful',
      updatedCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


export const deleteReturn = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await RefundRequest.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ success: false, message: 'Return not found' });
    }
    
    res.json({ success: true, message: 'Return deleted successfully' });
    
  } catch (error) {
   
    res.status(500).json({ success: false, message: error.message });
  }
};


export const exportReturns = async (req, res) => {
  try {
    const { status, method, startDate, endDate, search } = req.query;

    let query = {};

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Refund method
    if (method && method !== 'all') {
      query.refundMethod = method;
    }

    // Date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Search
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { reason: regex },
        { status: regex }
      ];
    }

    const returns = await RefundRequest.find(query)
      .populate('order', 'orderNumber')
      .populate('user', 'fullName email')
      .lean();

    let csv = 'Return ID,Order Number,Customer,Email,Amount,Status,Date\n';

    returns.forEach(r => {
      csv += `"REF-${r._id.toString().slice(-8).toUpperCase()}","${r.order?.orderNumber || ''}","${r.user?.fullName || ''}","${r.user?.email || ''}",${r.refundAmount || 0},"${r.status}","${new Date(r.createdAt).toLocaleDateString('en-IN')}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=returns_${new Date().toISOString().split('T')[0]}.csv`
    );
    res.send(csv);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).send('Failed to export');
  }
};

export const getReturnDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    const returnReq = await RefundRequest.findById(id)
      .populate({
        path: 'order',
        select: 'orderNumber createdAt orderStatus paymentMethod'
      })
      .populate({
        path: 'user',
        select: 'fullName email phone'
      })
      .populate({
        path: 'items.product',
        select: 'name images'
      })
      .populate({
        path: 'items.variant',
        select: 'color size images'
      })
      .lean();
    
    if (!returnReq) {
      req.flash('error', 'Return request not found');
      return res.redirect('/admin/returns');
    }
    

   
    
 const item = returnReq.items?.[0] || {};

const rawImage =
  item.variant?.images?.[0] ||
  item.product?.images?.[0] ||
  null;

const imageSrc = resolveImage(rawImage);

res.render('admin/returnDetail', {
  title: 'Return Details - LuxTime Admin',
  returnReq,
  order: returnReq.order || {},
  user: returnReq.user || {},
  item: {
    ...item,
    imageSrc
  },
  pageJS: 'returnDetails.js'
});

    
  } catch (error) {
    console.error('Get return detail error:', error);
    req.flash('error', 'Failed to load return details');
    res.redirect('/admin/returns');
  }
};


export const updateReturnStatusWithNotes = async (req, res) => {
  try {
  
   
    
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    
    if (!id || !status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Return ID and status are required' 
      });
    }
    
    const returnReq = await RefundRequest.findById(id);
    if (!returnReq) {
      return res.status(404).json({ 
        success: false, 
        message: 'Return request not found' 
      });
    }
    
    console.log('Current status:', returnReq.status, 'Requested status:', status);
    
   
    const validTransitions = {
      'pending': ['approved', 'rejected'],
      'approved': ['pickup_scheduled', 'rejected'],
      'pickup_scheduled': ['picked_up', 'approved'], 
      'picked_up': ['refund_initiated', 'approved'], 
      'refund_initiated': ['refund_completed', 'approved'], 
      'refund_completed': [], 
      'rejected': [] 
    };
    
    const currentStatus = returnReq.status;
    const allowedNextStatuses = validTransitions[currentStatus] || [];
    
   
    if (currentStatus === status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status is already ' + status 
      });
    }
    

    if (!allowedNextStatuses.includes(status)) {
      console.log('Invalid transition. Allowed:', allowedNextStatuses);
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status transition from ${currentStatus} to ${status}. Allowed: ${allowedNextStatuses.join(', ')}` 
      });
    }
    
  
    returnReq.status = status;
    returnReq.updatedAt = new Date();
    
 
    if (adminNotes && adminNotes.trim()) {
      returnReq.adminNotes = returnReq.adminNotes || [];
      returnReq.adminNotes.push({
        note: adminNotes.trim(),
        addedAt: new Date(),
        statusChange: status
      });
    }
    
    
  const now = new Date();
switch (status) {
  case 'approved':
    returnReq.approvedAt = now;
    break;

  case 'pickup_scheduled':
    returnReq.pickupScheduledAt = now;
    break;

  case 'picked_up':
    returnReq.pickedUpAt = now;
    break;

  case 'refund_initiated':
    returnReq.refundInitiatedAt = now;
    break;

case 'refund_completed': {
  returnReq.refundCompletedAt = now;

  const order = await Order.findById(returnReq.order);

  const shouldCreditWallet =
    returnReq.refundMethod === 'wallet' ||
    returnReq.refundMethod === 'original_method' ||
    order.paymentMethod === 'COD';

  if (shouldCreditWallet && !returnReq.walletRefunded) {
    const wallet = await Wallet.findOne({ user: returnReq.user });

    if (!wallet) {
      throw new Error('Wallet not found for refund');
    }

    const refundAmount = returnReq.refundAmount;

    wallet.balance += refundAmount;

    wallet.transactions.push({
      amount: refundAmount,
      type: "credit",
      description: `Refund for returned order ${order.orderNumber}`,
      status: "success",
      payment_method: "refund",
      order_id: order._id,
      createdAt: new Date()
    });

    await wallet.save();

    order.paymentStatus = "Refunded";
    await order.save();

    returnReq.walletRefunded = true;

    console.log(` Wallet credited ₹${refundAmount} for return ${returnReq._id}`);
  }

  break;
}



  case 'rejected':
    returnReq.rejectedAt = now;
    break;
}

    

    returnReq.statusHistory = returnReq.statusHistory || [];
    returnReq.statusHistory.push({
      status: status,
      changedAt: now,
      changedBy: req.session.admin?._id || 'admin',
      notes: adminNotes,
      previousStatus: currentStatus
    });
    
    await returnReq.save();
    
    console.log('Status updated successfully:', returnReq.status);
    
    res.json({ 
      success: true, 
      message: `Status updated from ${currentStatus} to ${status}`,
      data: {
        id: returnReq._id,
        status: returnReq.status,
        updatedAt: returnReq.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error'
    });
  }
};

export const rejectReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason, adminNotes } = req.body;
    
    const returnReq = await RefundRequest.findById(id);
    if (!returnReq) {
      return res.status(404).json({ 
        success: false, 
        message: 'Return request not found' 
      });
    }
    
   
    const rejectableStatuses = ['pending', 'approved'];
    if (!rejectableStatuses.includes(returnReq.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot reject from current status: ${returnReq.status}` 
      });
    }
    
   
    returnReq.status = 'rejected';
    returnReq.updatedAt = new Date();
    returnReq.rejectedAt = new Date();
    
  
    returnReq.rejectionReason = rejectionReason;
    
    if (adminNotes && adminNotes.trim()) {
      returnReq.adminNotes = returnReq.adminNotes || [];
      returnReq.adminNotes.push({
        note: adminNotes.trim(),
        addedAt: new Date(),
        statusChange: 'rejected'
      });
    }
    
  
    returnReq.statusHistory = returnReq.statusHistory || [];
    returnReq.statusHistory.push({
      status: 'rejected',
      changedAt: new Date(),
      changedBy: req.session.admin?._id || 'admin',
      notes: `Rejected: ${rejectionReason} ${adminNotes ? ' - ' + adminNotes : ''}`,
      previousStatus: returnReq.status
    });
    
    await returnReq.save();
    
    res.json({ 
      success: true, 
      message: 'Return request rejected successfully',
      data: {
        id: returnReq._id,
        status: returnReq.status,
        rejectedAt: returnReq.rejectedAt
      }
    });
    
  } catch (error) {
    console.error('Reject return error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to reject return request'
    });
  }
};

