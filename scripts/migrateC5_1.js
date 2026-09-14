import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { EJSON } from "bson";

// ESM directory helper
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from mobile-shop-backend/.env
dotenv.config({ path: path.join(__dirname, "../.env") });

const BRAND_NORMALIZATION_MAP = {
  noise: "Noise",
  moto: "Motorola",
};

async function runMigration() {
  const args = process.argv.slice(2);
  const isExecute = args.includes("--execute");
  const isDryRun = args.includes("--dry-run") || !isExecute;

  console.log("==================================================");
  console.log(` Product Management Phase C5.1 — Data Migration`);
  console.log(` Mode: ${isExecute ? "EXECUTE (MUTATION ENABLED)" : "DRY-RUN (READ-ONLY)"}`);
  console.log("==================================================\n");

  if (!process.env.MONGO_URI) {
    console.error("ERROR: MONGO_URI is missing in .env environment file.");
    process.exit(1);
  }

  let conn;
  try {
    conn = await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const collection = db.collection("products");

    // Fetch pre-migration products
    const initialProducts = await collection.find({}).toArray();
    const beforeCount = initialProducts.length;

    console.log(`Connected to MongoDB database: ${conn.connection.name}`);
    console.log(`Total initial products found in 'products' collection: ${beforeCount}\n`);

    // --------------------------------------------------
    // 1. PRE-MIGRATION SNAPSHOT & BACKUP (IF EXECUTE)
    // --------------------------------------------------
    const preSnapshotMap = new Map();
    initialProducts.forEach((p) => {
      preSnapshotMap.set(p._id.toString(), {
        _id: p._id.toString(),
        name: p.name,
        originalPrice: p.originalPrice,
        discountPercent: p.discountPercent,
        finalPrice: p.finalPrice,
        stock: p.stock,
        category: p.category,
        image: p.image,
        images: Array.isArray(p.images) ? [...p.images] : p.images,
        status: p.status,
        brand: p.brand,
        createdAt: p.createdAt ? p.createdAt.toISOString() : undefined,
        updatedAt: p.updatedAt ? p.updatedAt.toISOString() : undefined,
      });
    });

    let backupFilePath = null;
    if (isExecute) {
      const backupDir = path.join(__dirname, "../backups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      backupFilePath = path.join(backupDir, `products_backup_${timestamp}.json`);

      // Preserve BSON types using Extended JSON (EJSON)
      const backupData = EJSON.stringify(initialProducts, null, 2);
      fs.writeFileSync(backupFilePath, backupData, "utf8");
      console.log(`✅ Pre-migration BSON-preserving EJSON backup created at:\n   ${backupFilePath}\n`);
    }

    // --------------------------------------------------
    // 2. AUDIT & PLANNED MUTATIONS
    // --------------------------------------------------
    let statusUpdatesCount = 0;
    let imagesBackfilledCount = 0;
    let brandNormalizationsCount = 0;
    let imagesSkippedAlreadyExisted = 0;
    let imagesSkippedNoLegacyImage = 0;

    const brandChangesList = [];
    const productsToReview = [];
    const plannedMutations = [];

    for (const p of initialProducts) {
      const updates = {};
      const changes = [];

      // Check Status Backfill
      if (p.status === undefined || p.status === null || p.status === "") {
        updates.status = "ACTIVE";
        statusUpdatesCount++;
        changes.push(`status: undefined -> "ACTIVE"`);
      }

      // Check Images Backfill
      const hasImagesArray = Array.isArray(p.images) && p.images.length > 0;
      if (!hasImagesArray) {
        if (typeof p.image === "string" && p.image.trim().length > 0) {
          updates.images = [p.image];
          imagesBackfilledCount++;
          changes.push(`images: [] -> ["${p.image}"]`);
        } else {
          imagesSkippedNoLegacyImage++;
        }
      } else {
        imagesSkippedAlreadyExisted++;
      }

      // Check Brand Normalization (Strictly target known audit values)
      if (p.brand && BRAND_NORMALIZATION_MAP.hasOwnProperty(p.brand)) {
        const normalized = BRAND_NORMALIZATION_MAP[p.brand];
        if (p.brand !== normalized) {
          updates.brand = normalized;
          brandNormalizationsCount++;
          changes.push(`brand: "${p.brand}" -> "${normalized}"`);
          brandChangesList.push({
            id: p._id.toString(),
            name: p.name,
            oldBrand: p.brand,
            newBrand: normalized,
          });
        }
      }

      // Check SEO-stuffed Product Name (Flag for admin human content decision)
      if (p.name && p.name.includes("Price, Full Specifications, Comparisons")) {
        productsToReview.push({
          id: p._id.toString(),
          name: p.name,
          reason: "SEO-stuffed title requires human content cleanup",
        });
      }

      if (Object.keys(updates).length > 0) {
        plannedMutations.push({
          doc: p,
          updates,
          changes,
        });
      }
    }

    const skippedProductsCount = beforeCount - plannedMutations.length;

    // --------------------------------------------------
    // 3. DRY-RUN REPORT
    // --------------------------------------------------
    console.log("=== DRY-RUN AUDIT REPORT ===");
    console.log(`Products found:                 ${beforeCount}`);
    console.log(`Status updates planned:          ${statusUpdatesCount}`);
    console.log(`Images backfilled planned:       ${imagesBackfilledCount}`);
    console.log(`Brand normalizations planned:    ${brandNormalizationsCount}`);
    console.log(`Products with mutations:        ${plannedMutations.length}`);
    console.log(`Products skipped (no changes):  ${skippedProductsCount}`);
    console.log(`Images skipped (already exist): ${imagesSkippedAlreadyExisted}`);
    console.log(`Images skipped (no image URL):  ${imagesSkippedNoLegacyImage}`);

    if (brandChangesList.length > 0) {
      console.log("\nNormalized Brand Details:");
      brandChangesList.forEach((b) => {
        console.log(`  - Product [${b.id}] "${b.name}": "${b.oldBrand}" -> "${b.newBrand}"`);
      });
    }

    if (productsToReview.length > 0) {
      console.log("\nProducts Flagged for Human Admin Review:");
      productsToReview.forEach((r) => {
        console.log(`  - Product [${r.id}] "${r.name}": ${r.reason}`);
      });
    }

    // Exit early if Dry Run
    if (isDryRun && !isExecute) {
      console.log("\n--------------------------------------------------");
      console.log(" DRY-RUN COMPLETE: Zero database writes executed.");
      console.log(" To run actual migration, execute with --execute flag.");
      console.log("--------------------------------------------------");
      await mongoose.disconnect();
      return;
    }

    // --------------------------------------------------
    // 4. EXECUTE MIGRATION (USING RAW DRIVER TO PRESERVE TIMESTAMPS)
    // --------------------------------------------------
    console.log("\n=== EXECUTING DATABASE MIGRATION ===");
    let actualMutatedCount = 0;

    for (const item of plannedMutations) {
      const res = await collection.updateOne(
        { _id: item.doc._id },
        { $set: item.updates }
      );
      if (res.modifiedCount > 0) {
        actualMutatedCount++;
      }
    }

    console.log(`Migration executed cleanly. Documents modified: ${actualMutatedCount}\n`);

    // --------------------------------------------------
    // 5. POST-MIGRATION VERIFICATION & INTEGRITY CHECK
    // --------------------------------------------------
    console.log("=== POST-MIGRATION VERIFICATION ===");
    const postProducts = await collection.find({}).toArray();
    const afterCount = postProducts.length;

    const verificationChecks = {
      allHaveStatusActiveOrDraft: true,
      allWithImageHaveImagesArray: true,
      draftProductsPreserved: true,
      countUnchanged: beforeCount === afterCount,
      noProductsDeleted: true,
      noInventedImageUrls: true,
      unrelatedFieldsUnchanged: true,
      timestampsUnchanged: true,
    };

    const postSnapshotMap = new Map();
    postProducts.forEach((p) => postSnapshotMap.set(p._id.toString(), p));

    // Verify all original product IDs exist
    for (const [id, preDoc] of preSnapshotMap.entries()) {
      const postDoc = postSnapshotMap.get(id);
      if (!postDoc) {
        verificationChecks.noProductsDeleted = false;
        break;
      }

      // Check Status
      if (!["ACTIVE", "DRAFT"].includes(postDoc.status)) {
        verificationChecks.allHaveStatusActiveOrDraft = false;
      }

      // Check DRAFT preservation
      if (preDoc.status === "DRAFT" && postDoc.status !== "DRAFT") {
        verificationChecks.draftProductsPreserved = false;
      }

      // Check Images Array
      if (postDoc.image && (!Array.isArray(postDoc.images) || postDoc.images.length === 0)) {
        verificationChecks.allWithImageHaveImagesArray = false;
      }

      // Check image URL validity (no invented URLs)
      if (Array.isArray(postDoc.images)) {
        for (const imgUrl of postDoc.images) {
          const matchedInPreImage = preDoc.image === imgUrl;
          const matchedInPreImages = Array.isArray(preDoc.images) && preDoc.images.includes(imgUrl);
          if (!matchedInPreImage && !matchedInPreImages) {
            verificationChecks.noInventedImageUrls = false;
          }
        }
      }

      // Check unrelated fields & timestamps
      const fieldsToCompare = [
        "name",
        "originalPrice",
        "discountPercent",
        "finalPrice",
        "stock",
        "category",
        "image",
      ];
      for (const field of fieldsToCompare) {
        if (JSON.stringify(preDoc[field]) !== JSON.stringify(postDoc[field])) {
          verificationChecks.unrelatedFieldsUnchanged = false;
        }
      }

      // Timestamps check
      const preCreatedAt = preDoc.createdAt;
      const postCreatedAt = postDoc.createdAt ? postDoc.createdAt.toISOString() : undefined;
      const preUpdatedAt = preDoc.updatedAt;
      const postUpdatedAt = postDoc.updatedAt ? postDoc.updatedAt.toISOString() : undefined;

      if (preCreatedAt !== postCreatedAt || preUpdatedAt !== postUpdatedAt) {
        verificationChecks.timestampsUnchanged = false;
      }
    }

    const allPassed = Object.values(verificationChecks).every(Boolean);

    console.log(`A. Every product has status = ACTIVE or DRAFT:        ${verificationChecks.allHaveStatusActiveOrDraft ? "PASSED" : "FAILED"}`);
    console.log(`B. Products with image have images array (length >= 1): ${verificationChecks.allWithImageHaveImagesArray ? "PASSED" : "FAILED"}`);
    console.log(`C. Existing DRAFT products remain DRAFT:                 ${verificationChecks.draftProductsPreserved ? "PASSED" : "FAILED"}`);
    console.log(`D. Product count unchanged (${beforeCount} -> ${afterCount}):                ${verificationChecks.countUnchanged ? "PASSED" : "FAILED"}`);
    console.log(`E. No products deleted:                                  ${verificationChecks.noProductsDeleted ? "PASSED" : "FAILED"}`);
    console.log(`F. No image URLs invented:                               ${verificationChecks.noInventedImageUrls ? "PASSED" : "FAILED"}`);
    console.log(`G. Unrelated fields unchanged:                           ${verificationChecks.unrelatedFieldsUnchanged ? "PASSED" : "FAILED"}`);
    console.log(`H. createdAt & updatedAt timestamps unchanged:            ${verificationChecks.timestampsUnchanged ? "PASSED" : "FAILED"}`);

    console.log(`\nOVERALL VERIFICATION RESULT: ${allPassed ? "PASSED (100% SAFE MIGRATION)" : "FAILED (INTEGRITY ERROR)"}`);

    // Print Final Report Table
    console.log("\n==================================================");
    console.log(" FINAL C5.1 MIGRATION REPORT");
    console.log("==================================================");
    console.log(`1. Migration Script Location:  scripts/migrateC5_1.js`);
    console.log(`2. Backup Location:            ${backupFilePath}`);
    console.log(`3. Status Backfills:          ${statusUpdatesCount}`);
    console.log(`4. Images Array Backfills:     ${imagesBackfilledCount}`);
    console.log(`5. Brand Normalizations:       ${brandNormalizationsCount}`);
    console.log(`6. Products Skipped (No-Op):   ${skippedProductsCount}`);
    console.log(`7. Product Count Before/After: ${beforeCount} / ${afterCount}`);
    console.log(`8. Verification Result:        ${allPassed ? "PASSED" : "FAILED"}`);
    console.log(`9. Flagged for Manual Review: ${productsToReview.length} product(s)`);

    await mongoose.disconnect();
  } catch (err) {
    console.error("Migration Error:", err);
    if (conn) await mongoose.disconnect();
    process.exit(1);
  }
}

runMigration();
