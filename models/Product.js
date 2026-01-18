import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: {
      type: String,
      enum: ["mobile", "accessory"],
      required: true,
    },
    brand: { type: String },
    image: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
