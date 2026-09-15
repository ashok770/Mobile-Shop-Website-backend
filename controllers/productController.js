import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import cloudinary from "../config/cloudinary.js";
import { getSafeCleanupCandidates, executeCloudinaryCleanup } from "../utils/cloudinaryHelper.js";

// CREATE product
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      brand,
      category,
      description,
      status,
      originalPrice,
      discountPercent = 0,
      offerType = "NONE",
      stock = 0,
    } = req.body;

    if (!name || !category || !originalPrice) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const origPriceNum = Number(originalPrice);
    const discPercentNum = Number(discountPercent) || 0;
    const stockNum = Number(stock) || 0;

    if (origPriceNum < 0) {
      return res.status(400).json({ message: "Original price cannot be negative" });
    }
    if (discPercentNum < 0 || discPercentNum > 100) {
      return res.status(400).json({ message: "Discount percent must be between 0 and 100" });
    }
    if (stockNum < 0) {
      return res.status(400).json({ message: "Stock cannot be negative" });
    }
    if (status && status !== "ACTIVE" && status !== "DRAFT") {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one image is required" });
    }

    // 🔹 Collect image URLs from uploaded files
    const imageUrls = req.files.map((file) => file.path);

    // 🔹 Calculate final price safely (2 decimal places precision)
    const finalPrice = Math.max(
      0,
      Math.round((origPriceNum - (origPriceNum * discPercentNum) / 100) * 100) / 100
    );

    const product = new Product({
      name,
      brand,
      category: category ? category.toLowerCase() : category,
      description: description || "",
      status: status || "ACTIVE",
      originalPrice: origPriceNum,
      discountPercent: discPercentNum,
      finalPrice,
      offerType,
      images: imageUrls,
      image: imageUrls[0], // Keep for backward compatibility
      stock: stockNum,
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET all products
export const getProducts = async (req, res) => {
  try {
    const { page, limit, search, brand, category, status, offerType, stock } = req.query;

    // Parameter normalization (handles duplicate query array arguments safely)
    const searchVal = Array.isArray(search) ? search[0] : search;
    const brandVal = Array.isArray(brand) ? brand[0] : brand;
    const categoryVal = Array.isArray(category) ? category[0] : category;
    const statusVal = Array.isArray(status) ? status[0] : status;
    const offerTypeVal = Array.isArray(offerType) ? offerType[0] : offerType;
    const stockVal = Array.isArray(stock) ? stock[0] : stock;

    let filter = {};

    // Search sanitization against regex injection / ReDoS
    if (typeof searchVal === "string" && searchVal.trim().length > 0) {
      const trimmed = searchVal.trim().slice(0, 100); // Limit search term length to 100 chars
      const sanitized = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (sanitized.length > 0) {
        filter.$or = [
          { name: { $regex: sanitized, $options: "i" } },
          { brand: { $regex: sanitized, $options: "i" } },
        ];
      }
    }

    if (brandVal && typeof brandVal === "string") {
      filter.brand = brandVal;
    }

    if (categoryVal && typeof categoryVal === "string") {
      filter.category = categoryVal.toLowerCase();
    }

    // Draft visibility protection: non-admins are strictly locked to ACTIVE products
    const isAdmin = Boolean(req.admin);
    if (!isAdmin) {
      filter.status = "ACTIVE";
    } else {
      if (statusVal && statusVal !== "ALL") {
        filter.status = statusVal;
      }
    }

    if (offerTypeVal && typeof offerTypeVal === "string") {
      if (offerTypeVal === "PROMOTED") {
        filter.offerType = { $ne: "NONE" };
      } else {
        const ALLOWED_OFFERS = ["NONE", "MEGA_FLASH_SALE", "BUY_1_GET_1", "DAILY_SPECIAL"];
        if (!ALLOWED_OFFERS.includes(offerTypeVal)) {
          return res.status(400).json({ message: "Invalid offer type" });
        }
        filter.offerType = offerTypeVal;
      }
    }

    if (stockVal && typeof stockVal === "string") {
      if (stockVal === "in_stock") filter.stock = { $gt: 5 };
      else if (stockVal === "low_stock") filter.stock = { $gt: 0, $lte: 5 };
      else if (stockVal === "out_of_stock") filter.stock = 0;
    }

    // Handle pagination if page or limit query param is present
    if (page !== undefined || limit !== undefined) {
      const rawPage = parseInt(Array.isArray(page) ? page[0] : page, 10);
      const pageNum = isNaN(rawPage) || rawPage <= 0 ? 1 : rawPage;

      const rawLimit = parseInt(Array.isArray(limit) ? limit[0] : limit, 10);
      const limitNum = isNaN(rawLimit) || rawLimit <= 0 ? 20 : Math.min(100, rawLimit);

      const total = await Product.countDocuments(filter);
      const totalPages = Math.ceil(total / limitNum) || 1;

      // Excessive page optimization: if requested page exceeds totalPages, return empty array safely
      if (pageNum > totalPages) {
        return res.json({
          products: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
          },
        });
      }

      const skip = (pageNum - 1) * limitNum;
      const products = await Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum);

      return res.json({
        products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      });
    }

    // Backward compatible standard request (unpaginated raw array)
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET products by offer type
export const getOfferProducts = async (req, res) => {
  try {
    const { type } = req.params;
    const { status } = req.query;
    const ALLOWED_OFFERS = ["NONE", "MEGA_FLASH_SALE", "BUY_1_GET_1", "DAILY_SPECIAL"];

    if (!ALLOWED_OFFERS.includes(type)) {
      return res.status(400).json({ message: "Invalid offer type" });
    }

    const isAdmin = Boolean(req.admin);
    const filter = { offerType: type };

    if (!isAdmin) {
      filter.status = "ACTIVE";
    } else {
      const statusVal = Array.isArray(status) ? status[0] : status;
      if (statusVal && statusVal !== "ALL") {
        filter.status = statusVal;
      }
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET product by ID
export const getProductById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid Product ID format" });
    }

    const product = await Product.findById(req.params.id);
    const isAdmin = Boolean(req.admin);

    if (!product || (!isAdmin && product.status !== "ACTIVE")) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE product
export const updateProduct = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid Product ID format" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const {
      name,
      brand,
      category,
      description,
      status,
      originalPrice,
      discountPercent,
      offerType,
      stock,
    } = req.body;

    const origPriceNum = originalPrice !== undefined ? Number(originalPrice) : product.originalPrice;
    const discPercentNum = discountPercent !== undefined ? Number(discountPercent) : product.discountPercent;
    let stockNum = product.stock;
    if (stock !== undefined) {
      stockNum = Number(stock) || 0;
    }

    if (origPriceNum < 0) {
      return res.status(400).json({ message: "Original price cannot be negative" });
    }
    if (discPercentNum < 0 || discPercentNum > 100) {
      return res.status(400).json({ message: "Discount percent must be between 0 and 100" });
    }
    if (stockNum < 0) {
      return res.status(400).json({ message: "Stock cannot be negative" });
    }
    if (status && status !== "ACTIVE" && status !== "DRAFT") {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Calculate final price safely (2 decimal places precision)
    const finalPrice = Math.max(
      0,
      Math.round((origPriceNum - (origPriceNum * discPercentNum) / 100) * 100) / 100
    );

    // Update fields
    if (name) product.name = name;
    if (brand !== undefined) product.brand = brand;
    if (category) product.category = category.toLowerCase();
    if (description !== undefined) product.description = description;
    if (status) product.status = status;
    if (offerType) product.offerType = offerType;

    product.originalPrice = origPriceNum;
    product.discountPercent = discPercentNum;
    product.finalPrice = finalPrice;
    product.stock = stockNum;

    // Image handling: combine retained existing images + newly uploaded images
    let retainedImages = [];
    if (req.body.retainedImages !== undefined) {
      if (Array.isArray(req.body.retainedImages)) {
        retainedImages = req.body.retainedImages;
      } else if (typeof req.body.retainedImages === "string") {
        try {
          retainedImages = JSON.parse(req.body.retainedImages);
        } catch {
          retainedImages = [req.body.retainedImages];
        }
      }
    } else if (!req.files || req.files.length === 0) {
      retainedImages = product.images || [];
    }

    const newUploadedUrls = req.files ? req.files.map((file) => file.path) : [];
    const finalImages = [...retainedImages, ...newUploadedUrls];

    if (finalImages.length === 0) {
      return res.status(400).json({ message: "At least one image is required" });
    }
    if (finalImages.length > 5) {
      return res.status(400).json({ message: "Maximum 5 images allowed" });
    }

    // Capture old images before updating product document
    const oldImageUrls = [...(product.images || []), product.image].filter(Boolean);

    product.images = finalImages;
    product.image = finalImages[0];

    await product.save();

    // Compute removed image URLs for cleanup
    const removedUrls = oldImageUrls.filter((url) => !finalImages.includes(url));
    if (removedUrls.length > 0) {
      getSafeCleanupCandidates(removedUrls, product._id)
        .then(({ candidates, skippedReferenced, skippedInvalid }) => {
          return executeCloudinaryCleanup(candidates, { skippedReferenced, skippedInvalid });
        })
        .catch((err) => {
          console.error("[Cloudinary Edit Cleanup Non-Blocking Error]:", err);
        });
    }

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Product update failed" });
  }
};

// GET offer summary counts
export const getOfferSummary = async (req, res) => {
  try {
    const matchStage = req.user?.isAdmin
      ? { status: { $in: ["ACTIVE", "DRAFT"] } }
      : { status: "ACTIVE" };

    const summary = await Product.aggregate([
      { $match: matchStage },
      { $group: { _id: "$offerType", count: { $sum: 1 } } }
    ]);

    const counts = {
      ALL: 0,
      MEGA_FLASH_SALE: 0,
      BUY_1_GET_1: 0,
      DAILY_SPECIAL: 0,
      NONE: 0,
    };

    summary.forEach(({ _id, count }) => {
      if (_id && counts[_id] !== undefined) {
        counts[_id] = count;
      }
      if (_id !== "NONE") {
        counts.ALL += count;
      }
    });

    res.json(counts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH bulk update offer
export const bulkUpdateOffer = async (req, res) => {
  try {
    const { productIds, offerType } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "productIds must be a non-empty array" });
    }

    if (productIds.length > 200) {
      return res.status(400).json({ message: "Batch limit is 200 products" });
    }

    const ALLOWED_OFFERS = ["NONE", "MEGA_FLASH_SALE", "BUY_1_GET_1", "DAILY_SPECIAL"];
    if (!ALLOWED_OFFERS.includes(offerType)) {
      return res.status(400).json({ message: "Invalid offerType" });
    }

    const validIds = productIds.every((id) => mongoose.Types.ObjectId.isValid(id));
    if (!validIds) {
      return res.status(400).json({ message: "One or more product IDs are invalid" });
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { offerType } }
    );

    res.json({
      message: "Products updated successfully",
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE product
export const deleteProduct = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid Product ID format" });
    }

    // 1. Fetch the product
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 2. Order Reference Check (C5.5) - Block deletion if product has order history
    const hasOrderHistory = await Order.exists({ "items.productId": product._id });
    if (hasOrderHistory) {
      return res.status(400).json({
        message: "This product has order history and cannot be deleted. Change its status to Draft instead.",
      });
    }

    // 3. Collect, validate, and compute safe cleanup candidates BEFORE deleting MongoDB product
    const oldUrls = [...(product.images || []), product.image].filter(Boolean);
    const { candidates, skippedReferenced, skippedInvalid } = await getSafeCleanupCandidates(oldUrls, product._id);

    // 4. Delete the MongoDB product document
    await Product.findByIdAndDelete(req.params.id);

    // 5. Attempt Cloudinary cleanup for precomputed candidates & log failure without rolling back DB deletion
    executeCloudinaryCleanup(candidates, { skippedReferenced, skippedInvalid }).catch((err) => {
      console.error("[Cloudinary Delete Cleanup Non-Blocking Error]:", err);
    });

    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
