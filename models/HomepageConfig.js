import mongoose from "mongoose";

const homepageConfigSchema = new mongoose.Schema(
  {
    featuredDealProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    heroSlides: [
      {
        image: { type: String, required: true },
        publicId: { type: String, required: true },
        destination: { type: String, default: "/" },
        alt: { type: String, default: "" },
        isActive: { type: Boolean, default: true },
      },
    ],
    sections: {
      belowThousand: { type: Boolean, default: true },
      megaFlashSale: { type: Boolean, default: true },
      buy1Get1: { type: Boolean, default: true },
      dailySpecial: { type: Boolean, default: true },
      newArrivals: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

const HomepageConfig = mongoose.model("HomepageConfig", homepageConfigSchema);
export default HomepageConfig;
