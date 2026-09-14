import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";
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

    // 🔹 Calculate final price safely
    const finalPrice = Math.max(0, origPriceNum - (origPriceNum * discPercentNum) / 100);

    const product = new Product({
      name,
      brand,
      category,
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
    const { page, limit } = req.query;

    if (page || limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [products, total] = await Promise.all([
        Product.find().sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Product.countDocuments(),
      ]);

      return res.json({
        products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    // Backward compatible standard request
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE product
export const updateProduct = async (req, res) => {
  try {
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

    // Calculate final price safely
    const finalPrice = Math.max(0, origPriceNum - (origPriceNum * discPercentNum) / 100);

    // Update fields
    if (name) product.name = name;
    if (brand !== undefined) product.brand = brand;
    if (category) product.category = category;
    if (description !== undefined) product.description = description;
    if (status) product.status = status;
    if (offerType) product.offerType = offerType;

    product.originalPrice = origPriceNum;
    product.discountPercent = discPercentNum;
    product.finalPrice = finalPrice;
    product.stock = stockNum;

    if (req.files && req.files.length > 0) {
      const imageUrls = req.files.map((file) => file.path);
      product.images = imageUrls;
      product.image = imageUrls[0]; // Keep for backward compatibility
    }

    await product.save();
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Product update failed" });
  }
};

// ✅ DELETE product (THIS WAS MISSING AT RUNTIME)
export const deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
