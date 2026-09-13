import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateResetToken, hashResetToken } from "../utils/passwordResetToken.js";
import { sendEmail } from "../utils/emailService.js";
import { createPasswordResetEmail } from "../utils/emailTemplates.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "If an account with that email exists, a password reset link has been sent.";

// Admin Login
export const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: admin._id,
        type: "admin",
        tokenVersion: admin.tokenVersion ?? 0,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      message: "Login successful",
      token,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Admin Logout
export const adminLogout = async (req, res) => {
  try {
    if (!req.admin || !req.admin._id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, admin token failed",
      });
    }

    await Admin.findByIdAndUpdate(req.admin._id, {
      $inc: { tokenVersion: 1 },
    });

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin Forgot Password
export const adminForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const admin = await Admin.findOne({ email: normalizedEmail });

    // Account enumeration defense: Return identical generic message if account does not exist
    if (!admin) {
      return res.status(200).json({
        success: true,
        message: GENERIC_FORGOT_PASSWORD_MESSAGE,
      });
    }

    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      console.error("Password reset error: FRONTEND_URL is not configured.");
      return res.status(500).json({
        success: false,
        message: "Unable to process password reset request at this time.",
      });
    }

    // Generate 256-bit CSPRNG reset token
    const rawToken = generateResetToken();
    const hashedToken = hashResetToken(rawToken);
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store hashed token and expiry in DB
    admin.resetPasswordToken = hashedToken;
    admin.resetPasswordExpires = expires;
    await admin.save();

    // Construct trusted reset URL based on FRONTEND_URL
    const baseUrl = frontendUrl.replace(/\/$/, "");
    const resetUrl = `${baseUrl}/admin/reset-password?token=${rawToken}`;

    // Create email content from template
    const { subject, html, text } = createPasswordResetEmail({ resetUrl });

    // Send email via Resend transport
    try {
      await sendEmail({
        to: admin.email,
        subject,
        html,
        text,
      });
    } catch (emailError) {
      console.error("Admin password reset email delivery failed.");
      // Safely invalidate newly stored token on delivery failure
      admin.resetPasswordToken = undefined;
      admin.resetPasswordExpires = undefined;
      await admin.save();

      return res.status(500).json({
        success: false,
        message: "Unable to process password reset request at this time.",
      });
    }

    return res.status(200).json({
      success: true,
      message: GENERIC_FORGOT_PASSWORD_MESSAGE,
    });
  } catch (error) {
    console.error("Unhandled error in adminForgotPassword");
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Admin Reset Password
export const adminResetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== "string" || !newPassword || typeof newPassword !== "string") {
      return res.status(400).json({
        success: false,
        message: "Token and new password are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    const hashedToken = hashResetToken(token);

    const admin = await Admin.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Hash new password using bcrypt
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atomically update password, invalidate reset token (single-use), and increment tokenVersion
    admin.password = hashedPassword;
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpires = undefined;
    admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    await admin.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Unhandled error in adminResetPassword");
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

