import Cart from "../../models/cart.js";
import Wishlist from "../../models/Wishlist.js";
export const setHeaderCounts = async (req, res, next) => {
  try {
    if (!req.session?.isLoggedIn || !req.session?.userId) {
      res.locals.cartCount = 0;
      res.locals.wishlistCount = 0;
      return next();
    }

    const userId = req.session.userId;

    const cart = await Cart.findOne({ user: userId }).lean();
    const wishlist = await Wishlist.findOne({ userId: userId }).lean();

    const cartCount =
      cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

    const wishlistCount = wishlist?.items?.length || 0;

    res.locals.cartCount = cartCount;
    res.locals.wishlistCount = wishlistCount;

    next();
  } catch (err) {
    console.log("Header Count Error:", err);
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;
    next();
  }
};

