import mongoose from "mongoose";
import Service from "../models/Service.js";

/**
 * Generate a URL-safe slug from a string.
 */
const generateSlug = (name) => {
  if (!name || typeof name !== "string") return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/**
 * GET /api/services
 * Public endpoint: Returns ACTIVE services only, sorted by displayOrder then name.
 */
export const getPublicServices = async (req, res) => {
  try {
    const services = await Service.find({ status: "ACTIVE" })
      .sort({ displayOrder: 1, name: 1 })
      .select(
        "_id name slug category shortDescription description icon image displayOrder status ctaLabel ctaTarget"
      );

    res.status(200).json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/admin/services
 * Admin endpoint: Returns services with search, filtering, and pagination.
 */
export const getAdminServices = async (req, res) => {
  try {
    const { search, category, status, page, limit } = req.query;

    const filter = {};

    // Search by name
    const searchVal = Array.isArray(search) ? search[0] : search;
    if (typeof searchVal === "string" && searchVal.trim().length > 0) {
      const trimmed = searchVal.trim().slice(0, 100);
      const sanitized = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (sanitized.length > 0) {
        filter.name = { $regex: sanitized, $options: "i" };
      }
    }

    // Category filter
    const catVal = Array.isArray(category) ? category[0] : category;
    if (catVal && catVal !== "ALL") {
      filter.category = catVal;
    }

    // Status filter
    const statusVal = Array.isArray(status) ? status[0] : status;
    if (statusVal && statusVal !== "ALL") {
      if (statusVal === "ACTIVE" || statusVal === "DISABLED") {
        filter.status = statusVal;
      }
    }

    // Pagination
    const pageRaw = parseInt(Array.isArray(page) ? page[0] : page, 10);
    const limitRaw = parseInt(Array.isArray(limit) ? limit[0] : limit, 10);

    const pageNum = isNaN(pageRaw) || pageRaw <= 0 ? 1 : pageRaw;
    const limitNum =
      isNaN(limitRaw) || limitRaw <= 0 ? 50 : Math.min(100, limitRaw);

    const total = await Service.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum) || 1;

    const services = await Service.find(filter)
      .sort({ displayOrder: 1, name: 1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select(
        "_id name slug category shortDescription description icon image displayOrder status ctaLabel ctaTarget createdAt updatedAt"
      );

    res.status(200).json({
      services,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/admin/services
 * Admin endpoint: Create a new service.
 */
export const createService = async (req, res) => {
  try {
    const {
      name,
      slug,
      category,
      shortDescription,
      description,
      icon,
      image,
      displayOrder,
      status,
      ctaLabel,
      ctaTarget,
    } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Service name is required" });
    }

    const trimmedName = name.trim();

    // Check duplicate name
    const existingName = await Service.findOne({
      name: {
        $regex: new RegExp(
          `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
      },
    });
    if (existingName) {
      return res
        .status(409)
        .json({ message: "A service with this name already exists" });
    }

    // Determine slug
    let finalSlug = "";
    if (slug && typeof slug === "string" && slug.trim().length > 0) {
      finalSlug = generateSlug(slug);
    } else {
      finalSlug = generateSlug(trimmedName);
    }

    if (!finalSlug) {
      return res
        .status(400)
        .json({ message: "Valid slug could not be generated" });
    }

    // Check duplicate slug
    const existingSlug = await Service.findOne({ slug: finalSlug });
    if (existingSlug) {
      return res
        .status(409)
        .json({ message: "A service with this slug already exists" });
    }

    const service = new Service({
      name: trimmedName,
      slug: finalSlug,
      category,
      shortDescription,
      description,
      icon,
      image,
      displayOrder,
      status,
      ctaLabel,
      ctaTarget,
    });

    await service.save();

    res.status(201).json(service);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Duplicate key conflict: service name or slug already exists",
      });
    }
    // Validation error check for enum values (like category)
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/admin/services/:id
 * Admin endpoint: Update a service.
 */
export const updateService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Service ID format" });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    const {
      name,
      slug,
      category,
      shortDescription,
      description,
      icon,
      image,
      displayOrder,
      status,
      ctaLabel,
      ctaTarget,
    } = req.body;

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Service name is required" });
      }
      const trimmedName = name.trim();
      const existingName = await Service.findOne({
        _id: { $ne: service._id },
        name: {
          $regex: new RegExp(
            `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i"
          ),
        },
      });
      if (existingName) {
        return res
          .status(409)
          .json({ message: "A service with this name already exists" });
      }
      service.name = trimmedName;
    }

    if (slug !== undefined) {
      const finalSlug = generateSlug(slug);
      if (!finalSlug) {
        return res
          .status(400)
          .json({ message: "Valid slug could not be generated" });
      }
      const existingSlug = await Service.findOne({
        _id: { $ne: service._id },
        slug: finalSlug,
      });
      if (existingSlug) {
        return res
          .status(409)
          .json({ message: "A service with this slug already exists" });
      }
      service.slug = finalSlug;
    }

    if (category !== undefined) service.category = category;
    if (shortDescription !== undefined)
      service.shortDescription = shortDescription;
    if (description !== undefined) service.description = description;
    if (icon !== undefined) service.icon = icon;
    if (image !== undefined) service.image = image;
    if (displayOrder !== undefined) service.displayOrder = displayOrder;
    if (status !== undefined) service.status = status;
    if (ctaLabel !== undefined) service.ctaLabel = ctaLabel;
    if (ctaTarget !== undefined) service.ctaTarget = ctaTarget;

    await service.save();

    res.status(200).json(service);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Duplicate key conflict: service name or slug already exists",
      });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE /api/admin/services/:id
 * Admin endpoint: Delete a service.
 */
export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Service ID format" });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    await Service.findByIdAndDelete(service._id);

    res.status(200).json({
      message: `Service '${service.name}' deleted successfully.`,
      deletedId: service._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
