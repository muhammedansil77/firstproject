
import mongoose from "mongoose";
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
            required: false 
        },
        addedOn: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

const Wishlist = mongoose.model("Wishlist", wishlistSchema);

export default Wishlist;
