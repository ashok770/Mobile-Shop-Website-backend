import crypto from "crypto";

/**
 * Generates a cryptographically secure random token (32 bytes / 256 bits).
 * @returns {string} 64-character hexadecimal raw token
 */
export const generateResetToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Hashes a raw reset token using SHA-256 for secure database storage.
 * @param {string} rawToken - The plain hexadecimal reset token
 * @returns {string} 64-character hexadecimal SHA-256 hash
 */
export const hashResetToken = (rawToken) => {
  return crypto.createHash("sha256").update(String(rawToken)).digest("hex");
};
