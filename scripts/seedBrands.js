import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Brand from "../models/Brand.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import cloudinary from "../config/cloudinary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const CANONICAL_BRANDS = [
  {
    name: "Apple",
    slug: "apple",
    displayOrder: 1,
    assetFile: "apple.png",
  },
  {
    name: "Samsung",
    slug: "samsung",
    displayOrder: 2,
    assetFile: "samsung.png",
  },
  {
    name: "Redmi",
    slug: "redmi",
    displayOrder: 3,
    assetFile: "redmi.png",
  },
  {
    name: "Motorola",
    slug: "motorola",
    displayOrder: 4,
    assetFile: "motorola.png",
  },
  {
    name: "Noise",
    slug: "noise",
    displayOrder: 5,
    assetFile: "noise.png",
  },
  {
    name: "Boult",
    slug: "boult",
    displayOrder: 6,
    assetFile: null, // No verified local asset exists for Boult; do not fabricate
  },
];

async function seedBrands() {
  console.log("==================================================");
  console.log(" Brands Management Phase BR2 — Seed & Data Foundation");
  console.log("==================================================\n");

  if (!process.env.MONGO_URI) {
    console.error("ERROR: MONGO_URI is missing in .env environment file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB successfully.");

    // 1. Pre-migration Data Integrity Backup
    console.log("\n[Step 1] Creating pre-seed backup...");
    const preProducts = await Product.find({}).lean();
    const preOrders = await Order.find({}).lean();
    const preBrands = await Brand.find({}).lean();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(__dirname, "../backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFilePath = path.join(backupDir, `pre_br2_backup_${timestamp}.json`);
    fs.writeFileSync(
      backupFilePath,
      JSON.stringify(
        {
          timestamp,
          counts: {
            products: preProducts.length,
            orders: preOrders.length,
            brands: preBrands.length,
          },
          products: preProducts,
          orders: preOrders,
          brands: preBrands,
        },
        null,
        2
      )
    );
    console.log(`Backup saved to: ${backupFilePath}`);
    console.log(`Initial Counts: Products=${preProducts.length}, Orders=${preOrders.length}, Brands=${preBrands.length}`);

    // 2. Ensure Indexes
    console.log("\n[Step 2] Ensuring indexes on Brand and Product collections...");
    await Brand.syncIndexes();
    await Product.syncIndexes();
    console.log("Indexes synchronized.");

    // 3. Seed Canonical Brands Idempotently
    console.log("\n[Step 3] Seeding canonical brands...");
    const assetsDir = path.join(__dirname, "../../mobile-shop-fronted/src/assets/images/brands");

    let createdCount = 0;
    let existingCount = 0;

    for (const item of CANONICAL_BRANDS) {
      const existing = await Brand.findOne({
        $or: [{ name: item.name }, { slug: item.slug }],
      });

      if (existing) {
        console.log(`- Brand '${item.name}' already exists (ID: ${existing._id}). Skipping.`);
        existingCount++;
        continue;
      }

      let logoUrl = "";
      let logoPublicId = "";

      // Upload verified asset to Cloudinary if assetFile is specified and exists
      if (item.assetFile) {
        const fullAssetPath = path.join(assetsDir, item.assetFile);
        if (fs.existsSync(fullAssetPath)) {
          try {
            console.log(`  Uploading asset for '${item.name}' to Cloudinary...`);
            const uploadRes = await cloudinary.uploader.upload(fullAssetPath, {
              folder: "mobile-shop/brands",
              public_id: item.slug,
              overwrite: false,
            });
            logoUrl = uploadRes.secure_url;
            logoPublicId = uploadRes.public_id;
            console.log(`  Uploaded to Cloudinary: ${logoPublicId}`);
          } catch (uploadErr) {
            console.warn(`  Cloudinary upload notice for '${item.name}':`, uploadErr.message);
          }
        }
      }

      const brand = new Brand({
        name: item.name,
        slug: item.slug,
        logo: logoUrl,
        logoPublicId: logoPublicId,
        displayOrder: item.displayOrder,
        status: "ACTIVE",
      });

      await brand.save();
      console.log(`+ Created brand '${item.name}' (ID: ${brand._id}, slug: ${brand.slug}, order: ${brand.displayOrder})`);
      createdCount++;
    }

    console.log(`\nSeeding summary: Created ${createdCount}, Already existed ${existingCount}.`);

    // 4. Post-Seed Verification & Data Integrity
    console.log("\n[Step 4] Verifying data integrity...");
    const postProducts = await Product.find({}).lean();
    const postOrders = await Order.find({}).lean();
    const allBrands = await Brand.find({}).sort({ displayOrder: 1 }).lean();

    console.log(`Post-seed Product count: ${postProducts.length} (Expected: ${preProducts.length})`);
    console.log(`Post-seed Order count: ${postOrders.length} (Expected: ${preOrders.length})`);

    if (postProducts.length !== preProducts.length) {
      throw new Error(`CRITICAL: Product count mismatch! Expected ${preProducts.length}, got ${postProducts.length}`);
    }
    if (postOrders.length !== preOrders.length) {
      throw new Error(`CRITICAL: Order count mismatch! Expected ${preOrders.length}, got ${postOrders.length}`);
    }

    // Verify brand strings on products are completely untouched
    const preBrandCounts = {};
    preProducts.forEach((p) => {
      preBrandCounts[p.brand] = (preBrandCounts[p.brand] || 0) + 1;
    });

    const postBrandCounts = {};
    postProducts.forEach((p) => {
      postBrandCounts[p.brand] = (postBrandCounts[p.brand] || 0) + 1;
    });

    console.log("\nVerifying product.brand values:");
    Object.keys(preBrandCounts).sort().forEach((b) => {
      const match = preBrandCounts[b] === postBrandCounts[b];
      console.log(`  ${b.padEnd(16)} pre: ${preBrandCounts[b]} | post: ${postBrandCounts[b]} [${match ? "OK" : "MISMATCH"}]`);
      if (!match) {
        throw new Error(`Product brand count mismatch for brand '${b}'`);
      }
    });

    console.log("\nCurrent Brands in Brand Collection:");
    allBrands.forEach((b) => {
      console.log(`  [${b.status}] ${b.name.padEnd(12)} (slug: ${b.slug}, order: ${b.displayOrder}, logo: ${b.logo ? "YES" : "NO"})`);
    });

    console.log("\n==================================================");
    console.log(" BR2 SEED COMPLETED SUCCESSFULLY & DATA VERIFIED");
    console.log("==================================================");

    await mongoose.disconnect();
  } catch (error) {
    console.error("ERROR during seed:", error);
    process.exit(1);
  }
}

seedBrands();
