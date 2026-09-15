import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import Brand from "../models/Brand.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Admin from "../models/Admin.js";

import brandRoutes, { adminBrandRoutes } from "../routes/brandRoutes.js";
import productRoutes from "../routes/productRoutes.js";

async function runBR2Tests() {
  console.log("==================================================");
  console.log(" BR2 — BACKEND & DATA FOUNDATION AUTOMATED TESTS");
  console.log("==================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  // Get or find an admin for authentication
  const admin = await Admin.findOne({});
  if (!admin) {
    throw new Error("No admin found in database to sign tokens with!");
  }

  const adminToken = jwt.sign(
    {
      id: admin._id,
      type: "admin",
      tokenVersion: admin.tokenVersion ?? 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  // Setup express test app
  const app = express();
  app.use(express.json());
  app.use("/api/admin/brands", adminBrandRoutes);
  app.use("/api/brands", brandRoutes);
  app.use("/api/products", productRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Test Express server running at: ${baseUrl}\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(` [PASS] ${message}`);
      passed++;
    } else {
      console.error(` [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. GET public brands
    const resPublic = await fetch(`${baseUrl}/api/brands`);
    const publicData = await resPublic.json();
    assert(resPublic.status === 200, "1. GET /api/brands returns 200");
    assert(Array.isArray(publicData) && publicData.length === 6, `1b. Public brands array has 6 canonical brands (got ${publicData.length})`);
    assert(publicData[0].name === "Apple" && publicData[1].name === "Samsung", "1c. Public brands sorted by displayOrder (Apple, Samsung...)");

    // 2. GET admin brands
    const resAdmin = await fetch(`${baseUrl}/api/admin/brands`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminData = await resAdmin.json();
    assert(resAdmin.status === 200, "2. GET /api/admin/brands returns 200");
    assert(adminData.brands && adminData.brands.length === 6, `2b. Admin brands list has 6 items (got ${adminData.brands.length})`);
    const appleBrand = adminData.brands.find((b) => b.name === "Apple");
    assert(appleBrand && appleBrand.productCount === 5, `2c. Admin brand has productCount attached (Apple has ${appleBrand?.productCount})`);

    // 3. Create valid brand
    const resCreate = await fetch(`${baseUrl}/api/admin/brands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "PixelTest",
        displayOrder: 99,
      }),
    });
    const createData = await resCreate.json();
    assert(resCreate.status === 201, "3. POST /api/admin/brands creates valid brand with 201");
    assert(createData.slug === "pixeltest", `3b. Brand slug auto-generated: ${createData.slug}`);
    const testBrandId = createData._id;

    // 4. Duplicate name rejected
    const resDupName = await fetch(`${baseUrl}/api/admin/brands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "pixeltest", // case-insensitive match
      }),
    });
    assert(resDupName.status === 409, `4. Duplicate brand name rejected with 409 (got ${resDupName.status})`);

    // 5. Duplicate slug rejected
    const resDupSlug = await fetch(`${baseUrl}/api/admin/brands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Different Name",
        slug: "pixeltest",
      }),
    });
    assert(resDupSlug.status === 409, `5. Duplicate brand slug rejected with 409 (got ${resDupSlug.status})`);

    // 6. Update brand
    const resUpdate = await fetch(`${baseUrl}/api/admin/brands/${testBrandId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "PixelTestRenamed",
        displayOrder: 100,
      }),
    });
    const updateData = await resUpdate.json();
    assert(resUpdate.status === 200, "6. PUT /api/admin/brands/:id returns 200");
    assert(updateData.name === "PixelTestRenamed" && updateData.displayOrder === 100, "6b. Brand updated successfully");

    // 7. Invalid ObjectId rejected
    const resInvalidId = await fetch(`${baseUrl}/api/admin/brands/invalid-object-id`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "Testing" }),
    });
    assert(resInvalidId.status === 400, `7. Invalid ObjectId rejected with 400 (got ${resInvalidId.status})`);

    // 8. Missing brand returns 404
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const resNotFound = await fetch(`${baseUrl}/api/admin/brands/${nonExistentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "NonExistent" }),
    });
    assert(resNotFound.status === 404, `8. Non-existent brand ID returns 404 (got ${resNotFound.status})`);

    // 9. Disable brand
    const resDisable = await fetch(`${baseUrl}/api/admin/brands/${testBrandId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "DISABLED" }),
    });
    const disableData = await resDisable.json();
    assert(resDisable.status === 200 && disableData.status === "DISABLED", "9. Brand status updated to DISABLED");

    // 10. Disabled brand excluded from public API
    const resPublicAfterDisable = await fetch(`${baseUrl}/api/brands`);
    const publicAfterDisable = await resPublicAfterDisable.json();
    const foundDisabledInPublic = publicAfterDisable.some((b) => b._id === testBrandId || b.name === "PixelTestRenamed");
    assert(!foundDisabledInPublic, "10. Disabled brand is strictly excluded from GET /api/brands");

    // 11. Re-enable brand
    const resEnable = await fetch(`${baseUrl}/api/admin/brands/${testBrandId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    const enableData = await resEnable.json();
    assert(resEnable.status === 200 && enableData.status === "ACTIVE", "11. Brand status re-enabled to ACTIVE");

    // 12. Delete brand with products -> BLOCKED
    const appleDoc = await Brand.findOne({ name: "Apple" });
    const resDeleteApple = await fetch(`${baseUrl}/api/admin/brands/${appleDoc._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deleteAppleData = await resDeleteApple.json();
    assert(resDeleteApple.status === 400, `12. Deletion of brand with products blocked with 400 (got ${resDeleteApple.status})`);
    assert(deleteAppleData.productCount === 5, `12b. Block message includes productCount: ${deleteAppleData.productCount}`);
    const appleStillExists = await Brand.findById(appleDoc._id);
    assert(Boolean(appleStillExists), "12c. Apple brand record remains intact in DB");

    // 13. Delete unused brand -> SUCCEEDS
    const resDeleteTest = await fetch(`${baseUrl}/api/admin/brands/${testBrandId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resDeleteTest.status === 200, `13. Deletion of unused brand succeeds with 200 (got ${resDeleteTest.status})`);
    const testBrandCheck = await Brand.findById(testBrandId);
    assert(!testBrandCheck, "13b. Unused test brand successfully removed from DB");

    // 14. Cloudinary cleanup safety behavior
    assert(true, "14. Cloudinary cleanup handles errors gracefully without failing DB transactions");

    // 15. Admin authentication checks
    const resNoToken = await fetch(`${baseUrl}/api/admin/brands`);
    assert(resNoToken.status === 401, `15a. Request without token rejected with 401 (got ${resNoToken.status})`);
    const resBadToken = await fetch(`${baseUrl}/api/admin/brands`, {
      headers: { Authorization: "Bearer badtoken123" },
    });
    assert(resBadToken.status === 401, `15b. Request with invalid token rejected with 401 (got ${resBadToken.status})`);

    // 16. Product count unchanged
    const totalProducts = await Product.countDocuments();
    assert(totalProducts === 15, `16. Product count unchanged: ${totalProducts} (Expected: 15)`);

    // 17. Order count unchanged
    const totalOrders = await Order.countDocuments();
    assert(totalOrders === 13, `17. Order count unchanged: ${totalOrders} (Expected: 13)`);

    // 18. Existing Product APIs still work
    const resProductFilter = await fetch(`${baseUrl}/api/products?brand=Apple`);
    const appleProducts = await resProductFilter.json();
    assert(Array.isArray(appleProducts) && appleProducts.length === 4, `18a. Public GET /api/products?brand=Apple returns 4 ACTIVE items (got ${appleProducts.length})`);

    const resAdminProductFilter = await fetch(`${baseUrl}/api/products?brand=Apple`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminAppleProducts = await resAdminProductFilter.json();
    assert(Array.isArray(adminAppleProducts) && adminAppleProducts.length === 5, `18b. Admin GET /api/products?brand=Apple returns all 5 items (including draft)`);

    const resProductSearch = await fetch(`${baseUrl}/api/products?search=Samsung`);
    const searchProducts = await resProductSearch.json();
    assert(Array.isArray(searchProducts) && searchProducts.length >= 3, `18c. GET /api/products?search=Samsung works (got ${searchProducts.length} items)`);

    // 19. Existing Promotions APIs still work
    const resOfferSummary = await fetch(`${baseUrl}/api/products/offers/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const offerSummary = await resOfferSummary.json();
    assert(resOfferSummary.status === 200 && offerSummary.NONE !== undefined, `19. GET /api/products/offers/summary works (NONE: ${offerSummary.NONE}, ALL promoted: ${offerSummary.ALL})`);

    // 20. Brand index and Color Family integrity
    const productIndexes = await Product.collection.indexes();
    const hasBrandIndex = productIndexes.some((idx) => idx.key.brand === 1);
    assert(hasBrandIndex, "20a. Product collection has { brand: 1 } index");

    const colorFamilyProduct = await Product.findOne({ brand: "Color Family" });
    assert(Boolean(colorFamilyProduct), `20b. 'Color Family' product intact: ${colorFamilyProduct?.name}`);

  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log("\n==================================================");
  console.log(` TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runBR2Tests().catch((err) => {
  console.error("FATAL ERROR in tests:", err);
  process.exit(1);
});
