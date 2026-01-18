import Product from "../models/Product.js";

// CREATE product
export const createProduct = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    const product = await Product.create({
      name: req.body.name,
      price: req.body.price,
      category: req.body.category,
      brand: req.body.brand,
      image: req.file ? req.file.path : "",
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error);
    res.status(500).json({ message: "Product creation failed" });
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
    const updates = req.body;
    if (req.file) updates.image = req.file.path;

    const updated = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
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
