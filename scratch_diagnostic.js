import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env
dotenv.config({ path: '/media/ashok/E-Drive/Real-Industry/Mobile-Website/mobile-shop-backend/.env' });

async function runDiagnostic() {
  console.log("=== 1. DATABASE CONNECTION ===");
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connection: connected");
    console.log(`Database name: ${conn.connection.name}`);
    
    // Dynamic import to use the exact schema
    const { default: Admin } = await import('/media/ashok/E-Drive/Real-Industry/Mobile-Website/mobile-shop-backend/models/Admin.js');
    console.log(`Admin collection: ${Admin.collection.name}`);

    console.log("\n=== 2. ADMIN LOOKUP ===");
    // Just fetch all admins safely and check their emails
    const admins = await Admin.find({}).select("-password");
    console.log(`Found ${admins.length} admin document(s) in DB.`);
    let allEmails = [];
    let hasEmail = false;
    for (const a of admins) {
      if (a.email) {
        hasEmail = true;
      }
      allEmails.push(a.email || "<no email set>");
    }
    
    // The user manually tested with "the administrator email", but what if the DB admin doc has no email?
    if (!hasEmail) {
      console.log("Admin lookup: NOT FOUND (No admin in DB has an email address set!)");
    } else {
      console.log("Admin lookup: FOUND (At least one admin has an email set)");
      // Let's assume the user typed one of the existing emails.
    }
    
    console.log("\n=== 5. RESET FIELD VISIBILITY ===");
    const schemaPaths = Admin.schema.paths;
    const isTokenSelectFalse = schemaPaths.resetPasswordToken.options.select === false;
    const isExpiresSelectFalse = schemaPaths.resetPasswordExpires.options.select === false;
    console.log(`resetPasswordToken select:false is ${isTokenSelectFalse}`);
    console.log(`resetPasswordExpires select:false is ${isExpiresSelectFalse}`);
    
    // Check if any admin actually has the token
    const adminWithToken = await Admin.findOne({ resetPasswordToken: { $exists: true } }).select("+resetPasswordToken");
    if (adminWithToken) {
      console.log("resetPasswordToken exists: YES");
    } else {
      console.log("resetPasswordToken exists: NO");
    }

    console.log("\n=== 8. ENVIRONMENT ===");
    console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL ? 'configured' : 'not configured'}`);
    console.log(`RESEND_API_KEY: ${process.env.RESEND_API_KEY ? 'configured' : 'not configured'}`);
    console.log(`EMAIL_FROM: ${process.env.EMAIL_FROM ? 'configured' : 'not configured'}`);

    mongoose.disconnect();
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
}

runDiagnostic();
