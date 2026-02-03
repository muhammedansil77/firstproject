import User from "../../models/userSchema.js";
import userController from "../userController.js";
import Order from "../../models/Order.js";
import { getUsersWithFilters } from "../../services/userServices.js";
const { loadLoginPage } = userController;
import Admin from "../../models/Admin.js";
import bcrypt from "bcrypt";

const loadDashboard = async (req, res) => {
  try {
    return res.render('admin/dashboard', {
    title: 'Admin Dashboard',
    current: 'dashboard',
    user: req.user
  });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
};
const loadLogin = async (req, res) => {
  try {
  
    if (req.session && req.session.adminLoggedIn) {
      return res.redirect('/admin/reports/dash');
    }


    return res.render("admin/login", {
      layout: false,
      error: req.query.error || null,
      success: req.query.success || null
    });

  } catch (errors) {
    console.log(errors);
    return res.status(500).send('Server error');
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.redirect('/admin/login?error=' + encodeURIComponent('Admin not found'));

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.redirect('/admin/login?error=' + encodeURIComponent('Incorrect password'));

  
    req.session.adminId = admin._id;
    req.session.adminLoggedIn = true;

    
    return req.session.save(() => res.redirect('/admin/reports/dash'));
  } catch (err) {
    console.error(err);
    return res.redirect('/admin/login?error=' + encodeURIComponent('Server error'));
  }
};
 const loadUsers = async (req, res) => {
  try {
    const data = await getUsersWithFilters(req.query);

    return res.render("admin/users", {
      title: "Users",
      users: data.users,
      pagination: data.pagination,
      filters: {
        search: req.query.search || "",
        status: req.query.status || "all",
        sort: req.query.sort || "latest"
      },
      current: "users",
      success: req.query.success,
      error: req.query.error,
      pageJS: "user.js"
    });

  } catch (error) {
    console.error("loadUsers error:", error);

    return res.status(500).send("Internal Server Error");
  }
};
const blockUnblockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const action = req.body.action || req.query.action;
    const { confirmation, reason } = req.body;
    const referer = req.get('referer') || '/admin/users';


    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

  
    if (user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify admin users'
      });
    }

  
    let newBlockStatus;
    let actionType;

    if (action === 'block') {
      if (user.isBlocked) {
        return res.status(400).json({
          success: false,
          message: 'User is already blocked'
        });
      }
      newBlockStatus = true;
      actionType = 'block';
    } else if (action === 'unblock') {
      if (!user.isBlocked) {
        return res.status(400).json({
          success: false,
          message: 'User is already active'
        });
      }
      newBlockStatus = false;
      actionType = 'unblock';
    } else {
   
      newBlockStatus = !user.isBlocked;
      actionType = newBlockStatus ? 'block' : 'unblock';
    }

  
    if (req.query.confirm === 'true' && !confirmation) {
      return res.json({
        requiresConfirmation: true,
        user: {
          id: user._id,
          name: user.fullName,
          email: user.email,
          currentStatus: user.isBlocked ? 'blocked' : 'active',
          action: actionType
        }
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { 
        isBlocked: newBlockStatus,
        ...(reason && { blockReason: reason })
      },
      { new: true }
    );


    console.log(`User ${actionType}ed:`, {
      userId: id,
      userName: user.fullName,
      action: actionType,
      reason: reason || 'No reason provided',
      timestamp: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: `User ${actionType}ed successfully`,
      user: {
        id: updatedUser._id,
        name: user.fullName,
        isBlocked: updatedUser.isBlocked,
        status: updatedUser.isBlocked ? 'blocked' : 'active',
        action: actionType
      }
    });

  } catch (error) {
    console.error('blockUnblockUser error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
};


const generatePaginationURL = (page, filters) => {
  const params = new URLSearchParams();
  params.set('page', page);
  
  if (filters.search) params.set('search', filters.search);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  
  return `/admin/users?${params.toString()}`;
};
const logout = (req, res) => {
  if (req.session) {
    delete req.session.adminId;
    delete req.session.adminLoggedIn;
  }

  res.redirect('/admin/login');
};




export {
  loadDashboard,
  loadUsers,
  blockUnblockUser,
  loadLogin,
  login,
  logout
};
