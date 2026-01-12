import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

class RazorpayService {

  static async createOrder(amount, currency = "INR") {
    try {
      const options = {
        amount: amount * 100,
        currency: currency,
        receipt: `receipt_${Date.now()}`,
        payment_capture: 1
      };
      
      const order = await razorpay.orders.create(options);
      return order;
    } catch (error) {
      console.error("Razorpay order creation error:", error);
      throw error;
    }
  }


  static verifyPayment(orderId, paymentId, signature) {
    try {
      const body = orderId + "|" + paymentId;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");
      
      return expectedSignature === signature;
    } catch (error) {
      console.error("Payment verification error:", error);
      return false;
    }
  }

 
  static async getPaymentDetails(paymentId) {
    try {
      const payment = await razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      console.error("Error fetching payment details:", error);
      throw error;
    }
  }
}

export default RazorpayService;