const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Our Sweet Family <invites@oursweetfamily.com>';
const APP_URL = process.env.CLIENT_URL || 'https://oursweetfamily.com';

async function sendInviteEmail({ to, inviteeName, inviterName, familyName, token }) {
  const setupUrl = `${APP_URL}/accept-invite?token=${token}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to ${familyName} on Our Sweet Family</title>
</head>
<body style="margin:0;padding:0;background:#fdf2f8;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf2f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo / header -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img
                src="${APP_URL}/logo.svg"
                alt="Our Sweet Family"
                width="64"
                height="64"
                style="display:block;margin:0 auto 12px;"
              />
              <p style="margin:0;font-size:13px;color:#9ca3af;letter-spacing:0.05em;text-transform:uppercase;font-weight:600;">
                Our Sweet Family
              </p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px 40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;line-height:1.3;">
                You've been invited! 🎉
              </h1>
              <p style="margin:0 0 24px;font-size:16px;color:#6b7280;line-height:1.6;">
                <strong style="color:#111827;">${inviterName}</strong> has invited you to join the
                <strong style="color:#111827;">${familyName}</strong> family on Our Sweet Family —
                a private space for sharing photos, videos, and memories together.
              </p>

              <!-- Family detail pill -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:10px;padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#be185d;text-transform:uppercase;letter-spacing:0.05em;">Family</p>
                    <p style="margin:0;font-size:18px;font-weight:700;color:#111827;">${familyName}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Invited by ${inviterName}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a
                      href="${setupUrl}"
                      style="display:inline-block;background:#ec4899;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:10px;letter-spacing:0.01em;"
                    >
                      Set up my account
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:13px;color:#9ca3af;text-align:center;line-height:1.5;">
                This link expires in <strong>7 days</strong>. If you weren't expecting this invitation, you can safely ignore this email.
              </p>

              <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 24px;" />

              <!-- Fallback URL -->
              <p style="margin:0;font-size:12px;color:#d1d5db;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br />
                <a href="${setupUrl}" style="color:#ec4899;word-break:break-all;">${setupUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © Our Sweet Family · oursweetfamily.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `
You've been invited to ${familyName} on Our Sweet Family!

${inviterName} has invited you to join the ${familyName} family — a private space for sharing photos, videos, and memories together.

Set up your account by visiting the link below (expires in 7 days):
${setupUrl}

If you weren't expecting this invitation, you can safely ignore this email.
`.trim();

  return resend.emails.send({
    from: FROM,
    to,
    subject: `${inviterName} invited you to ${familyName} on Our Sweet Family`,
    html,
    text,
  });
}

module.exports = { sendInviteEmail };
