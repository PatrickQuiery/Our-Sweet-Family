import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useAuth } from '../context/AuthContext';
import { billingClient } from '../lib/billing/revenuecat';
import { checkoutAvailable, managementUrl, syncPurchase } from '../lib/billing/billing';

const PLANS = {
  free: { name: 'Free', features: ['Unlimited compressed photos', '20 GB video storage', 'Annual Memory Reel', 'Share with loved ones'] },
  plus: { name: 'Plus', features: ['200 GB video storage', 'HD photos and original exports', 'Monthly Memory Reels', 'Milestones'] },
  premium: { name: 'Premium', features: ['Everything in Plus', 'Unlimited video storage', 'All Memory Reel types', 'Classified memories'] },
};
const dateLabel = value => {
  const date = value && new Date(value);
  return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : null;
};

export function SubscriptionPanel({ identity, familyId, refresh, client = billingClient }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [offeringError, setOfferingError] = useState('');
  const [choices, setChoices] = useState(null);
  const [period, setPeriod] = useState('monthly');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [message, setMessage] = useState('');
  const alive = useRef(false);
  const locked = useRef(false);
  const statusRef = useRef(null);
  const requestVersion = useRef(0);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const applyStatus = useCallback(next => {
    if (alive.current) { statusRef.current = next; setStatus(next); }
    return next;
  }, []);
  const loadStatus = useCallback(async (sync = false) => {
    if (!alive.current) throw Error('Your account changed.');
    const version = ++requestVersion.current;
    const next = await (sync ? client.sync(familyId) : client.status(familyId));
    if (version === requestVersion.current) applyStatus(next);
    return next;
  }, [client, familyId, applyStatus]);
  useEffect(() => {
    alive.current = true;
    client.setIdentity(identity);
    loadStatus().catch(() => { if (alive.current) setError('We could not load your plan. Please try again.'); });
    const onFocus = () => {
      if (locked.current || document.visibilityState === 'hidden') return;
      loadStatus(Boolean(statusRef.current?.canManage && statusRef.current?.syncAvailable))
        .then(() => { if (alive.current) return refreshRef.current?.(); })
        .catch(() => { if (alive.current) setError('We could not refresh your plan. Please try again.'); });
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      alive.current = false;
      client.setIdentity(null);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [identity, client, loadStatus]);
  const canCheckout = checkoutAvailable(status) && !pending;
  const loadOfferings = useCallback(async () => {
    setOfferingError(''); setChoices(null);
    try {
      const next = await client.offerings(identity);
      if (alive.current) setChoices(next);
    } catch {
      if (alive.current) setOfferingError('We could not load subscription prices. Please try again.');
    }
  }, [client, identity]);
  useEffect(() => {
    if (canCheckout && client.configured) loadOfferings();
  }, [canCheckout, client.configured, loadOfferings]);

  async function reconcile(tier) {
    const result = await syncPurchase(() => loadStatus(true), tier);
    if (!alive.current) return;
    if (result.confirmed) {
      setPending(null);
      setMessage('Your subscription is active. Thank you for supporting your family’s memories!');
      await refreshRef.current?.();
    } else {
      setPending(tier);
      setMessage('Purchase received. We are still confirming your family’s access. Please refresh your purchase in a moment.');
    }
  }
  async function purchase(choice) {
    if (locked.current || !canCheckout) return;
    locked.current = true; setBusy(true); setError(''); setMessage('');
    let purchased = false;
    try {
      // A second tab or native store may have started a subscription since load.
      const latest = await loadStatus(true);
      if (!alive.current || !checkoutAvailable(latest)) return;
      await client.purchase(identity, choice.pkg);
      purchased = true;
      if (!alive.current) return;
      setPending(choice.tier);
      await reconcile(choice.tier);
    } catch (err) {
      if (!alive.current) return;
      if (purchased) {
        setPending(choice.tier);
        setMessage('Purchase received. Refresh your purchase to confirm your family’s access.');
      } else if (!client.isCancellation(err)) {
        setError(err.existingSubscription ? err.message : 'Checkout could not be completed. Please try again.');
        if (err.existingSubscription) await loadStatus(true).catch(() => {});
      }
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function retry() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      if (pending) await reconcile(pending);
      else {
        await loadStatus(Boolean(status?.canManage && status?.syncAvailable));
        if (alive.current) await refreshRef.current?.();
      }
    } catch { if (alive.current) setError('We could not refresh your plan. Please try again.'); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }

  const plan = PLANS[status?.effectivePlan] || PLANS.free;
  const manage = managementUrl(status);
  const paymentIssue = ['billing_issue', 'in_grace'].includes(status?.subscriptionStatus);
  const expires = dateLabel(status?.subscriptionExpiresAt);
  const boost = new Date(status?.planBoostUntil).getTime() > Date.now() ? dateLabel(status.planBoostUntil) : null;
  return (
    <section aria-labelledby="subscription-heading" className="card p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs uppercase tracking-widest text-ink-muted mb-1">More room for your memories</p><h2 id="subscription-heading" className="font-bold text-lg text-ink">Your family’s plan</h2></div>
        {status && <span className="badge bg-primary/10 text-ink font-semibold">{plan.name}</span>}
      </div>
      {!status && !error && <p role="status" className="text-sm text-ink-soft">Loading your plan…</p>}
      {error && <div role="alert" className="space-y-2"><p className="text-sm text-danger">{error}</p><button disabled={busy} onClick={retry} className="btn-secondary text-sm">Try again</button></div>}
      {status && <>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm text-ink-soft">{plan.features.map(feature => <li key={feature} className="flex gap-2"><span aria-hidden="true" className="text-primary">✓</span>{feature}</li>)}</ul>
        {!status.canManage ? <p className="text-sm text-ink-soft">Shared with you and managed by your family owner.</p> : <>
          {paymentIssue && <p role="alert" className="text-sm text-danger">There is a payment issue. Update your payment details to keep your subscription.</p>}
          {expires && <p className="text-sm text-ink-soft">{status.subscriptionWillRenew && !paymentIssue ? 'Renews' : status.hasSubscription ? 'Access ends' : 'Subscription ended'} {expires}.</p>}
          {status.hasSubscription && status.subscriptionWillRenew === false && <p className="text-sm text-ink-soft">Automatic renewal is off. You can keep using your plan until your access ends.</p>}
          {boost && <p className="text-sm text-ink-soft">Your referral reward gives you extra access through {boost}.</p>}
          {status.hasSubscription && <div className="space-y-3">
            {manage ? <a href={manage} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex text-sm">Manage subscription</a> : <p className="text-sm text-ink-soft">Manage your subscription through the store where you purchased it.</p>}
            <p className="text-xs text-ink-muted">Change your plan, update payment details, or cancel renewal with your original provider.</p>
          </div>}
          {canCheckout && <div className="border-t border-border pt-5 space-y-4">
            {!client.configured ? <p className="text-sm text-ink-soft">Web subscriptions are not available yet. Your existing family access is unchanged.</p> : <>
              <div role="group" aria-label="Billing interval" className="inline-flex gap-1 rounded-full bg-ink/5 p-1">{[['monthly', 'Monthly'], ['annual', 'Yearly']].map(([value, label]) => <button key={value} aria-pressed={period === value} disabled={busy} onClick={() => setPeriod(value)} className={`rounded-full px-4 py-2 text-sm font-semibold ${period === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft'}`}>{label}</button>)}</div>
              {offeringError ? <div role="alert"><p className="text-sm text-danger mb-2">{offeringError}</p><button className="btn-secondary text-sm" onClick={loadOfferings}>Retry prices</button></div> : !choices ? <p role="status" className="text-sm text-ink-soft">Loading subscription prices…</p> : <div className="grid sm:grid-cols-2 gap-4">{['plus', 'premium'].map(tier => {
                const matching = choices.filter(choice => choice.tier === tier && choice.period === period);
                const choice = matching.length === 1 ? matching[0] : null;
                return <div key={tier} className="rounded-2xl border border-border bg-surface/50 p-5 space-y-3">
                  <h3 className="font-bold text-ink">{PLANS[tier].name}</h3>
                  {choice && <p className="text-ink"><strong className="text-2xl">{choice.price}</strong><span className="text-xs text-ink-muted"> / {period === 'annual' ? 'year' : 'month'}</span></p>}
                  <ul className="text-xs text-ink-soft space-y-1.5">{PLANS[tier].features.map(feature => <li key={feature}>{feature}</li>)}</ul>
                  <button disabled={!choice || busy} onClick={() => purchase(choice)} className="btn-primary w-full text-sm disabled:opacity-50">{choice ? `Choose ${PLANS[tier].name}` : `${PLANS[tier].name} unavailable`}</button>
                </div>;
              })}</div>}
              <p className="text-xs text-ink-muted">Subscriptions renew automatically until canceled. Final totals and any applicable taxes are shown at checkout. <a href="/privacy" className="underline">Privacy</a></p>
            </>}
          </div>}
          {!status.syncAvailable && !status.hasSubscription && <p className="text-sm text-ink-soft">Subscriptions are temporarily unavailable. Please check back soon.</p>}
          <button onClick={retry} disabled={busy} className="btn-secondary text-sm disabled:opacity-50">{busy ? 'Please wait…' : pending ? 'Refresh purchase' : 'Refresh plan'}</button>
        </>}
      </>}
      {message && <p role="status" className="rounded-xl bg-primary/10 p-4 text-sm text-ink">{message}</p>}
    </section>
  );
}
export default function SubscriptionManagement() {
  const { user: clerkUser, isLoaded } = useUser();
  const { family, loading, refreshFamily, refreshUser } = useAuth();
  if (!isLoaded || loading || !clerkUser?.id) return <div className="card p-6" role="status">Loading your plan…</div>;
  return <SubscriptionPanel key={`${clerkUser.id}:${family?.id || ''}`} identity={clerkUser.id} familyId={family?.id} refresh={() => Promise.all([refreshFamily(), refreshUser()])} />;
}
