import { Resend } from "resend";

/**
 * Sends a transactional email via Resend.
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject
 * @param {string} [options.html] - HTML content
 * @param {string} [options.text] - Plain-text content
 * @param {string} [options.from] - Custom sender address (defaults to EMAIL_FROM env var)
 * @returns {Promise<{ success: boolean, id?: string }>}
 */
export const sendEmail = async ({ to, subject, html, text, from }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Email service is unconfigured: RESEND_API_KEY is missing.");
  }

  const sender = from || process.env.EMAIL_FROM;
  if (!sender) {
    throw new Error("Email service is unconfigured: EMAIL_FROM is missing.");
  }

  if (!to) {
    throw new Error("Recipient email address (to) is required.");
  }

  if (!subject) {
    throw new Error("Email subject is required.");
  }

  if (!html && !text) {
    throw new Error("Email content (html or text) is required.");
  }

  const resend = new Resend(apiKey);

  const payload = {
    from: sender,
    to: Array.isArray(to) ? to : [to],
    subject,
  };

  if (html) payload.html = html;
  if (text) payload.text = text;

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    const failureMessage = error.message || "Failed to send email via provider.";
    throw new Error(`Email delivery failed: ${failureMessage}`);
  }

  return {
    success: true,
    id: data?.id,
  };
};
