import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Admin from "../models/Admin.js";

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach full user document to request
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User account no longer exists.",
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token failed",
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is missing.",
    });
  }
};

export default protect;

export const adminProtect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.type !== "admin") {
        return res.status(401).json({
          success: false,
          message: "Not authorized as admin.",
        });
      }

      if (decoded.tokenVersion === undefined || decoded.tokenVersion === null) {
        return res.status(401).json({
          success: false,
          message: "Not authorized, admin token failed",
        });
      }

      req.admin = await Admin.findById(decoded.id).select("-password");

      if (!req.admin) {
        return res.status(401).json({
          success: false,
          message: "Admin account no longer exists.",
        });
      }

      const currentVersion = req.admin.tokenVersion ?? 0;
      if (decoded.tokenVersion !== currentVersion) {
        return res.status(401).json({
          success: false,
          message: "Not authorized, admin token failed",
        });
      }

      return next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, admin token failed",
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Admin authentication token is missing.",
    });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.admin) {
    return next();
  }

  if (req.user && req.user.role === "admin") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Admin access only.",
  });
};
