import React from 'react';
const { act, create } = require('react-test-renderer');
async function renderHook<T>(hook: () => T) {
  const result = { current: undefined as T };
  function Harness() { result.current = hook(); return null; }
  let tree: any;
  await act(async () => { tree = create(React.createElement(Harness)); });
  return { result, rerender: async (_props: unknown) => { await act(async () => tree.update(React.createElement(Harness))); } };
}
async function waitFor(assert: () => void) { await act(async () => {}); assert(); }
import { AppState, type AppStateStatus } from 'react-native';
import { useBilling } from '../useBilling';
let mockUserId = 'alice';
let mockFamily = 'family-a';
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockRefreshFamily = jest.fn(async () => {});
const mockApi = { get: mockGet, post: mockPost };
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockUserId }) }));
jest.mock('../useApi', () => ({ useApi: () => mockApi }));
jest.mock('../../context/FamilyProvider', () => ({ useFamily: () => ({ activeFamilyId: mockFamily, refresh: mockRefreshFamily }) }));
const status = { effectivePlan: 'plus', canManage: true, syncAvailable: true, hasSubscription: true };
beforeEach(() => { jest.clearAllMocks(); mockUserId = 'alice'; mockFamily = 'family-a'; mockGet.mockResolvedValue(status); mockPost.mockResolvedValue(status); });
test('hides previous account status and rejects stale refresh callers', async () => {
  const { result, rerender } = await renderHook(() => useBilling());
  await waitFor(() => expect(result.current.status).toEqual(status));
  let finish!: (value: unknown) => void;
  mockGet.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  let old!: Promise<unknown>;
  await act(async () => { old = result.current.refresh(); });
  mockUserId = 'bob'; mockGet.mockResolvedValue({ ...status, canManage: false });
  await rerender({});
  finish(status);
  await expect(old).rejects.toThrow('changed');
  await waitFor(() => expect(result.current.status?.canManage).toBe(false));
});
test('owner return from store refreshes through trusted POST sync', async () => {
  let foreground!: (next: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { foreground = callback; return { remove: jest.fn() }; });
  await renderHook(() => useBilling());
  await act(async () => { foreground('active'); });
  expect(mockPost).toHaveBeenCalledWith('/billing/sync?familyId=family-a');
  expect(mockRefreshFamily).toHaveBeenCalled();
});
test('unconfigured sync stays pending with a retryable error', async () => {
  mockPost.mockRejectedValue(new Error('503'));
  const { result } = await renderHook(() => useBilling());
  await act(async () => { await expect(result.current.sync(true)).rejects.toThrow('503'); });
  expect(result.current.pending).toBe(true);
  expect(result.current.error).toContain('Retry');
});
test('an old sync closure cannot post after family changes', async () => {
  const { result, rerender } = await renderHook(() => useBilling());
  const oldSync = result.current.sync;
  mockFamily = 'family-b';
  await rerender({});
  await expect(oldSync(true)).rejects.toThrow('changed');
  expect(mockPost).not.toHaveBeenCalled();
});
test('foreground sync cannot erase a pending purchase without paid access', async () => {
  let foreground!: (next: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { foreground = callback; return { remove: jest.fn() }; });
  mockPost.mockResolvedValue({ ...status, hasSubscription: false });
  const { result } = await renderHook(() => useBilling());
  await act(async () => { await expect(result.current.sync(true)).rejects.toThrow('pending'); });
  await act(async () => { foreground('active'); });
  expect(result.current.pending).toBe(true);
  expect(result.current.error).toContain('Retry');
});
test('confirmation requires the purchased tier, not any subscription', async () => {
  mockPost.mockResolvedValue({ ...status, plan: 'plus' });
  const { result } = await renderHook(() => useBilling());
  await act(async () => { await expect(result.current.sync(true, 'premium')).rejects.toThrow('pending'); });
  expect(result.current.pending).toBe(true);
  mockPost.mockResolvedValue({ ...status, plan: 'premium' });
  await act(async () => { await result.current.sync(true); });
  expect(result.current.pending).toBe(false);
});
