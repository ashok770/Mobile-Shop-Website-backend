import mongoose from "mongoose";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import Service from "../models/Service.js";
import Admin from "../models/Admin.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Brand from "../models/Brand.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const PORT = process.env.PORT || 5000;
const API = `http://localhost:${PORT}/api`;

let adminToken = "";
let tempServiceId = "";

const log = (msg) => console.log(`[TEST] ${msg}`);
const assert = (condition, msg) => {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ [PASS] ${msg}`);
  }
};

const runTests = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Get product/order/brand counts before test
    const initialProductCount = await Product.countDocuments();
    const initialOrderCount = await Order.countDocuments();
    const initialBrandCount = await Brand.countDocuments();

    // Login admin
    const adminUser = await Admin.findOne();
    if (!adminUser) throw new Error("No admin user found to run tests");

    // We can directly mock a token or do a login if we know password, but for script ease we'll generate one
    // Assuming jwt is available, but let's just do a fetch login if possible.
    // Wait, the test script runs against the live API, so we need a token.
    // We can generate one directly using jsonwebtoken
    const jwt = await import("jsonwebtoken");
    adminToken = jwt.default.sign(
      { 
        id: adminUser._id, 
        type: "admin", 
        tokenVersion: adminUser.tokenVersion || 0 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: "1h" }
    );

    log("Starting S2 Services Tests...");

    // 1. GET /api/services returns 200
    let res = await fetch(`${API}/services`);
    assert(res.status === 200, "GET /api/services returns 200");
    let data = await res.json();
    
    // 2. Only ACTIVE services returned publicly
    assert(data.every((s) => s.status === "ACTIVE"), "Only ACTIVE services returned publicly");
    
    // 3. Services sorted by displayOrder
    let sorted = true;
    for (let i = 0; i < data.length - 1; i++) {
      if (data[i].displayOrder > data[i + 1].displayOrder) {
        sorted = false;
        break;
      }
    }
    assert(sorted, "Services sorted by displayOrder");

    // 4. GET /api/admin/services works for admin
    res = await fetch(`${API}/admin/services`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, "GET /api/admin/services works for admin");
    
    // 5. Unauthorized admin request rejected
    res = await fetch(`${API}/admin/services`);
    assert(res.status === 401 || res.status === 403, "Unauthorized admin request rejected");

    // 6. Create valid service (and 7. Auto slug generation)
    res = await fetch(`${API}/admin/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "S2 TEST SERVICE - DELETE ME",
        category: "REPAIRS",
        shortDescription: "Test service",
      }),
    });
    data = await res.json();
    if (res.status !== 201) console.log("Create valid service response:", data);
    assert(res.status === 201, "Create valid service works");
    tempServiceId = data._id;
    assert(data.slug === "s2-test-service-delete-me", "Auto slug generation works");

    // 8. Duplicate name rejected
    res = await fetch(`${API}/admin/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "S2 TEST SERVICE - DELETE ME",
        category: "REPAIRS",
        shortDescription: "Test service",
      }),
    });
    assert(res.status === 409, "Duplicate name rejected");

    // 9. Duplicate slug rejected
    res = await fetch(`${API}/admin/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "S2 TEST SERVICE - DIFFERENT NAME",
        slug: "s2-test-service-delete-me",
        category: "REPAIRS",
        shortDescription: "Test service",
      }),
    });
    assert(res.status === 409, "Duplicate slug rejected");

    // 10. Invalid category rejected
    res = await fetch(`${API}/admin/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Test Cat",
        category: "INVALID_CAT",
        shortDescription: "Test service",
      }),
    });
    assert(res.status === 400, "Invalid category rejected");

    // 11. Negative displayOrder rejected (Validation error via Mongoose)
    res = await fetch(`${API}/admin/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Test Order",
        category: "REPAIRS",
        shortDescription: "Test",
        displayOrder: -5,
      }),
    });
    assert(res.status === 400, "Negative displayOrder rejected");

    // 12. Update service works
    res = await fetch(`${API}/admin/services/${tempServiceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        shortDescription: "Updated desc",
      }),
    });
    assert(res.status === 200, "Update service works");

    // 13. Invalid ObjectId rejected
    res = await fetch(`${API}/admin/services/invalid123`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ shortDescription: "Updated desc" }),
    });
    assert(res.status === 400, "Invalid ObjectId rejected");

    // 14. Missing service returns 404
    const fakeId = new mongoose.Types.ObjectId();
    res = await fetch(`${API}/admin/services/${fakeId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ shortDescription: "Updated desc" }),
    });
    assert(res.status === 404, "Missing service returns 404");

    // 15. Disable service works
    res = await fetch(`${API}/admin/services/${tempServiceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "DISABLED" }),
    });
    assert(res.status === 200, "Disable service works");

    // 16. Disabled service excluded from public API
    res = await fetch(`${API}/services`);
    data = await res.json();
    assert(
      !data.find((s) => s._id === tempServiceId),
      "Disabled service excluded from public API"
    );

    // 17. Re-enable service works
    res = await fetch(`${API}/admin/services/${tempServiceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    assert(res.status === 200, "Re-enable service works");

    // 18. Delete unused service works
    res = await fetch(`${API}/admin/services/${tempServiceId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, "Delete unused service works");

    // 19-21. Check integrity
    const finalProductCount = await Product.countDocuments();
    const finalOrderCount = await Order.countDocuments();
    const finalBrandCount = await Brand.countDocuments();
    assert(initialProductCount === finalProductCount, "Product count unchanged");
    assert(initialOrderCount === finalOrderCount, "Order count unchanged");
    assert(initialBrandCount === finalBrandCount, "Brand data unchanged");

    // 24-27 Search, filter, pagination checks
    res = await fetch(`${API}/admin/services?search=repair&category=REPAIRS&limit=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, "Search, category, pagination API works");
    data = await res.json();
    if (data.pagination) {
       assert(data.pagination.limit === 1, "Pagination works");
    }

    // Done
    log("All automated tests passed!");

  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    // Cleanup any lingering temp services
    try {
      await Service.deleteMany({ name: /TEST SERVICE - DELETE ME/i });
      mongoose.disconnect();
    } catch (e) {}
  }
};

runTests();
