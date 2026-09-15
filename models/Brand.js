import mongoose from "mongoose";

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Brand name is required"],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Brand slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    logo: {
      type: String,
      default: "",
      trim: true,
    },
    logoPublicId: {
      type: String,
      default: "",
      trim: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: [0, "Display order cannot be negative"],
    },
    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "DISABLED"],
        message: "{VALUE} is not a valid brand status",
      },
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

// Query index
brandSchema.index({ status: 1, displayOrder: 1, name: 1 });

export default mongoose.model("Brand", brandSchema);
