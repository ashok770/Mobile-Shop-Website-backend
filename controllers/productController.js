import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";
// CREATE product
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      brand,
      category,
      originalPrice,
      discountPercent = 0,
      offerType = "NONE",
    } = req.body;

    if (!name || !category || !originalPrice) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // 🔹 Calculate final price
    const finalPrice =
      originalPrice - (originalPrice * discountPercent) / 100;

    const product = new Product({
      name,
      brand,
      category,
      originalPrice,
      discountPercent,
      finalPrice,
      offerType,
      image: req.file?.path,
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
      originalPrice,
      discountPercent = 0,
      offerType = "NONE",
    } = req.body;

    // Calculate final price
    const finalPrice =
      originalPrice - (originalPrice * discountPercent) / 100;

    // Update fields
    product.name = name || product.name;
    product.brand = brand || product.brand;
    product.category = category || product.category;
    product.originalPrice = originalPrice || product.originalPrice;
    product.discountPercent = discountPercent;
    product.finalPrice = finalPrice;
    product.offerType = offerType;

    if (req.file) {
      product.image = req.file.path;
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
