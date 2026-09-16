import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default",
      enum: ["default"],
    },
    // Store Identity
    storeName: { type: String, required: true, trim: true },
    storeTagline: { type: String, default: "" },
    storeDescription: { type: String, default: "" },
    // Contact
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    whatsappNumber: { type: String, default: "" },
    // Location
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    mapEmbedUrl: { type: String, default: "" },
    directionsUrl: { type: String, default: "" },
    // Business Hours
    weekdayHours: { type: String, default: "" },
    weekendHours: { type: String, default: "" },
    // Social
    facebookUrl: { type: String, default: "" },
    instagramUrl: { type: String, default: "" },
    youtubeUrl: { type: String, default: "" },
    // Shipping & COD
    freeShippingThreshold: { type: Number, min: 0, default: 500 },
    baseShippingCharge: { type: Number, min: 0, default: 49 },
    codEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);



export default mongoose.model("Settings", settingsSchema);
