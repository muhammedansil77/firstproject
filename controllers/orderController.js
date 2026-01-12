import Order from "../../models/Order.js";
import Cart from "../../models/Cart.js";
import Address from "../../models/Address.js";

export const placeOrder = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { addressId } = req.body;

    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("items.variant");

    const address = await Address.findById(addressId);

    if (!cart || !address) {
      return res.status(400).json({ success: false });
    }

    const items = cart.items.map(i => ({
      product: i.product._id,
      variant: i.variant._id,
      quantity: i.quantity,
      price: i.variant.salePrice,
      total: i.quantity * i.variant.salePrice
    }));

    const subtotal = items.reduce((a, b) => a + b.total, 0);

    const order = await Order.create({
      user: userId,
      address,
      items,
      subtotal,
      tax: 0,
      discount: 0,
      shipping: 0,
      finalAmount: subtotal,
      paymentMethod: "COD"
    });

    await Cart.deleteOne({ user: userId });

    res.json({
      success: true,
      orderId: order._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};
