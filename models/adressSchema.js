const mongoose = require("mongoose");
const { schema } = require("./userSchema");
const {Schema} = mongoose;

const adressSchema = new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true,

    },
    address:[{
        addresstype:{
            type:String,
            required:true
        },
        name:{
            type:String,
            required:true
        },
        city:{
            type:String,
            required:true,

        },
        landMark:{
            type:String,
            required:true
        },
        passcode:{
            type:Number,
            required:true
        },
        phone:{
            type:String,
            required:true
        },
        altPhone:{
            type:String,
            required:true

        }

    }]
})
 const Address = mongoose.model("Address",adressSchema);
 module.exports = Address;