import { purchaseWithFreshStatus } from '../purchasePreflight';
const empty = { activeSubscriptions: [] as string[], entitlements: { active: {} } };
test.each([
  { ...empty, activeSubscriptions: ['existing_product'] },
  { ...empty, entitlements: { active: { premium: {} } } },
])('fresh customer subscription prevents opening another checkout', async info => {
  const purchase = jest.fn(async () => 'purchased');
  const invalidate = jest.fn(async () => {});
  const read = jest.fn(async () => info);
  const accept = jest.fn();
  await expect(purchaseWithFreshStatus({ invalidate, read, purchase, accept, isCurrent: () => true })).rejects.toThrow('Manage');
  expect(invalidate).toHaveBeenCalled();
  expect(read).toHaveBeenCalled();
  expect(accept).toHaveBeenCalledWith(info);
  expect(purchase).not.toHaveBeenCalled();
});
test('a switch during fresh status lookup cannot start a purchase', async () => {
  const purchase = jest.fn(async () => 'purchased');
  let current = true;
  await expect(purchaseWithFreshStatus({ invalidate: async () => {}, read: async () => { current = false; return empty; }, purchase, accept: jest.fn(), isCurrent: () => current })).rejects.toThrow('Account changed');
  expect(purchase).not.toHaveBeenCalled();
});
test('fresh unentitled customer can purchase after the preflight', async () => {
  await expect(purchaseWithFreshStatus({ invalidate: async () => {}, read: async () => empty, purchase: async () => 'purchased', accept: jest.fn(), isCurrent: () => true })).resolves.toBe('purchased');
});
