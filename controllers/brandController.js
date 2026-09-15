import mongoose from "mongoose";
import Brand from "../models/Brand.js";
import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";

/**
 * Generate a clean, URL-safe slug from a brand name.
 */
export const generateSlug = (name) => {
  if (!name || typeof name !== "string") return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/**
 * GET /api/brands
 * Public endpoint: Returns ACTIVE brands only, sorted by displayOrder ascending then name ascending.
 */
export const getPublicBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ status: "ACTIVE" })
      .sort({ displayOrder: 1, name: 1 })
      .select("_id name slug logo displayOrder status");

    res.json(brands);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/admin/brands
 * Admin endpoint: Returns brands with optional search, status filtering, pagination, and product counts.
 */
export const getAdminBrands = async (req, res) => {
  try {
    const { search, status, page, limit } = req.query;

    const filter = {};

    // Optional search by name
    const searchVal = Array.isArray(search) ? search[0] : search;
    if (typeof searchVal === "string" && searchVal.trim().length > 0) {
      const trimmed = searchVal.trim().slice(0, 100);
      const sanitized = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (sanitized.length > 0) {
        filter.name = { $regex: sanitized, $options: "i" };
      }
    }

    // Optional status filter
    const statusVal = Array.isArray(status) ? status[0] : status;
    if (statusVal && statusVal !== "ALL") {
      if (statusVal === "ACTIVE" || statusVal === "DISABLED") {
        filter.status = statusVal;
      }
    }

    // Compute live product counts per brand
    const productCounts = await Product.aggregate([
      { $group: { _id: "$brand", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    productCounts.forEach((pc) => {
      if (pc._id) {
        countMap[pc._id] = pc.count;
      }
    });

    // Pagination
    const pageRaw = parseInt(Array.isArray(page) ? page[0] : page, 10);
    const limitRaw = parseInt(Array.isArray(limit) ? limit[0] : limit, 10);

    const pageNum = isNaN(pageRaw) || pageRaw <= 0 ? 1 : pageRaw;
    const limitNum = isNaN(limitRaw) || limitRaw <= 0 ? 50 : Math.min(100, limitRaw);

    const total = await Brand.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum) || 1;

    const brands = await Brand.find(filter)
      .sort({ displayOrder: 1, name: 1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select("_id name slug logo logoPublicId displayOrder status createdAt updatedAt");

    const enrichedBrands = brands.map((b) => {
      const obj = b.toObject();
      obj.productCount = countMap[b.name] || 0;
      return obj;
    });

    res.json({
      brands: enrichedBrands,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/admin/brands
 * Admin endpoint: Create a new brand with validation and duplicate protection.
 */
export const createBrand = async (req, res) => {
  try {
    const { name, slug, logo, logoPublicId, displayOrder, status } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Brand name is required" });
    }

    const trimmedName = name.trim();

    // Check duplicate name (case-insensitive)
    const existingName = await Brand.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });
    if (existingName) {
      return res.status(409).json({ message: "A brand with this name already exists" });
    }

    // Determine slug
    let finalSlug = "";
    if (slug && typeof slug === "string" && slug.trim().length > 0) {
      finalSlug = generateSlug(slug);
    } else {
      finalSlug = generateSlug(trimmedName);
    }

    if (!finalSlug) {
      return res.status(400).json({ message: "Valid slug could not be generated" });
    }

    // Check duplicate slug
    const existingSlug = await Brand.findOne({ slug: finalSlug });
    if (existingSlug) {
      return res.status(409).json({ message: "A brand with this slug already exists" });
    }

    // Validate displayOrder
    let orderNum = 0;
    if (displayOrder !== undefined && displayOrder !== null && displayOrder !== "") {
      orderNum = Number(displayOrder);
      if (isNaN(orderNum) || orderNum < 0) {
        return res.status(400).json({ message: "Display order must be a non-negative number" });
      }
    }

    // Validate status
    let finalStatus = "ACTIVE";
    if (status !== undefined && status !== null && status !== "") {
      if (status !== "ACTIVE" && status !== "DISABLED") {
        return res.status(400).json({ message: "Status must be either ACTIVE or DISABLED" });
      }
      finalStatus = status;
    }

    // Handle logo from file upload or body
    let finalLogo = "";
    let finalLogoPublicId = "";

    if (req.file) {
      finalLogo = req.file.path;
      finalLogoPublicId = req.file.filename;
    } else {
      if (typeof logo === "string") finalLogo = logo.trim();
      if (typeof logoPublicId === "string") finalLogoPublicId = logoPublicId.trim();
    }

    const brand = new Brand({
      name: trimmedName,
      slug: finalSlug,
      logo: finalLogo,
      logoPublicId: finalLogoPublicId,
      displayOrder: orderNum,
      status: finalStatus,
    });

    await brand.save();

    res.status(201).json(brand);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Duplicate key conflict: brand name or slug already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/admin/brands/:id
 * Admin endpoint: Update brand details, logo, order, or status.
 */
export const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Brand ID format" });
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    const { name, slug, logo, logoPublicId, displayOrder, status } = req.body;

    // Name update
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Brand name cannot be empty" });
      }
      const trimmedName = name.trim();
      const existingName = await Brand.findOne({
        _id: { $ne: brand._id },
        name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });
      if (existingName) {
        return res.status(409).json({ message: "Another brand with this name already exists" });
      }
      brand.name = trimmedName;
    }

    // Slug update
    if (slug !== undefined) {
      if (typeof slug !== "string" || slug.trim().length === 0) {
        return res.status(400).json({ message: "Brand slug cannot be empty" });
      }
      const finalSlug = generateSlug(slug);
      if (!finalSlug) {
        return res.status(400).json({ message: "Valid slug could not be generated" });
      }
      const existingSlug = await Brand.findOne({
        _id: { $ne: brand._id },
        slug: finalSlug,
      });
      if (existingSlug) {
        return res.status(409).json({ message: "Another brand with this slug already exists" });
      }
      brand.slug = finalSlug;
    }

    // Display order update
    if (displayOrder !== undefined && displayOrder !== null && displayOrder !== "") {
      const orderNum = Number(displayOrder);
      if (isNaN(orderNum) || orderNum < 0) {
        return res.status(400).json({ message: "Display order must be a non-negative number" });
      }
      brand.displayOrder = orderNum;
    }

    // Status update
    if (status !== undefined && status !== null && status !== "") {
      if (status !== "ACTIVE" && status !== "DISABLED") {
        return res.status(400).json({ message: "Status must be either ACTIVE or DISABLED" });
      }
      brand.status = status;
    }

    // Logo update
    if (req.file) {
      // Clean up previous logo asset if it belonged to our folder
      if (brand.logoPublicId && brand.logoPublicId.startsWith("mobile-shop/brands/")) {
        try {
          await cloudinary.uploader.destroy(brand.logoPublicId);
        } catch (cleanupErr) {
          console.warn("[Cloudinary Cleanup Warning]", cleanupErr.message);
        }
      }
      brand.logo = req.file.path;
      brand.logoPublicId = req.file.filename;
    } else {
      if (logo !== undefined) brand.logo = typeof logo === "string" ? logo.trim() : "";
      if (logoPublicId !== undefined) brand.logoPublicId = typeof logoPublicId === "string" ? logoPublicId.trim() : "";
    }

    await brand.save();

    res.json(brand);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Duplicate key conflict: brand name or slug already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE /api/admin/brands/:id
 * Admin endpoint: Delete brand with strict product reference protection.
 */
export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Brand ID format" });
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    // Strict safety check: reject if any products reference this brand name
    const productCount = await Product.countDocuments({ brand: brand.name });
    if (productCount > 0) {
      return res.status(400).json({
        message: `Cannot delete brand '${brand.name}' because ${productCount} product(s) are associated with it. Please reassign or delete these products first, or set brand status to DISABLED.`,
        productCount,
      });
    }

    // Safe to delete
    await Brand.findByIdAndDelete(brand._id);

    // Clean up Cloudinary asset if safe and belonging to brand folder
    if (brand.logoPublicId && brand.logoPublicId.startsWith("mobile-shop/brands/")) {
      try {
        await cloudinary.uploader.destroy(brand.logoPublicId);
      } catch (cleanupErr) {
        console.warn("[Cloudinary Cleanup Warning]", cleanupErr.message);
      }
    }

    res.json({
      message: `Brand '${brand.name}' deleted successfully.`,
      deletedId: brand._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
