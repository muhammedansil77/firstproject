const mongoose = require("mongoose");
const Product = require("./productSchema");
const {Schema} = mongoose;


const cartSchema = new mongoose.Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    items:[{
        ProductId:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true,
        },
        quantity:{
            type:Number,
            default:1
    
        },
        price:{
            type:Number,
            required:true
        },
        status:{
            type:String,
            default:"placed"
        },
        cancellationReason:{
            type:String,
            default:"none",


        }

    }]
})
const cart = mongoose.model("Cart",cartSchema);
  module.exports = cart;
  