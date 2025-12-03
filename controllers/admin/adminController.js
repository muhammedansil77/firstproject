
const User = require("../../models/userSchema");
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
const loadLogin = async (req,res)=>{
  try{
  return res.render("admin/login", {
    layout: false,  
    error: req.query.error || null,
    success: req.query.success || null
  });

  }catch(errors){
    console.log(errors)

  }
}
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.redirect('/admin/login?error=' + encodeURIComponent('Admin not found'));

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.redirect('/admin/login?error=' + encodeURIComponent('Incorrect password'));

  
    req.session.adminId = admin._id;
    req.session.adminLoggedIn = true;

    
    return req.session.save(() => res.redirect('/admin/dashboard'));
  } catch (err) {
    console.error(err);
    return res.redirect('/admin/login?error=' + encodeURIComponent('Server error'));
  }
};
const loadUsers = async (req, res) => {
  try {
    
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = 11;
    const search = (req.query.search || '').trim();
    const status = (req.query.status || 'all').toLowerCase(); 
    const from = req.query.from ? req.query.from.trim() : null;
    const to = req.query.to ? req.query.to.trim() : null;       

   
    const filter = { isAdmin: false };

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ fullName: regex }, { email: regex }];
    }

  
    if (status === 'verified') filter.isVerified = true;
    else if (status === 'unverified') filter.isVerified = false;
    else if (status === 'blocked') filter.isBlocked = true;
    else if (status === 'active') filter.isBlocked = false;

    
    if (from || to) {
      filter.createdAt = {};
      if (from) {
       
        const gte = new Date(from + 'T00:00:00.000Z');
        if (!isNaN(gte.getTime())) filter.createdAt.$gte = gte;
      }
      if (to) {
       
        const lte = new Date(to + 'T23:59:59.999Z');
        if (!isNaN(lte.getTime())) filter.createdAt.$lte = lte;
      }
     
      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }

  
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalUsers / perPage));
    const skip = (page - 1) * perPage;

    const users = await User.find(filter)
      .select('fullName email isVerified isBlocked createdAt phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean();

    console.log('[DEBUG] loadUsers', { page, perPage, search, status, from, to, totalUsers, usersLength: users.length, skip, totalPages });

    return res.render('admin/users', {
      title: 'Users',
      users,
      current: 'users',
      pagination: { totalUsers, totalPages, perPage, page },
      filters: { search, status, from, to },
      
    });
  } catch (error) {
    console.error('loadUsers error:', error);
    return res.status(500).send('Server error');
  }
};

const blockUnblockUser = async (req, res) => {
  try {
    const { id } = req.params;
 
    const action = req.body.action || req.query.action;

    let isBlocked;
    if (action === "block") isBlocked = true;
    else if (action === "unblock") isBlocked = false;
    else {
     
      const u = await User.findById(id);
      if (!u) return res.status(404).send("User not found");
      isBlocked = !u.isBlocked;
    }

    const user = await User.findByIdAndUpdate(id, { isBlocked }, { new: true });
    if (!user) return res.status(404).send("User not found");



    return res.redirect(req.get("referer") || "/admin/users");
  } catch (err) {
    console.error("blockUnblockUser error:", err);
    return res.status(500).send("Server error");
  }
};

const logout = (req, res) => {
  try {
 
    if (req.session) {
      req.session.adminId = null;
      req.session.adminLoggedIn = false;
    }
  
    return req.session.save(() => {
      return res.redirect('/admin/login?success=' + encodeURIComponent('Logged out'));
    });
  } catch (err) {
    console.error('admin logout error:', err);
    return res.redirect('/admin/login?error=' + encodeURIComponent('Logout failed'));
  }
};




module.exports ={
    loadDashboard,
    loadUsers,
    blockUnblockUser,
    loadLogin,
    login,
    logout
}