// The key never leaves the API process. Do not log the response body: it contains
// customer data and may contain a private management link.
async function fetchCustomer(appUserId) {
  const key = process.env.REVENUECAT_API_KEY;
  if (!key) throw new Error('RevenueCat API key is not configured');
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`RevenueCat request failed (${response.status})`);
  return response.json();
}
module.exports = { fetchCustomer };
