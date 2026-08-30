import React, { useState } from 'react';
import { UserProfile } from '@clerk/clerk-react';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/DialogProvider';
import api from '../lib/api';

const LOCATION_CONFIRM =
  "Turn on photo location?\n\n" +
  "Your photos already contain the GPS location where they were taken. This setting only controls whether that location is SHOWN in the app.\n\n" +
  "• When ON, you (the family owner) will see where each photo was taken on its detail page.\n" +
  "• It is never shown to invited loved ones.\n\n" +
  "Heads up: a photo's location can reveal sensitive places like your home or your child's school. Only turn this on if you're comfortable seeing that.\n\n" +
  "Enable photo location?";

const PLAN_DETAILS = {
  free: {
    name: 'Free',
    color: 'bg-ink/5',
    badge: 'bg-ink/10 text-ink-soft',
    features: ['Unlimited photos (compressed)', '20GB video', 'Annual Memory Reel', 'Loved one access'],
  },
  plus: {
    name: 'Plus',
    color: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    features: ['Everything in Free', '200GB video', 'HD photos', 'Monthly Reels', 'Milestones', 'Export originals'],
  },
  premium: {
    name: 'Premium',
    color: 'bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
    features: ['Everything in Plus', 'Unlimited video', 'All Reel types', 'AI face tagging', 'Classified memories'],
  },
};

export default function Settings() {
  const confirm = useConfirm();
  const toast = useToast();
  const { user, family, refreshFamily } = useAuth();
  const plan = PLAN_DETAILS[user?.plan] || PLAN_DETAILS.free;
  const isOwner = user?.role === 'owner';
  const locationOn = !!family?.showPhotoLocation;
  const [savingLoc, setSavingLoc] = useState(false);

  const toggleLocation = async () => {
    const next = !locationOn;
    // Only confirm when turning it ON (enabling a sensitive display).
    if (next) {
      const ok = await confirm({ title: 'Show photo locations?', message: LOCATION_CONFIRM, confirmLabel: 'Enable' });
      if (!ok) return;
    }
    setSavingLoc(true);
    try {
      await api.patch(`/families/${family.id}/settings`, { showPhotoLocation: next });
      await refreshFamily();
    } catch (err) {
      toast(err.response?.data?.error || 'Could not update the setting', 'error');
    } finally {
      setSavingLoc(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="type-title text-ink">Settings</h1>

      {/* Current plan (app-specific) */}
      <div className={`card p-6 ${plan.color}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-ink">Your Plan</h2>
          <span className={`badge ${plan.badge} font-semibold`}>{plan.name}</span>
        </div>
        <ul className="space-y-1.5 mb-4">
          {plan.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-ink-soft">
              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
        {user?.plan !== 'premium' && (
          <div className="flex gap-2">
            {user?.plan === 'free' && <button className="btn-primary text-sm">Upgrade to Plus — $5.99/mo</button>}
            <button className="btn-secondary text-sm">Upgrade to Premium — $13.99/mo</button>
          </div>
        )}
      </div>

      {/* Privacy — photo location (owner only) */}
      {isOwner && (
        <div className="card p-6">
          <h2 className="font-bold text-ink mb-4">Privacy</h2>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-ink">Show photo location</p>
              <p className="text-sm text-ink-muted mt-1 max-w-md">
                Show where each photo was taken (from its GPS metadata) on the photo's page — visible
                to you only, never to invited loved ones. Off by default.
              </p>
              <p className="text-xs text-ink-muted mt-1.5">
                Location is always saved with your photos; this only controls whether it's shown.
              </p>
            </div>
            <button
              onClick={toggleLocation}
              disabled={savingLoc}
              role="switch"
              aria-checked={locationOn}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                locationOn ? 'bg-brand-500' : 'bg-ink/15'
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                locationOn ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      )}

      {/* Account — Clerk manages profile, email, password, 2FA and connected social accounts */}
      <div>
        <h2 className="font-bold text-ink mb-3">Account & Security</h2>
        <UserProfile routing="hash" />
      </div>
    </div>
  );
}
