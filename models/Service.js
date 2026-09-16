import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "DEVICE_SALES",
        "REPAIRS",
        "ACCESSORIES",
        "NETWORK_DATA",
        "WARRANTY_SUPPORT",
      ],
    },
    shortDescription: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    icon: {
      type: String,
      default: "",
      trim: true,
    },
    image: {
      type: String,
      default: "",
      trim: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "DISABLED"],
      default: "ACTIVE",
    },
    ctaLabel: {
      type: String,
      default: "",
      trim: true,
    },
    ctaTarget: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

// Indexes
// name and slug are already unique and automatically indexed by Mongoose
serviceSchema.index({ status: 1, displayOrder: 1, name: 1 });

const Service = mongoose.model("Service", serviceSchema);
export default Service;
