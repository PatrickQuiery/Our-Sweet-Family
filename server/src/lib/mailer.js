const nodemailer = require('nodemailer');

/**
 * Build a nodemailer transport from environment variables.
 *
 * Production uses real SMTP (works with any provider — SES, Resend, Mailgun,
 * Postmark, Gmail, etc.):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE ("true"/"false")
 *
 * When SMTP is not configured we fall back to a JSON transport that does not
 * send anything but lets the app run (dev/local). Callers should treat a
 * non-configured transport as "not delivered" and rely on DB persistence.
 */
let cachedTransport = null;
let cachedConfigured = null;

function getTransport() {
  if (cachedTransport) return { transport: cachedTransport, configured: cachedConfigured };

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  if (SMTP_HOST && SMTP_PORT) {
    cachedConfigured = true;
    cachedTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT, 10),
      secure: SMTP_SECURE === 'true' || parseInt(SMTP_PORT, 10) === 465,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  } else {
    cachedConfigured = false;
    // Does not send mail — logs the message so local dev still functions.
    cachedTransport = nodemailer.createTransport({ jsonTransport: true });
  }

  return { transport: cachedTransport, configured: cachedConfigured };
}

/**
 * Send an email. Returns { sent: boolean }. Never throws for a "not configured"
 * transport — only a real send failure rejects.
 */
async function sendMail({ to, replyTo, subject, text, html }) {
  const { transport, configured } = getTransport();
  const from = process.env.SMTP_FROM || 'no-reply@oursweetfamily.com';

  const info = await transport.sendMail({ from, to, replyTo, subject, text, html });

  if (!configured) {
    console.warn(
      '[mailer] SMTP not configured — email NOT delivered. Set SMTP_HOST/SMTP_PORT ' +
      '(and SMTP_USER/SMTP_PASS/SMTP_FROM) to enable delivery. Message preview:',
      info.message ? info.message.toString().slice(0, 200) : '(no preview)'
    );
    return { sent: false };
  }
  return { sent: true };
}

module.exports = { sendMail, getTransport };
