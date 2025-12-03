const mongoose = require("mongoose");
require("dotenv").config();


mongoose.set("bufferCommands", false);
mongoose.set("strictQuery", false);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log("DB connected");
    } catch (error) {
        console.log("MongoDB connection error:", error);
    }
};

module.exports = connectDB;
