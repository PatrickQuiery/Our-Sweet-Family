const { reverseGeocode } = require('../../lib/geocode');

describe('reverseGeocode', () => {
  afterEach(() => { global.fetch = undefined; });

  it('returns city and state from a Nominatim response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: { city: 'Brooklyn', state: 'New York', country: 'United States' } }),
    });

    const res = await reverseGeocode(40.6782, -73.9442);
    expect(res).toEqual({ city: 'Brooklyn', state: 'New York' });
    // must send a User-Agent (Nominatim requires it)
    const opts = global.fetch.mock.calls[0][1];
    expect(opts.headers['User-Agent']).toBeTruthy();
  });

  it('falls back to town/village when city is absent', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: { town: 'Montauk', state: 'New York' } }),
    });
    const res = await reverseGeocode(41.0, -71.9);
    expect(res).toEqual({ city: 'Montauk', state: 'New York' });
  });

  it('returns null on a failed request', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    expect(await reverseGeocode(1, 2)).toBeNull();
  });

  it('returns null (never throws) when fetch errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    expect(await reverseGeocode(1, 2)).toBeNull();
  });

  it('returns null for invalid coordinates', async () => {
    expect(await reverseGeocode(null, undefined)).toBeNull();
  });
});
