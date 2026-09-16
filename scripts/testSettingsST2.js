import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Settings from '../models/Settings.js';

dotenv.config();

const testSettings = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to DB');

    // Ensure the singleton exists
    const settings = await Settings.findOne({ key: 'default' }).lean();
    if (!settings) {
      console.error('❌ Settings document not found');
      process.exit(1);
    }
    console.log('✅ Settings document found');
    console.log('Current freeShippingThreshold:', settings.freeShippingThreshold);

    // Update a field and verify
    const newThreshold = (settings.freeShippingThreshold || 500) + 100;
    const updated = await Settings.findOneAndUpdate(
      { key: 'default' },
      { $set: { freeShippingThreshold: newThreshold } },
      { new: true }
    ).lean();
    console.log('✅ Updated freeShippingThreshold to', updated.freeShippingThreshold);

    // Revert change (cleanup)
    await Settings.findOneAndUpdate(
      { key: 'default' },
      { $set: { freeShippingThreshold: settings.freeShippingThreshold } },
      { new: true }
    );
    console.log('✅ Reverted freeShippingThreshold');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
};

testSettings();
