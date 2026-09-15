import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const productStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "mobile-shop/products",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const bannerStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "mobile-shop/homepage_banners",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const brandStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "mobile-shop/brands",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "svg"],
  },
});

export const uploadBanners = multer({ storage: bannerStorage });
export const uploadBrandLogo = multer({
  storage: brandStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});
const upload = multer({ storage: productStorage });

export default upload;
