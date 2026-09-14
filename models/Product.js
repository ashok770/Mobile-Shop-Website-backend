import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    brand: {
      type: String,
      trim: true,
    },

    category: {
      type: String,
      enum: ["mobile", "accessory"],
      required: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "DRAFT"],
      default: "ACTIVE",
      trim: true,
    },

    image: {
      type: String,
    },

    images: {
      type: [String],
      required: true,
    },

    // 🔹 Pricing
    originalPrice: {
      type: Number,
      required: true,
    },

    discountPercent: {
      type: Number,
      default: 0, // e.g. 29 for -29%
    },

    finalPrice: {
      type: Number,
      required: true,
    },

    // 🔹 Inventory
    stock: {
      type: Number,
      required: true,
      default: 0,
    },

    // 🔹 Offers (Admin controlled)
    offerType: {
      type: String,
      enum: ["NONE", "MEGA_FLASH_SALE", "BUY_1_GET_1", "DAILY_SPECIAL"],
      default: "NONE",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Product", productSchema);
