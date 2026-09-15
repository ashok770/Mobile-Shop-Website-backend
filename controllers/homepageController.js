import HomepageConfig from "../models/HomepageConfig.js";
import cloudinary from "../config/cloudinary.js";

// Helper to get or create config
const getOrCreateConfig = async () => {
  let config = await HomepageConfig.findOne();
  if (!config) {
    config = await HomepageConfig.create({
      heroSlides: [],
      sections: {
        belowThousand: true,
        megaFlashSale: true,
        buy1Get1: true,
        dailySpecial: true,
        newArrivals: true,
      }
    });
  }
  return config;
};

// @desc    Get homepage configuration
// @route   GET /api/homepage
// @access  Public
export const getHomepageConfig = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Update homepage configuration
// @route   PUT /api/homepage
// @access  Private/Admin
export const updateHomepageConfig = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    const oldSlides = config.heroSlides || [];

    // Data from client
    let { featuredDealProductId, sections, existingSlides } = req.body;

    if (typeof existingSlides === "string") {
      existingSlides = JSON.parse(existingSlides);
    }
    if (typeof sections === "string") {
      sections = JSON.parse(sections);
    }

    // Process new uploaded images
    const newSlides = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        // Find metadata matching this file's original name
        const meta = req.body[`slideMeta_${file.originalname}`];
        let parsedMeta = {};
        if (meta) {
          try { parsedMeta = JSON.parse(meta); } catch (e) {}
        }

        newSlides.push({
          image: file.path,
          publicId: file.filename, // Multer-storage-cloudinary uses filename for public_id
          destination: parsedMeta.destination || "/",
          alt: parsedMeta.alt || "",
          isActive: parsedMeta.isActive !== false,
        });
      });
    }

    // Combine existing retained slides and new slides
    const retainedSlides = Array.isArray(existingSlides) ? existingSlides : [];
    const finalSlides = [...retainedSlides, ...newSlides];

    // Identify deleted slides to cleanup from Cloudinary
    const retainedPublicIds = finalSlides.map(s => s.publicId);
    const deletedSlides = oldSlides.filter(s => !retainedPublicIds.includes(s.publicId));

    for (const slide of deletedSlides) {
      if (slide.publicId) {
        try {
          await cloudinary.uploader.destroy(slide.publicId);
        } catch (err) {
          console.error("Failed to delete from Cloudinary:", err);
        }
      }
    }

    // Update config fields
    if (featuredDealProductId !== undefined) {
      config.featuredDealProductId = featuredDealProductId === "" ? null : featuredDealProductId;
    }
    if (sections) {
      config.sections = { ...config.sections, ...sections };
    }
    config.heroSlides = finalSlides;

    await config.save();
    res.json(config);

  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
