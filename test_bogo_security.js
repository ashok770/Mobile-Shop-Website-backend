import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Product from "./models/Product.js";
import Order from "./models/Order.js";
import { createOrder, updateOrderStatus } from "./controllers/orderController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

async function runBogoTests() {
  console.log("==================================================");
  console.log(" BOGO V2 Phase 1 — Security & Logic Tests");
  console.log("==================================================\n");

  await mongoose.connect(process.env.MONGO_URI);

  const testReport = [];
  let testCount = 0;
  let passedCount = 0;

  const mockRes = () => {
    let res = {};
    res.statusCode = 200;
    res.jsonData = null;
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.jsonData = data;
      return res;
    };
    return res;
  };

  const addResult = (name, passed, details) => {
    testCount++;
    if (passed) passedCount++;
    testReport.push({ name, passed, details });
  };

  try {
    // We need a dummy user ID for order creation
    const dummyUserId = new mongoose.Types.ObjectId();

    // 1. Setup Test Products
    const bogoProduct = await Product.create({
      name: "Test BOGO Product",
      brand: "Samsung",
      category: "mobile",
      originalPrice: 1000,
      finalPrice: 1000,
      discountPercent: 0,
      stock: 100,
      status: "ACTIVE",
      offerType: "BUY_1_GET_1",
      description: "Test",
      images: ["test.jpg"]
    });

    const normalProduct = await Product.create({
      name: "Test Normal Product",
      brand: "Samsung",
      category: "mobile",
      originalPrice: 1000,
      finalPrice: 1000,
      discountPercent: 0,
      stock: 100,
      status: "ACTIVE",
      offerType: "NONE",
      description: "Test",
      images: ["test.jpg"]
    });
    
    const outOfStockProduct = await Product.create({
      name: "Test Out Of Stock Product",
      brand: "Samsung",
      category: "mobile",
      originalPrice: 1000,
      finalPrice: 1000,
      discountPercent: 0,
      stock: 1, // Only 1 left, but BOGO requires 2 physical!
      status: "ACTIVE",
      offerType: "BUY_1_GET_1",
      description: "Test",
      images: ["test.jpg"]
    });
    
    const megaFlashProduct = await Product.create({
      name: "Test Flash Product",
      brand: "Samsung",
      category: "mobile",
      originalPrice: 1000,
      finalPrice: 1000,
      discountPercent: 0,
      stock: 100,
      status: "ACTIVE",
      offerType: "MEGA_FLASH_SALE",
      description: "Test",
      images: ["test.jpg"]
    });
    
    const dailySpecialProduct = await Product.create({
      name: "Test Daily Product",
      brand: "Samsung",
      category: "mobile",
      originalPrice: 1000,
      finalPrice: 1000,
      discountPercent: 0,
      stock: 100,
      status: "ACTIVE",
      offerType: "DAILY_SPECIAL",
      description: "Test",
      images: ["test.jpg"]
    });

    // TEST 1: BOGO qty 1 -> paid=1, free=1, physical=2
    let req = { body: { customerName: "Test", phone: "123", address: "test", items: [{ productId: bogoProduct._id, quantity: 1 }] }, user: { _id: dummyUserId } };
    let res = mockRes();
    await createOrder(req, res);
    let order = res.jsonData?.order;
    addResult("1. BOGO qty 1", 
      res.statusCode === 201 && order?.items[0]?.metadata?.paidQuantity === 1 && order?.items[0]?.metadata?.freeQuantity === 1 && order?.items[0]?.quantity === 2, 
      `Status: ${res.statusCode}, Paid: ${order?.items[0]?.metadata?.paidQuantity}, Free: ${order?.items[0]?.metadata?.freeQuantity}, Physical: ${order?.items[0]?.quantity}`);
    const bogoOrderId = order?._id;

    // TEST 2: BOGO qty 2 -> paid=2, free=2, physical=4
    req = { body: { customerName: "Test", phone: "123", address: "test", items: [{ productId: bogoProduct._id, quantity: 2 }] }, user: { _id: dummyUserId } };
    res = mockRes();
    await createOrder(req, res);
    order = res.jsonData?.order;
    addResult("2. BOGO qty 2", 
      res.statusCode === 201 && order?.items[0]?.metadata?.paidQuantity === 2 && order?.items[0]?.metadata?.freeQuantity === 2 && order?.items[0]?.quantity === 4, 
      `Status: ${res.statusCode}, Paid: ${order?.items[0]?.metadata?.paidQuantity}, Free: ${order?.items[0]?.metadata?.freeQuantity}, Physical: ${order?.items[0]?.quantity}`);

    // TEST 3: insufficient stock -> 400
    req = { body: { customerName: "Test", phone: "123", address: "test", items: [{ productId: outOfStockProduct._id, quantity: 1 }] }, user: { _id: dummyUserId } };
    res = mockRes();
    await createOrder(req, res);
    addResult("3. insufficient stock", 
      res.statusCode === 400, 
      `Status: ${res.statusCode} (${res.jsonData?.message})`);

    // TEST 4: client price=0 -> server uses product.finalPrice
    req = { body: { customerName: "Test", phone: "123", address: "test", items: [{ productId: bogoProduct._id, quantity: 1, price: 0 }] }, user: { _id: dummyUserId } };
    res = mockRes();
    await createOrder(req, res);
    order = res.jsonData?.order;
    addResult("4. client price=0", 
      res.statusCode === 201 && order?.items[0]?.price === bogoProduct.finalPrice, 
      `Status: ${res.statusCode}, Price used: ${order?.items[0]?.price}`);

    // TEST 5: client freeQuantity=100 -> ignored
    req = { body: { customerName: "Test", phone: "123", address: "test", items: [{ productId: bogoProduct._id, quantity: 1, metadata: { freeQuantity: 100 } }] }, user: { _id: dummyUserId } };
    res = mockRes();
    await createOrder(req, res);
    order = res.jsonData?.order;
    addResult("5. client freeQuantity=100", 
      res.statusCode === 201 && order?.items[0]?.metadata?.freeQuantity === 1, 
      `Status: ${res.statusCode}, Free used: ${order?.items[0]?.metadata?.freeQuantity}`);

    // TEST 6: client isFreeGift=true -> ignored
    req = { body: { customerName: "Test", phone: "123", address: "test", items: [{ productId: bogoProduct._id, quantity: 1, isFreeGift: true }] }, user: { _id: dummyUserId } };
    res = mockRes();
    await createOrder(req, res);
    order = res.jsonData?.order;
    addResult("6. client isFreeGift=true", 
      res.statusCode === 201 && order?.items[0]?.metadata?.freeQuantity === 1, 
      `Status: ${res.statusCode}, Free used: ${order?.items[0]?.metadata?.freeQuantity}`);

    // TEST 7: client offerType=BUY_1_GET_1 on NONE product -> ignored
    req = { body: { customerName: "Test", phone: "123", address: "test", items: [{ productId: normalProduct._id, quantity: 1, offerType: "BUY_1_GET_1" }] }, user: { _id: dummyUserId } };
    res = mockRes();
    await createOrder(req, res);
    order = res.jsonData?.order;
    addResult("7. client offerType=BUY_1_GET_1 on NONE product", 
      res.statusCode === 201 && order?.items[0]?.metadata?.offerType === "NONE" && order?.items[0]?.metadata?.freeQuantity === 0, 
      `Status: ${res.statusCode}, OfferType used: ${order?.items[0]?.metadata?.offerType}, Free: ${order?.items[0]?.metadata?.freeQuantity}`);

    // TEST 8: zero quantity -> 400
    req = { body: { customerName: "Test", phone: "123", address: "test", items: [{ productId: bogoProduct._id, quantity: 0 }] }, user: { _id: dummyUserId } };
    res = mockRes();
    await createOrder(req, res);
    addResult("8. zero quantity", 
      res.statusCode === 400, 
      `Status: ${res.statusCode} (${res.jsonData?.message})`);

    // TEST 9: negative quantity -> 400
    req = { body: { customerName: "Test", phone: "123", address: "test", items: [{ productId: bogoProduct._id, quantity: -1 }] }, user: { _id: dummyUserId } };
    res = mockRes();
    await createOrder(req, res);
    addResult("9. negative quantity", 
      res.statusCode === 400, 
      `Status: ${res.statusCode} (${res.jsonData?.message})`);

    // TEST 10: decimal quantity -> 400
    req = { body: { customerName: "Test", phone: "123", address: "test", items: [{ productId: bogoProduct._id, quantity: 1.5 }] }, user: { _id: dummyUserId } };
    res = mockRes();
    await createOrder(req, res);
    addResult("10. decimal quantity", 
      res.statusCode === 400, 
      `Status: ${res.statusCode} (${res.jsonData?.message})`);

    // TEST 11: NONE -> normal behavior
    req = { body: { customerName: "Test", phone: "123", address: "test", items: [{ productId: normalProduct._id, quantity: 2 }] }, user: { _id: dummyUserId } };
    res = mockRes();
    await createOrder(req, res);
    order = res.jsonData?.order;
    addResult("11. NONE", 
      res.statusCode === 201 && order?.items[0]?.metadata?.freeQuantity === 0 && order?.items[0]?.quantity === 2 && order?.items[0]?.metadata?.paidQuantity === 2, 
      `Status: ${res.statusCode}, Paid: ${order?.items[0]?.metadata?.paidQuantity}, Free: ${order?.items[0]?.metadata?.freeQuantity}, Physical: ${order?.items[0]?.quantity}`);

    // TEST 12: MEGA_FLASH_SALE -> normal behavior
    req = { body: { customerName: "Test", phone: "123", address: "test", items: [{ productId: megaFlashProduct._id, quantity: 2 }] }, user: { _id: dummyUserId } };
    res = mockRes();
    await createOrder(req, res);
    order = res.jsonData?.order;
    addResult("12. MEGA_FLASH_SALE", 
      res.statusCode === 201 && order?.items[0]?.metadata?.freeQuantity === 0 && order?.items[0]?.quantity === 2 && order?.items[0]?.metadata?.paidQuantity === 2, 
      `Status: ${res.statusCode}, Paid: ${order?.items[0]?.metadata?.paidQuantity}, Free: ${order?.items[0]?.metadata?.freeQuantity}, Physical: ${order?.items[0]?.quantity}`);

    // TEST 13: DAILY_SPECIAL -> normal behavior
    req = { body: { customerName: "Test", phone: "123", address: "test", items: [{ productId: dailySpecialProduct._id, quantity: 2 }] }, user: { _id: dummyUserId } };
    res = mockRes();
    await createOrder(req, res);
    order = res.jsonData?.order;
    addResult("13. DAILY_SPECIAL", 
      res.statusCode === 201 && order?.items[0]?.metadata?.freeQuantity === 0 && order?.items[0]?.quantity === 2 && order?.items[0]?.metadata?.paidQuantity === 2, 
      `Status: ${res.statusCode}, Paid: ${order?.items[0]?.metadata?.paidQuantity}, Free: ${order?.items[0]?.metadata?.freeQuantity}, Physical: ${order?.items[0]?.quantity}`);

    // TEST 14: cancellation restores physical quantity
    // The order from TEST 1 had quantity 1 (so physical = 2)
    // Product stock was 100 initially, then 98 after test 1, 94 after test 2, 92 after test 4, 90 after test 5, 88 after test 6.
    const productBeforeCancel = await Product.findById(bogoProduct._id);
    req = { params: { id: bogoOrderId.toString() }, body: { orderStatus: "Cancelled" } };
    res = mockRes();
    await updateOrderStatus(req, res);
    const productAfterCancel = await Product.findById(bogoProduct._id);
    addResult("14. cancellation restores physical quantity", 
      res.statusCode === 200 && productAfterCancel.stock === productBeforeCancel.stock + 2, 
      `Status: ${res.statusCode}, Stock Before: ${productBeforeCancel.stock}, Stock After: ${productAfterCancel.stock} (Expected +2)`);

    // Cleanup: delete the products and orders created for this test
    await Product.deleteMany({ _id: { $in: [bogoProduct._id, normalProduct._id, outOfStockProduct._id, megaFlashProduct._id, dailySpecialProduct._id] } });
    await Order.deleteMany({ user: dummyUserId });

  } catch (error) {
    console.error("Test execution error:", error);
  } finally {
    console.log("=== BOGO SECURITY TEST RESULTS ===");
    testReport.forEach((r) => {
      console.log(`[${r.passed ? "✅ PASSED" : "❌ FAILED"}] ${r.name}`);
      console.log(`    Details: ${r.details}`);
    });
    console.log(`\n==================================================`);
    console.log(` TOTAL: ${testCount} | PASSED: ${passedCount} | FAILED: ${testCount - passedCount}`);
    console.log(`==================================================\n`);
    await mongoose.disconnect();
  }
}

runBogoTests();
