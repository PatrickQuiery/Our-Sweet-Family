// Reverse-geocode a lat/lng to { city, state } using OpenStreetMap's Nominatim.
// Called ONCE at upload (the result is stored on the memory), so this never runs
// on read. Coarse (city-level), best-effort, and never throws.
//
// Nominatim usage policy: send a valid User-Agent and keep volume low — one call
// per uploaded photo that has GPS is well within limits.
async function reverseGeocode(lat, lon) {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=10&addressdetails=1`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    let res;
    try {
      res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'OurSweetFamily/1.0 (contact@oursweetfamily.com)',
          Accept: 'application/json',
        },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;

    const data = await res.json();
    const a = data.address || {};
    const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || null;
    const state = a.state || a.region || a.state_district || null;
    if (!city && !state) return null;
    return { city: city || null, state: state || null };
  } catch {
    return null;
  }
}

module.exports = { reverseGeocode };
