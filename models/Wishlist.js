// models/Wishlist.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const wishlistSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        variantId: {
            type: Schema.Types.ObjectId,
            ref: "Variant",
            required: false // CHANGE TO FALSE
        },
        addedOn: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
module.exports = Wishlist;