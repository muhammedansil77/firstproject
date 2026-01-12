
const User = require("../../models/userSchema").default;
const { loadLoginPage } = require("../userController");
const Admin = require("../../models/Admin");
const bcrypt = require("bcrypt");
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
    console.log('[DEBUG] loadUsers called with query:', req.query);

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = parseInt(req.query.perPage || '11', 10);
    const search = (req.query.search || '').trim();
    const status = (req.query.status || 'all').toLowerCase();
    const from = req.query.from ? req.query.from.trim() : null;
    const to = req.query.to ? req.query.to.trim() : null;
    
  
    const sort = (req.query.sort || 'latest').toLowerCase();

    console.log('[DEBUG] Parsed parameters:', { page, perPage, search, status, from, to, sort });

    const filter = { isAdmin: false };
    console.log('[DEBUG] Base filter:', filter);
   

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { phone: regex || '' }
      ];
     
    }


    if (status === 'verified') {
      filter.isVerified = true;
    } else if (status === 'unverified') {
      filter.isVerified = false;
    } else if (status === 'blocked') {
      filter.isBlocked = true;
    } else if (status === 'active') {
      filter.isBlocked = false;
    }
    console.log('[DEBUG] After status filter:', filter);

   
    const totalUsers = await User.countDocuments(filter);
    console.log('[DEBUG] Total users found:', totalUsers);
    
    const totalPages = Math.max(1, Math.ceil(totalUsers / perPage));
    const skip = (page - 1) * perPage;
    
    console.log('[DEBUG] Pagination:', { totalPages, skip, perPage });

    
    let sortOrder = {};
    switch(sort) {
      case 'a-z':
        sortOrder = { fullName: 1 }; 
      
        break;
      case 'z-a':
        sortOrder = { fullName: -1 }; 
       
        break;
      case 'oldest':
        sortOrder = { createdAt: 1 };
     
        break;
      case 'latest':
      default:
        sortOrder = { createdAt: -1 }; 
      
        break;
    }

    console.log('[DEBUG] Final sort order:', sortOrder);

    const users = await User.find(filter)
      .select('fullName email isVerified isBlocked createdAt phone')
      .sort(sortOrder)
      .skip(skip)
      .limit(perPage)
      .lean();

    console.log('[DEBUG] Users fetched:', users.length);
    
  
    if (users.length > 0) {
      console.log('[DEBUG] First 3 users (for sorting verification):');
      users.slice(0, 3).forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.fullName} - ${user.email} - ${user.createdAt}`);
      });
    }

    return res.render('admin/users', {
      title: 'Users',
      users,
      current: 'users',
      pagination: {
        totalUsers,
        totalPages,
        perPage,
        page,
        hasPrev: page > 1,
        hasNext: page < totalPages,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null
      },
      filters: { search, status, from, to, sort }, 
      success: req.query.success,
      error: req.query.error,
      pageJS: 'user.js'
    });

  } catch (error) {
    console.error('❌ loadUsers error:', error);
    console.error('📝 Error message:', error.message);
    console.error('🔍 Error stack:', error.stack);
    
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Server Error</title></head>
      <body style="background:#1f1b12; color:#fff; padding:40px; font-family:monospace;">
        <h1 style="color:#ff8b8b;">⚠️ Server Error</h1>
        <p style="color:#d6c28a;">Failed to load users. Please try again.</p>
        <pre style="background:#211c11; padding:20px; border-radius:8px; color:#c6ba93;">${error.message}</pre>
        <a href="/admin/users" style="color:#c6ba93; text-decoration:none;">← Go back to Users</a>
      </body>
      </html>
    `);
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





module.exports ={
    loadDashboard,
    loadUsers,
    blockUnblockUser,
    loadLogin,
    login,
    logout
}