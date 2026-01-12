import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  imagePath: {
    type: String,
    required: true
  }
}, { timestamps: true });

export default mongoose.model("Image", imageSchema);
