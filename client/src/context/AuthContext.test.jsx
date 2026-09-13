// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
const mocks = vi.hoisted(() => ({ identity: 'user_a', get: vi.fn() }));
vi.mock('@clerk/clerk-react', () => ({ useAuth: () => ({ isLoaded: true, isSignedIn: Boolean(mocks.identity) }), useUser: () => ({ user: mocks.identity ? { id: mocks.identity } : null }) }));
vi.mock('../lib/api', () => ({ default: { get: mocks.get } }));
afterEach(cleanup);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function State() {
  const { user, family, loading } = useAuth();
  return <div>{loading ? 'loading' : `${user?.id || 'none'}:${family?.id || 'none'}`}</div>;
}
it('discards previous-account auth responses while the new family loads', async () => {
  const oldUser = deferred();
  const newUser = deferred();
  const newFamily = deferred();
  mocks.identity = 'user_a';
  mocks.get.mockReset().mockReturnValueOnce(oldUser.promise).mockReturnValueOnce(newUser.promise).mockReturnValueOnce(newFamily.promise);
  const view = render(<AuthProvider><State /></AuthProvider>);
  mocks.identity = 'user_b';
  view.rerender(<AuthProvider><State /></AuthProvider>);
  await act(async () => { newUser.resolve({ data: { user: { id: 'local_b' } } }); });
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(3));
  await act(async () => { oldUser.resolve({ data: { user: { id: 'local_a' } } }); });
  await act(async () => { newFamily.resolve({ data: { families: [{ id: 'family_b' }] } }); });
  expect(await screen.findByText('local_b:family_b')).toBeTruthy();
  expect(screen.queryByText(/local_a/)).toBeNull();
});
