const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { sendMail } = require('../lib/mailer');

const router = express.Router();

const CONTACT_TO = process.env.CONTACT_TO || 'Contact@oursweetfamily.com';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// POST /api/contact — public contact form. Persists the message and emails it
// to the support inbox. Honeypot field `company` must be empty (bot trap).
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('subject').optional().trim().isLength({ max: 300 }),
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ min: 2, max: 5000 }),
    body('company').optional({ nullable: true }), // honeypot
  ],
  async (req, res) => {
    // Honeypot: real users never fill this hidden field. Pretend success.
    if (req.body.company) {
      return res.status(200).json({ success: true });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, subject, message } = req.body;

    let record;
    try {
      record = await prisma.contactMessage.create({
        data: {
          name,
          email,
          subject: subject || null,
          message,
        },
      });
    } catch (err) {
      console.error('Failed to persist contact message:', err);
      return res.status(500).json({ error: 'Could not send your message. Please try again.' });
    }

    // Best-effort email. The message is already safely stored, so an email
    // failure does not fail the request — but we log it loudly and flag it.
    const displaySubject = subject ? `Contact form: ${subject}` : 'New contact form message';
    try {
      const result = await sendMail({
        to: CONTACT_TO,
        replyTo: `${name} <${email}>`,
        subject: displaySubject,
        text: `New message from the Our Sweet Family contact form\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject || '(none)'}\n\n${message}`,
        html: `
          <h2>New contact form message</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Subject:</strong> ${escapeHtml(subject || '(none)')}</p>
          <hr/>
          <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
        `,
      });
      if (result.sent) {
        await prisma.contactMessage.update({
          where: { id: record.id },
          data: { emailSent: true },
        });
      }
    } catch (err) {
      console.error('Contact email delivery failed (message was still saved):', err);
    }

    return res.status(201).json({ success: true });
  }
);

module.exports = router;
