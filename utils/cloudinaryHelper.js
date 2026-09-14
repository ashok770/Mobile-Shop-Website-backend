import cloudinary from "../config/cloudinary.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";

/**
 * Extracts Cloudinary Public ID from a full image URL.
 * Only returns a public ID if the URL strictly belongs to our application folder ("mobile-shop/products/").
 * Handles versioned URLs (e.g. /v1769060372/), extensions (.png, .jpg, .webp), and query params.
 */
export const extractPublicId = (url) => {
  if (!url || typeof url !== "string") return null;

  if (!url.includes("/mobile-shop/products/")) return null;

  try {
    const uploadIndex = url.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    let path = url.substring(uploadIndex + 8); // e.g. "v1769060372/mobile-shop/products/co5za4q5q0ynm38xnlty.png"

    // Remove query parameters if present
    path = path.split("?")[0];

    // Remove version prefix (e.g., v123456789/)
    path = path.replace(/^v\d+\//, "");

    // Remove extension (.png, .jpg, .jpeg, .webp, etc.)
    const dotIndex = path.lastIndexOf(".");
    if (dotIndex !== -1) {
      path = path.substring(0, dotIndex);
    }

    if (!path.startsWith("mobile-shop/products/")) return null;

    return path;
  } catch {
    return null;
  }
};

/**
 * Determines which image URLs are safe for Cloudinary cleanup by checking:
 * 1. Valid Cloudinary public ID in mobile-shop/products/
 * 2. Not referenced in any other product (excluding currentProductId if provided)
 * 3. Not referenced in any historical Order document
 *
 * Returns precomputed candidate public IDs and skipped audit logs.
 */
export const getSafeCleanupCandidates = async (imageUrls, currentProductId = null) => {
  const result = {
    candidates: [],
    skippedReferenced: [],
    skippedInvalid: [],
  };

  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return result;
  }

  const uniqueUrls = [...new Set(imageUrls.filter(Boolean))];

  for (const url of uniqueUrls) {
    const publicId = extractPublicId(url);
    if (!publicId) {
      result.skippedInvalid.push(url);
      continue;
    }

    // Reference Check 1: Other Products
    const productQuery = {
      $or: [{ image: url }, { images: url }],
    };
    if (currentProductId) {
      productQuery._id = { $ne: currentProductId };
    }

    const isReferencedInProduct = await Product.exists(productQuery);
    if (isReferencedInProduct) {
      result.skippedReferenced.push({ publicId, url, reason: "Referenced in product" });
      continue;
    }

    // Reference Check 2: Orders
    const isReferencedInOrder = await Order.exists({ "items.image": url });
    if (isReferencedInOrder) {
      result.skippedReferenced.push({ publicId, url, reason: "Referenced in order" });
      continue;
    }

    result.candidates.push({ publicId, url });
  }

  return result;
};

/**
 * Executes Cloudinary cleanup for candidate public IDs.
 * Returns a structured internal result:
 * {
 *   destroyed: [],
 *   skippedReferenced: [],
 *   skippedInvalid: [],
 *   notFound: [],
 *   failed: []
 * }
 */
export const executeCloudinaryCleanup = async (precomputedCandidates, initialSkipped = {}) => {
  const summary = {
    destroyed: [],
    skippedReferenced: initialSkipped.skippedReferenced || [],
    skippedInvalid: initialSkipped.skippedInvalid || [],
    notFound: [],
    failed: [],
  };

  const candidates = Array.isArray(precomputedCandidates) ? precomputedCandidates : [];

  for (const item of candidates) {
    const publicId = typeof item === "string" ? item : item.publicId;
    if (!publicId) continue;

    try {
      const res = await cloudinary.uploader.destroy(publicId);
      if (res.result === "ok") {
        summary.destroyed.push(publicId);
      } else if (res.result === "not found") {
        summary.notFound.push(publicId);
      } else {
        summary.failed.push({ publicId, error: res.result });
      }
    } catch (err) {
      summary.failed.push({ publicId, error: err.message });
    }
  }

  console.log("[Cloudinary Cleanup Summary]", JSON.stringify(summary, null, 2));
  return summary;
};
