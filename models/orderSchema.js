const mongoose = require("mongoose");
const {Schema} = mongoose;
const {v4:uuidvd4} = require("uuid");
const Product = require("./productSchema");


const orderSchema = new mongoose.Schema({
    orderId:{
        type:String,
        default:()=>uuidvd4(),
        unique:true
    },
    orderrditem:[{
        product:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        quantity:{
            type:Number,
            required:true,


        },
        price:{
            type:Number,
            default:0
        }
    }],
    totalPrice:{
        type:Number,
        required:true
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
        required:true
    },
    address:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    invoiceDate:{
        type:Date
    },
    status:{
        type:String,
        required:true,
        enum:["pending","proccessing","shipped","Delivered","Cancelled","returnRequest","Returnrd"]
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true,
        coupenApplied:{
            type:Boolean,
            default:false
        }

    }
})
const Order = mongoose.model("Order",orderSchema);
module.exports = Order;
