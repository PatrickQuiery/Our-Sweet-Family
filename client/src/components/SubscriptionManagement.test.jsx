// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { SubscriptionPanel } from './SubscriptionManagement';
afterEach(cleanup);
const free = { effectivePlan: 'free', plan: 'free', canManage: true, syncAvailable: true, hasSubscription: false };
const choices = [
  { tier: 'plus', period: 'monthly', price: '$6.10', pkg: { identifier: 'plus_monthly' } },
  { tier: 'plus', period: 'annual', price: '$61.00', pkg: { identifier: 'plus_annual' } },
];
const clientFor = (status = free) => ({ configured: true, setIdentity: vi.fn(), status: vi.fn().mockResolvedValue(status), sync: vi.fn().mockResolvedValue(status), offerings: vi.fn().mockResolvedValue(choices), purchase: vi.fn().mockResolvedValue({}), isCancellation: e => e.errorCode === 1 });
const mount = client => render(<SubscriptionPanel identity="user_a" familyId="family_a" refresh={vi.fn()} client={client} />);
describe('subscription settings', () => {
  it('shows shared access without loading checkout or revealing management', async () => {
    const client = clientFor({ ...free, effectivePlan: 'plus', canManage: false });
    mount(client);
    expect(await screen.findByText(/managed by your family owner/i)).toBeTruthy();
    expect(client.offerings).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /choose plus/i })).toBeNull();
  });
  it('routes existing Apple subscriptions to management and never loads checkout', async () => {
    const client = clientFor({ ...free, hasSubscription: true, effectivePlan: 'plus', subscriptionStore: 'APP_STORE' });
    mount(client);
    expect((await screen.findByRole('link', { name: /manage subscription/i })).href).toBe('https://apps.apple.com/account/subscriptions');
    expect(client.offerings).not.toHaveBeenCalled();
  });
  it('warns during payment grace and labels its deadline as access end, not renewal', async () => {
    mount(clientFor({ ...free, hasSubscription: true, effectivePlan: 'plus', subscriptionStatus: 'in_grace', subscriptionWillRenew: true, subscriptionExpiresAt: '2026-12-20T12:00:00Z' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/payment issue/i)).toBeTruthy();
    expect(screen.getByText(/Access ends/)).toBeTruthy();
    expect(screen.queryByText(/Renews/)).toBeNull();
  });
  it('shows live prices, changes interval and blocks missing packages', async () => {
    mount(clientFor());
    expect(await screen.findByText('$6.10')).toBeTruthy();
    expect(screen.getByRole('button', { name: /premium unavailable/i }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }));
    expect(screen.getByText('$61.00')).toBeTruthy();
  });
  it('shows honest unconfigured state', async () => {
    const client = clientFor(); client.configured = false;
    mount(client);
    expect(await screen.findByText(/web subscriptions are not available yet/i)).toBeTruthy();
    expect(client.offerings).not.toHaveBeenCalled();
  });
  it('keeps successful checkout pending and disables another purchase on failed sync', async () => {
    const client = clientFor();
    client.sync.mockResolvedValueOnce(free).mockRejectedValue(Error('unavailable'));
    mount(client);
    fireEvent.click(await screen.findByRole('button', { name: /choose plus/i }));
    expect(await screen.findByText(/purchase received/i, {}, { timeout: 7000 })).toBeTruthy();
    expect(client.purchase).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /choose plus/i })).toBeNull();
    expect(screen.getByRole('button', { name: /refresh purchase/i })).toBeTruthy();
  }, 10000);
  it('cancellation does not show purchase failure', async () => {
    const client = clientFor(); client.purchase.mockRejectedValue({ errorCode: 1 });
    mount(client);
    fireEvent.click(await screen.findByRole('button', { name: /choose plus/i }));
    await waitFor(() => expect(client.purchase).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('button', { name: /choose plus/i }).disabled).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
