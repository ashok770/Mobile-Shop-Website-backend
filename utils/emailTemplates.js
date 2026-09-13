/**
 * Creates password reset email payload (subject, html, text).
 * @param {Object} params
 * @param {string} params.resetUrl - The pre-constructed, trusted password reset URL
 * @returns {{ subject: string, html: string, text: string }}
 */
export const createPasswordResetEmail = ({ resetUrl }) => {
  const subject = "Reset your Ommastra admin password";

  const text = `Hello,

A password reset was requested for your Ommastra administrator account.

Use the link below to reset your password:
${resetUrl}

This link expires in 15 minutes.

If you did not request this, you can safely ignore this email.

— Ommastra Admin Security Team`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #111827;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
    <div style="background-color: #2563eb; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em;">Ommastra Admin</h1>
    </div>
    <div style="padding: 32px 24px;">
      <h2 style="font-size: 18px; font-weight: 600; color: #111827; margin-top: 0; margin-bottom: 16px;">Password Reset Request</h2>
      <p style="font-size: 15px; line-height: 1.5; color: #4b5563; margin-bottom: 24px;">
        A password reset was requested for your Ommastra administrator account. Click the button below to set a new password.
      </p>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">Reset Password</a>
      </div>
      <p style="font-size: 13px; line-height: 1.5; color: #6b7280; margin-bottom: 16px;">
        This password reset link is valid for <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px 0;" />
      <p style="font-size: 12px; line-height: 1.4; color: #9ca3af; margin: 0;">
        If you're having trouble clicking the button, copy and paste this URL into your browser:<br />
        <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
};
