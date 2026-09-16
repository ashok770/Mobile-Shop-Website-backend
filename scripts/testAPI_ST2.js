import fetch from 'node-fetch';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import connectDB from '../config/db.js';
import Settings from '../models/Settings.js';
import Admin from '../models/Admin.js';
import User from '../models/User.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  await connectDB();
  const admin = await Admin.findOne();
  let adminToken = '';
  if (admin) {
    adminToken = jwt.sign(
      { id: admin._id, type: "admin", tokenVersion: admin.tokenVersion ?? 0 },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
  }

  console.log('--- API VERIFICATION ---');
  // GET /api/settings
  let res = await fetch(`${BASE_URL}/settings`);
  let data = await res.json();
  console.log(`GET /api/settings: ${res.status} (Expected: 200)`);
  // Check no secrets
  if (data.settings && data.settings._id === undefined && data.settings.__v === undefined) {
      console.log(`✅ GET /api/settings only has sanitized fields`);
  }

  // GET /api/admin/settings (Unauthenticated)
  res = await fetch(`${BASE_URL}/admin/settings`);
  console.log(`GET /api/admin/settings (unauth): ${res.status} (Expected: 401)`);

  // GET /api/admin/settings (Invalid token)
  res = await fetch(`${BASE_URL}/admin/settings`, {
    headers: { 'Authorization': 'Bearer invalid_token_123' }
  });
  console.log(`GET /api/admin/settings (invalid token): ${res.status} (Expected: 401)`);

  // GET /api/admin/settings (Valid token)
  res = await fetch(`${BASE_URL}/admin/settings`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`GET /api/admin/settings (valid): ${res.status} (Expected: 200)`);

  // PUT updates
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  res = await fetch(`${BASE_URL}/admin/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ storeName: "Test Store" })
  });
  console.log(`PUT valid update: ${res.status} (Expected: 200)`);

  res = await fetch(`${BASE_URL}/admin/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ contactEmail: "invalid-email" })
  });
  console.log(`PUT invalid email: ${res.status} (Expected: 400)`);

  res = await fetch(`${BASE_URL}/admin/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ mapEmbedUrl: "not-a-url" })
  });
  console.log(`PUT invalid URL: ${res.status} (Expected: 400)`);

  res = await fetch(`${BASE_URL}/admin/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ freeShippingThreshold: -10 })
  });
  console.log(`PUT negative threshold: ${res.status} (Expected: 400)`);

  res = await fetch(`${BASE_URL}/admin/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ baseShippingCharge: -5 })
  });
  console.log(`PUT negative charge: ${res.status} (Expected: 400)`);
  
  res = await fetch(`${BASE_URL}/admin/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ codEnabled: false })
  });
  let codData = await res.json();
  console.log(`PUT codEnabled update: ${res.status} (Expected: 200). Current codEnabled: ${codData.settings.codEnabled}`);

  console.log('\n--- SHIPPING VERIFICATION ---');
  // Mocking the shipping logic since creating an order modifies stock
  async function testShipping(subtotal, expected) {
      const { freeShippingThreshold = 500, baseShippingCharge = 49 } = (await Settings.findOne({ key: "default" })) || {};
      const shippingCharge = subtotal > 0 && subtotal < freeShippingThreshold ? baseShippingCharge : 0;
      console.log(`subtotal=${subtotal} -> ${shippingCharge} (Expected: ${expected})`);
  }

  await testShipping(499, 49);
  await testShipping(500, 0);
  await testShipping(501, 0);
  await testShipping(0, 0);

  console.log('\nTemporarily modify Settings (threshold=1000, charge=99):');
  await Settings.findOneAndUpdate({ key: 'default'}, { freeShippingThreshold: 1000, baseShippingCharge: 99 });
  await testShipping(499, 99);
  await testShipping(999, 99);
  await testShipping(1000, 0);

  // Restore
  console.log('\nRestoring original Settings (threshold=500, charge=49, codEnabled=true):');
  await Settings.findOneAndUpdate({ key: 'default'}, { freeShippingThreshold: 500, baseShippingCharge: 49, codEnabled: true, storeName: 'Ommastra Mobile Shop' });
  await testShipping(499, 49);
  
  process.exit(0);
}

runTests();
