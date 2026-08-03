import React from 'react';
import { UserProfile } from '@clerk/clerk-react';
import { useAuth } from '../context/AuthContext';

const PLAN_DETAILS = {
  free: {
    name: 'Free',
    color: 'bg-gray-100',
    badge: 'bg-gray-200 text-gray-700',
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
  const { user } = useAuth();
  const plan = PLAN_DETAILS[user?.plan] || PLAN_DETAILS.free;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Current plan (app-specific) */}
      <div className={`card p-6 ${plan.color}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Your Plan</h2>
          <span className={`badge ${plan.badge} font-semibold`}>{plan.name}</span>
        </div>
        <ul className="space-y-1.5 mb-4">
          {plan.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
        {user?.plan !== 'premium' && (
          <div className="flex gap-2">
            {user?.plan === 'free' && <button className="btn-primary text-sm">Upgrade to Plus — $6/mo</button>}
            <button className="btn-secondary text-sm">Upgrade to Premium — $14/mo</button>
          </div>
        )}
      </div>

      {/* Account — Clerk manages profile, email, password, 2FA and connected social accounts */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">Account & Security</h2>
        <UserProfile routing="hash" />
      </div>
    </div>
  );
}
