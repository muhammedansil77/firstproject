const mongoose = require("mongoose");
const {Schema} = mongoose;


 const wishlistSchema = new mongoose.Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"Product",
        required:true
    },
    product:[{
        productId:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        addedOn:{
            type:Date,
            default:Date.now
        }

    }]

 })
 const Wishlist = mongoose.model("Wishlist",wishlistSchema);
 module.exports= Wishlist;