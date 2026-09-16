import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Settings from '../models/Settings.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Brand from '../models/Brand.js';
import Service from '../models/Service.js';
import Admin from '../models/Admin.js';
// use built-in fetch if node 18+

dotenv.config();

async function runVerifications() {
  await connectDB();
  console.log("DB Connected.");

  // 1. DATA INTEGRITY
  const pCount = await Product.countDocuments();
  const oCount = await Order.countDocuments();
  const bCount = await Brand.countDocuments();
  const sCount = await Service.countDocuments();
  const aCount = await Admin.countDocuments();

  console.log(`\n=== DATA INTEGRITY ===`);
  console.log(`Products: ${pCount}`);
  console.log(`Orders: ${oCount}`);
  console.log(`Brands: ${bCount}`);
  console.log(`Services: ${sCount}`);
  console.log(`Users (Admins): ${aCount}`);

  // 2. SINGLETON VERIFICATION
  console.log(`\n=== SINGLETON VERIFICATION ===`);
  const settingsCount = await Settings.countDocuments();
  const settingsCountDefault = await Settings.countDocuments({ key: "default" });
  console.log(`Total Settings Docs: ${settingsCount}`);
  console.log(`Default Key Docs: ${settingsCountDefault}`);
  if (settingsCount === 1 && settingsCountDefault === 1) {
    console.log(`✅ Singleton rule intact.`);
  } else {
    console.log(`❌ Singleton rule violated.`);
  }
  
  process.exit(0);
}

runVerifications();
