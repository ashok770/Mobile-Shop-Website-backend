import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Settings from '../models/Settings.js';

dotenv.config();

const seedSettings = async () => {
  try {
    await connectDB();
    const defaults = {
      key: 'default',
      storeName: 'Ommastra Mobile Shop',
      storeTagline: 'Your one-stop mobile store',
      storeDescription: 'We sell the latest mobile phones and accessories.',
      contactEmail: 'contact@ommastra.com',
      contactPhone: '+1-800-123-4567',
      whatsappNumber: '+1-800-123-4567',
      address: '123 Main St, City, Country',
      city: 'City',
      state: 'State',
      country: 'Country',
      postalCode: '12345',
      mapEmbedUrl: '',
      directionsUrl: '',
      weekdayHours: '9am - 6pm',
      weekendHours: '10am - 4pm',
      facebookUrl: '',
      instagramUrl: '',
      youtubeUrl: '',
      freeShippingThreshold: 500,
      baseShippingCharge: 49,
      codEnabled: true,
    };

    // Upsert the singleton settings document
    await Settings.findOneAndUpdate({ key: 'default' }, defaults, { upsert: true, new: true, setDefaultsOnInsert: true });
    console.log('✅ Settings seeded/updated');
    process.exit(0);
  } catch (error) {
    console.error('❌ Settings seed failed:', error);
    process.exit(1);
  }
};

seedSettings();
