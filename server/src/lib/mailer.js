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
      // Bounded timeouts so a bad port/TLS combo fails fast (and logs a clear
      // error) instead of hanging the request until the socket eventually dies.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  } else {
    cachedConfigured = false;
    // Does not send mail — logs the message so local dev still functions.
    cachedTransport = nodemailer.createTransport({ jsonTransport: true });
  }

  return { transport: cachedTransport, configured: cachedConfigured };
}

// Send via Resend's HTTP API (port 443). Preferred on hosts like Railway that
// block outbound SMTP ports. Throws on a non-2xx response.
async function sendViaResend({ from, to, replyTo, subject, text, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, text, html }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend API responded ${res.status}: ${detail.slice(0, 300)}`);
  }
  return { sent: true };
}

/**
 * Send an email. Returns { sent: boolean }. Prefers the Resend HTTP API when
 * RESEND_API_KEY is set; otherwise falls back to SMTP (any provider), or a no-op
 * JSON transport when nothing is configured. Real send failures reject.
 */
async function sendMail({ to, replyTo, subject, text, html }) {
  const from = process.env.SMTP_FROM || process.env.RESEND_FROM || 'no-reply@oursweetfamily.com';

  // Preferred path: Resend HTTP API (immune to SMTP egress blocking).
  if (process.env.RESEND_API_KEY) {
    return sendViaResend({ from, to, replyTo, subject, text, html });
  }

  // Fallback: SMTP (or no-op if unconfigured).
  const { transport, configured } = getTransport();
  const info = await transport.sendMail({ from, to, replyTo, subject, text, html });
  if (!configured) {
    console.warn(
      '[mailer] No email transport configured — email NOT delivered. Set RESEND_API_KEY ' +
      '(recommended) or SMTP_HOST/SMTP_PORT. Message preview:',
      info.message ? info.message.toString().slice(0, 200) : '(no preview)'
    );
    return { sent: false };
  }
  return { sent: true };
}

module.exports = { sendMail, getTransport };
