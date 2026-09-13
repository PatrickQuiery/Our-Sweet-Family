import React, { useState } from 'react';
import { UserProfile } from '@clerk/clerk-react';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/DialogProvider';
import api from '../lib/api';
import SubscriptionManagement from '../components/SubscriptionManagement';

const LOCATION_CONFIRM =
  "Turn on photo location?\n\n" +
  "Your photos already contain the GPS location where they were taken. This setting only controls whether that location is SHOWN in the app.\n\n" +
  "• When ON, you (the family owner) will see where each photo was taken on its detail page.\n" +
  "• It is never shown to invited loved ones.\n\n" +
  "Heads up: a photo's location can reveal sensitive places like your home or your child's school. Only turn this on if you're comfortable seeing that.\n\n" +
  "Enable photo location?";

export default function Settings() {
  const confirm = useConfirm();
  const toast = useToast();
  const { user, family, refreshFamily } = useAuth();
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

      <SubscriptionManagement />

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
