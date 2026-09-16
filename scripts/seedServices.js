import mongoose from "mongoose";
import dotenv from "dotenv";
import Service from "../models/Service.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const initialServices = [
  {
    name: "Trade-In Assessment",
    slug: "trade-in-assessment",
    category: "DEVICE_SALES",
    shortDescription: "Get the best value for your old device.",
    description:
      "Trade in your current smartphone or accessories for instant store credit towards a new purchase.",
    icon: "arrow-right-left",
    displayOrder: 1,
    status: "ACTIVE",
    ctaLabel: "Request Quote",
    ctaTarget: "/contact",
  },
  {
    name: "Screen Replacement",
    slug: "screen-replacement",
    category: "REPAIRS",
    shortDescription: "Original quality screen replacement.",
    description:
      "Fast and reliable screen replacement for all major mobile models using genuine parts.",
    icon: "smartphone",
    displayOrder: 10,
    status: "ACTIVE",
    ctaLabel: "Contact Us",
    ctaTarget: "/contact",
  },
  {
    name: "Battery Replacement",
    slug: "battery-replacement",
    category: "REPAIRS",
    shortDescription: "Restore your battery life to 100%.",
    description:
      "Professional battery replacement with guaranteed OEM-quality cells and fast turnaround.",
    icon: "battery-charging",
    displayOrder: 11,
    status: "ACTIVE",
    ctaLabel: "Contact Us",
    ctaTarget: "/contact",
  },
  {
    name: "Charging Port Repair",
    slug: "charging-port-repair",
    category: "REPAIRS",
    shortDescription: "Fix charging issues and loose connections.",
    description:
      "Expert diagnostics and repair for damaged or unresponsive charging ports.",
    icon: "plug",
    displayOrder: 12,
    status: "ACTIVE",
    ctaLabel: "Contact Us",
    ctaTarget: "/contact",
  },
  {
    name: "Camera Repair",
    slug: "camera-repair",
    category: "REPAIRS",
    shortDescription: "Crystal clear camera replacements.",
    description:
      "Replacement of faulty front and rear cameras, including lens glass repairs.",
    icon: "camera",
    displayOrder: 13,
    status: "ACTIVE",
    ctaLabel: "Contact Us",
    ctaTarget: "/contact",
  },
  {
    name: "Speaker Repair",
    slug: "speaker-repair",
    category: "REPAIRS",
    shortDescription: "Fix muffled or dead audio components.",
    description:
      "Earpiece and loudspeaker repairs to restore clear sound quality.",
    icon: "volume-2",
    displayOrder: 14,
    status: "ACTIVE",
    ctaLabel: "Contact Us",
    ctaTarget: "/contact",
  },
  {
    name: "Water Damage Repair",
    slug: "water-damage-repair",
    category: "REPAIRS",
    shortDescription: "Advanced liquid damage recovery.",
    description:
      "Professional ultrasonic cleaning and motherboard diagnostics for liquid-damaged devices.",
    icon: "droplet",
    displayOrder: 15,
    status: "ACTIVE",
    ctaLabel: "Contact Us",
    ctaTarget: "/contact",
  },
  {
    name: "Software Troubleshooting",
    slug: "software-troubleshooting",
    category: "REPAIRS",
    shortDescription: "OS fixes, flashing, and performance tuning.",
    description:
      "Resolve boot loops, freezing, and malware issues with expert software support.",
    icon: "terminal",
    displayOrder: 16,
    status: "ACTIVE",
    ctaLabel: "Contact Us",
    ctaTarget: "/contact",
  },
  {
    name: "Tempered Glass Installation",
    slug: "tempered-glass-installation",
    category: "ACCESSORIES",
    shortDescription: "Precision fit screen protection.",
    description:
      "Bubble-free installation of premium 9H tempered glass screen protectors.",
    icon: "shield",
    displayOrder: 20,
    status: "ACTIVE",
    ctaLabel: "View Options",
    ctaTarget: "/accessories",
  },
  {
    name: "Hydrogel Installation",
    slug: "hydrogel-installation",
    category: "ACCESSORIES",
    shortDescription: "Flexible and durable screen films.",
    description:
      "Custom-cut hydrogel film installation for curved displays and back panels.",
    icon: "layers",
    displayOrder: 21,
    status: "ACTIVE",
    ctaLabel: "View Options",
    ctaTarget: "/accessories",
  },
  {
    name: "Case Installation",
    slug: "case-installation",
    category: "ACCESSORIES",
    shortDescription: "Find the perfect protective case.",
    description:
      "Expert fitting for heavy-duty, rugged, and waterproof device cases.",
    icon: "box",
    displayOrder: 22,
    status: "ACTIVE",
    ctaLabel: "View Options",
    ctaTarget: "/accessories",
  },
  {
    name: "SIM Services",
    slug: "sim-services",
    category: "NETWORK_DATA",
    shortDescription: "SIM cutting, activation, and troubleshooting.",
    description:
      "Convert your old SIM to Nano-SIM or troubleshoot network connectivity issues.",
    icon: "sim-card",
    displayOrder: 30,
    status: "ACTIVE",
    ctaLabel: "Contact Us",
    ctaTarget: "/contact",
  },
  {
    name: "Data Transfer",
    slug: "data-transfer",
    category: "NETWORK_DATA",
    shortDescription: "Secure device-to-device migration.",
    description:
      "Safely transfer your contacts, photos, WhatsApp data, and apps to your new device.",
    icon: "arrow-right-left",
    displayOrder: 31,
    status: "ACTIVE",
    ctaLabel: "Contact Us",
    ctaTarget: "/contact",
  },
  {
    name: "Data Recovery Assessment",
    slug: "data-recovery-assessment",
    category: "NETWORK_DATA",
    shortDescription: "Recover lost files from damaged devices.",
    description:
      "Advanced diagnostics to determine the recoverability of data from dead or broken phones.",
    icon: "hard-drive",
    displayOrder: 32,
    status: "ACTIVE",
    ctaLabel: "Request Quote",
    ctaTarget: "/contact",
  },
  {
    name: "Network Unlocking",
    slug: "network-unlocking",
    category: "NETWORK_DATA",
    shortDescription: "Carrier unlocking services.",
    description:
      "Safe and legal carrier unlocking to allow your device to be used globally.",
    icon: "unlock",
    displayOrder: 33,
    status: "ACTIVE",
    ctaLabel: "Contact Us",
    ctaTarget: "/contact",
  },
  {
    name: "Warranty Support",
    slug: "warranty-support",
    category: "WARRANTY_SUPPORT",
    shortDescription: "Authorized after-sales support.",
    description:
      "Assistance with manufacturer warranty claims and guaranteed repairs.",
    icon: "shield-check",
    displayOrder: 40,
    status: "ACTIVE",
    ctaLabel: "Contact Support",
    ctaTarget: "/contact",
  },
  {
    name: "After-Sales Support",
    slug: "after-sales-support",
    category: "WARRANTY_SUPPORT",
    shortDescription: "Dedicated customer service.",
    description:
      "Post-purchase guidance, setup help, and general troubleshooting.",
    icon: "headphones",
    displayOrder: 41,
    status: "ACTIVE",
    ctaLabel: "Contact Support",
    ctaTarget: "/contact",
  },
];

const seedServices = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected.");

    let createdCount = 0;
    let existingCount = 0;

    for (const sData of initialServices) {
      // Check for existing by slug
      const existing = await Service.findOne({ slug: sData.slug });
      if (existing) {
        existingCount++;
        console.log(`Service '${sData.name}' already exists, skipping.`);
        continue;
      }

      await Service.create(sData);
      createdCount++;
      console.log(`Created service: '${sData.name}'`);
    }

    console.log("-----------------------------------------");
    console.log(`Seed completed.`);
    console.log(`Created: ${createdCount}`);
    console.log(`Already existed: ${existingCount}`);
    console.log("-----------------------------------------");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding services:", error);
    process.exit(1);
  }
};

seedServices();
