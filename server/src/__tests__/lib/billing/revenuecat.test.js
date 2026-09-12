const { fetchCustomer } = require('../../../lib/billing/revenuecat');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; delete process.env.REVENUECAT_API_KEY; });
test('fetches only encoded authenticated customer and keeps credential in authorization header', async () => {
  process.env.REVENUECAT_API_KEY = 'server-test-key';
  global.fetch = jest.fn().mockResolvedValue({ ok:true, json:async()=>({subscriber:{}}) });
  await expect(fetchCustomer('user/a?b')).resolves.toEqual({subscriber:{}});
  expect(global.fetch).toHaveBeenCalledWith('https://api.revenuecat.com/v1/subscribers/user%2Fa%3Fb', expect.objectContaining({
    headers: {Authorization:'Bearer server-test-key',Accept:'application/json'}, signal:expect.any(AbortSignal),
  }));
});
test('missing configuration never sends a request', async () => {
  global.fetch = jest.fn();
  await expect(fetchCustomer('user')).rejects.toThrow('not configured');
  expect(global.fetch).not.toHaveBeenCalled();
});
test('remote failure does not expose the response body or key', async () => {
  process.env.REVENUECAT_API_KEY = 'server-test-key';
  global.fetch = jest.fn().mockResolvedValue({ok:false,status:401,json:async()=>({secret:'private'})});
  await expect(fetchCustomer('user')).rejects.toThrow('RevenueCat request failed (401)');
});
