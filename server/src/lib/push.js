const prisma = require('./prisma');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Build Expo push messages from raw tokens (filters out anything not an Expo token). */
function buildMessages(tokens, { title, body, data }) {
  return (tokens || [])
    .filter((to) => typeof to === 'string' && to.startsWith('ExponentPushToken'))
    .map((to) => ({ to, title, body, data: data || {}, sound: 'default' }));
}

/**
 * Send a push notification to every registered device of the given users via Expo's
 * push service. Best-effort by design: a failed push must never break the API action
 * that triggered it, so this catches everything and resolves with a count.
 */
async function sendPushToUsers(userIds, { title, body, data } = {}) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (ids.length === 0) return { sent: 0 };

    const rows = await prisma.deviceToken.findMany({
      where: { userId: { in: ids } },
      select: { token: true },
    });
    const messages = buildMessages(
      rows.map((r) => r.token),
      { title, body, data },
    );
    if (messages.length === 0) return { sent: 0 };

    // Expo accepts up to 100 messages per request.
    let sent = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(chunk),
        });
        if (res.ok) sent += chunk.length;
        else console.error('Expo push HTTP', res.status);
      } catch (err) {
        console.error('Expo push error:', err.message);
      }
    }
    return { sent };
  } catch (err) {
    console.error('sendPushToUsers failed:', err.message);
    return { sent: 0 };
  }
}

module.exports = { sendPushToUsers, buildMessages, EXPO_PUSH_URL };
