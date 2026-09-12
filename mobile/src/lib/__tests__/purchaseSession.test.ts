import { PurchaseSession } from '../purchaseSession';

test('readiness waits for identification and account changes invalidate old results', async () => {
  let finish!: (value: string) => void;
  const session = new PurchaseSession<string>({ login: () => new Promise(r => { finish = r; }), logout: async () => {} });
  const first = session.identify('alice');
  await Promise.resolve();
  expect(session.ready('alice')).toBe(false);
  const second = session.identify(null);
  finish('alice-info');
  await first;
  await second;
  expect(session.ready('alice')).toBe(false);
  expect(session.info).toBe(null);
});

test('serializes switching accounts behind an in-flight purchase and drops its result', async () => {
  const calls: string[] = [];
  const session = new PurchaseSession<string>({ login: async id => { calls.push(id); return id; }, logout: async () => {} });
  await session.identify('alice');
  let finish!: (value: string) => void;
  const purchase = session.run('alice', () => new Promise<string>(r => { finish = r; }));
  await Promise.resolve();
  const switching = session.identify('bob');
  expect(session.ready('bob')).toBe(false);
  finish('purchase');
  await expect(purchase).rejects.toThrow('Account changed');
  await switching;
  expect(calls).toEqual(['alice', 'bob']);
  expect(session.info).toBe('bob');
});

test('rejects all SDK actions before identification and after sign-out', async () => {
  const operation = jest.fn(async () => 'restored');
  const session = new PurchaseSession<string>({ login: async id => id, logout: async () => {} });
  await expect(session.run(null, operation)).rejects.toThrow('not ready');
  await session.identify('alice');
  await session.identify(null);
  await expect(session.run('alice', operation)).rejects.toThrow('not ready');
  expect(operation).not.toHaveBeenCalled();
});

test('failed restore rejects distinctly and preserves identified readiness', async () => {
  const session = new PurchaseSession<string>({ login: async id => id, logout: async () => {} });
  await session.identify('alice');
  await expect(session.run('alice', async () => { throw new Error('Store unavailable'); })).rejects.toThrow('Store unavailable');
  expect(session.ready('alice')).toBe(true);
});

test('a second restore or purchase cannot overlap an active store action', async () => {
  const session = new PurchaseSession<string>({ login: async id => id, logout: async () => {} });
  await session.identify('alice');
  let finish!: (value: string) => void;
  const first = session.action('alice', () => new Promise<string>(r => { finish = r; }));
  await Promise.resolve();
  const duplicate = jest.fn(async () => 'second');
  await expect(session.action('alice', duplicate)).rejects.toThrow('already in progress');
  expect(duplicate).not.toHaveBeenCalled();
  finish('restored');
  await expect(first).resolves.toBe('restored');
  await expect(session.action('alice', duplicate)).resolves.toBe('second');
});
