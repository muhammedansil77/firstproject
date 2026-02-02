// import mongoose from 'mongoose';
// import Order from './models/Order.js';

// async function run() {
//   await mongoose.connect('mongodb://127.0.0.1:27017/firstproject');

//   console.log('DB name:', mongoose.connection.name);

//   const total = await Order.countDocuments();
//   console.log('Total orders:', total);

//   const grouped = await Order.aggregate([
//     {
//       $group: {
//         _id: '$user',
//         count: { $sum: 1 }
//       }
//     }
//   ]);

//   console.log('Grouped orders:', grouped);

//   await mongoose.disconnect();
// }

// run();
