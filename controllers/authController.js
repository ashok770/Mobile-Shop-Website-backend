import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const googleClient = new OAuth2Client();
const googleClientId = (process.env.GOOGLE_CLIENT_ID || "").trim();

const getGoogleVerificationFailureCategory = (error) => {
  // This value is used only for classification and is never logged or returned.
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";

  if (message.includes("failed to retrieve verification certificates")) {
    return "certificate_fetch_failed";
  }
  if (message.includes("wrong recipient") || message.includes("audience")) {
    return "audience_mismatch";
  }
  if (message.includes("token used too late") || message.includes("token expired")) {
    return "token_expired";
  }
  if (message.includes("invalid issuer") || message.includes("issuer mismatch")) {
    return "issuer_mismatch";
  }
  if (message.includes("invalid token signature")) {
    return "signature_invalid";
  }
  if (
    message.includes("wrong number of segments") ||
    message.includes("can't parse token") ||
    message.includes("invalid format") ||
    message.includes("no issue time") ||
    message.includes("no expiration time") ||
    message.includes("expiration time too far in future")
  ) {
    return "malformed_token";
  }

  return "unknown_verification_error";
};

const createAuthToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields.",
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters long.",
      });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    // Check Existing User
    const existingUser = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: existingUser.googleId && !existingUser.password
          ? "An account with this email uses Google Sign-In. Please continue with Google."
          : "User already exists with this email.",
      });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);

    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // Get user (password is hidden by select:false)
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Compare Password
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: "This account uses Google Sign-In. Please continue with Google.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = createAuthToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const googleLogin = async (req, res) => {
  const { credential } = req.body || {};

  if (typeof credential !== "string" || !credential.trim()) {
    return res.status(400).json({
      success: false,
      message: "Google credential is required.",
    });
  }

  if (!googleClientId) {
    console.error("Google authentication verification failed: missing_configuration");
    return res.status(500).json({
      success: false,
      message: "Google Sign-In is not configured.",
    });
  }

  let payload;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
    payload = ticket.getPayload();
  } catch (error) {
    const category = getGoogleVerificationFailureCategory(error);
    console.error(`Google authentication verification failed: ${category}`);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired Google credential.",
    });
  }

  try {
    const googleId = payload?.sub;
    const email = payload?.email?.toLowerCase().trim();

    if (!googleId || !email || payload.email_verified !== true) {
      return res.status(401).json({
        success: false,
        message: "Google account email could not be verified.",
      });
    }

    let user = await User.findOne({ googleId });

    if (!user) {
      user = await User.findOne({ email });

      if (user) {
        user.googleId = googleId;
        user.emailVerified = true;
        await user.save();
      } else {
        const trustedName = payload.name?.trim() || email.split("@")[0];
        user = await User.create({
          name: trustedName.length >= 2 ? trustedName : "Google User",
          email,
          avatar: payload.picture || "",
          googleId,
          emailVerified: true,
          role: "customer",
        });
      }
    }

    const token = createAuthToken(user);

    return res.status(200).json({
      success: true,
      message: "Google Sign-In successful.",
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This Google account is already linked to another user.",
      });
    }

    console.error("Google Sign-In database error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
