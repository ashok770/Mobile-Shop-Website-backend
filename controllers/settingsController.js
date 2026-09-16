import Settings from "../models/Settings.js";

/** Helper for safe field picking */
const publicFields = [
  "storeName",
  "storeTagline",
  "storeDescription",
  "contactEmail",
  "contactPhone",
  "whatsappNumber",
  "address",
  "city",
  "state",
  "country",
  "postalCode",
  "mapEmbedUrl",
  "directionsUrl",
  "weekdayHours",
  "weekendHours",
  "facebookUrl",
  "instagramUrl",
  "youtubeUrl",
  "freeShippingThreshold",
  "baseShippingCharge",
  "codEnabled",
];

/** GET /api/settings – public sanitized settings */
export const getPublicSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne({ key: "default" }).lean();
    if (!settings) {
      return res.status(404).json({ success: false, message: "Settings not found" });
    }
    const payload = {};
    publicFields.forEach((f) => (payload[f] = settings[f] ?? null));
    res.json({ success: true, settings: payload });
  } catch (err) {
    console.error("Public settings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/** GET /api/admin/settings – full admin view */
export const getAdminSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne({ key: "default" }).lean();
    if (!settings) {
      return res.status(404).json({ success: false, message: "Settings not found" });
    }
    // Exclude internal Mongo fields only
    const { _id, __v, createdAt, updatedAt, ...rest } = settings;
    res.json({ success: true, settings: rest });
  } catch (err) {
    console.error("Admin settings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/** Simple validation utilities */
const isValidEmail = (email) =>
  typeof email === "string" && email.length > 0
    ? /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    : true; // allow empty

const isValidUrl = (url) =>
  typeof url === "string" && url.length > 0
    ? /^(https?:\/\/)[^\s/$.?#].[^\s]*$/.test(url)
    : true; // allow empty

/** PUT /api/admin/settings – update singleton */
export const updateSettings = async (req, res) => {
  try {
    const payload = req.body || {};
    // Enforce key cannot be changed
    if (payload.key && payload.key !== "default") {
      return res.status(400).json({ success: false, message: "Invalid key value" });
    }
    // Validation
    if (!isValidEmail(payload.contactEmail)) {
      return res.status(400).json({ success: false, message: "Invalid contactEmail" });
    }
    const urlFields = [
      "mapEmbedUrl",
      "directionsUrl",
      "facebookUrl",
      "instagramUrl",
      "youtubeUrl",
    ];
    for (const f of urlFields) {
      if (payload[f] && !isValidUrl(payload[f])) {
        return res.status(400).json({ success: false, message: `Invalid URL for ${f}` });
      }
    }
    if (payload.freeShippingThreshold != null && payload.freeShippingThreshold < 0) {
      return res.status(400).json({ success: false, message: "freeShippingThreshold cannot be negative" });
    }
    if (payload.baseShippingCharge != null && payload.baseShippingCharge < 0) {
      return res.status(400).json({ success: false, message: "baseShippingCharge cannot be negative" });
    }
    // Upsert safely
    const updated = await Settings.findOneAndUpdate(
      { key: "default" },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    const responsePayload = {};
    publicFields.forEach((f) => (responsePayload[f] = updated[f] ?? null));
    res.json({ success: true, settings: responsePayload });
  } catch (err) {
    console.error("Update settings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
