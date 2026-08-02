import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const PLAN_DETAILS = {
  free: {
    name: 'Free',
    color: 'bg-gray-100',
    badge: 'bg-gray-200 text-gray-700',
    storage: '20GB video',
    features: ['Unlimited photos (compressed)', '20GB video', 'Annual Memory Reel', 'Loved one access'],
  },
  plus: {
    name: 'Plus',
    color: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    storage: '200GB video',
    features: ['Everything in Free', '200GB video', 'HD photos', 'Monthly Reels', 'Milestones', 'Export originals'],
  },
  premium: {
    name: 'Premium',
    color: 'bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
    storage: 'Unlimited',
    features: ['Everything in Plus', 'Unlimited video', 'All Reel types', 'AI face tagging', 'Classified memories'],
  },
};

export default function Settings() {
  const { user, logout, updateUser } = useAuth();
  const [nameForm, setNameForm] = useState({ name: user?.name || '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [nameSuccess, setNameSuccess] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [nameError, setNameError] = useState('');
  const [pwError, setPwError] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const plan = PLAN_DETAILS[user?.plan] || PLAN_DETAILS.free;

  const handleNameSave = async (e) => {
    e.preventDefault();
    setSavingName(true);
    setNameError('');
    setNameSuccess('');
    try {
      const { data } = await api.patch('/auth/me', { name: nameForm.name });
      updateUser({ name: data.user.name });
      setNameSuccess('Name updated successfully!');
    } catch (err) {
      setNameError(
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.error ||
        'Could not update your name.'
      );
    } finally {
      setSavingName(false);
    }
  };

  const handlePwSave = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwError('Passwords do not match.');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwSuccess('Password changed successfully!');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwError(
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.error ||
        'Could not change your password.'
      );
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Current plan */}
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
            {user?.plan === 'free' && (
              <button className="btn-primary text-sm">Upgrade to Plus — $6/mo</button>
            )}
            <button className="btn-secondary text-sm">Upgrade to Premium — $14/mo</button>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="card p-6">
        <h2 className="font-bold text-gray-900 mb-4">Profile</h2>
        <form onSubmit={handleNameSave} className="space-y-4">
          {nameSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">{nameSuccess}</div>}
          {nameError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{nameError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Display name</label>
            <input
              type="text"
              className="input"
              value={nameForm.name}
              onChange={(e) => setNameForm({ name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input type="email" className="input bg-gray-50" value={user?.email} disabled />
          </div>
          <button type="submit" className="btn-primary text-sm" disabled={savingName}>
            {savingName ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="card p-6">
        <h2 className="font-bold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handlePwSave} className="space-y-4">
          {pwSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">{pwSuccess}</div>}
          {pwError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{pwError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Current password</label>
            <input type="password" className="input" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
            <input type="password" className="input" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} minLength={8} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
            <input type="password" className="input" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required />
          </div>
          <button type="submit" className="btn-primary text-sm" disabled={savingPw}>
            {savingPw ? 'Saving...' : 'Change password'}
          </button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="card p-6 border-red-200">
        <h2 className="font-bold text-red-700 mb-4">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 text-sm">Sign out of all devices</p>
            <p className="text-xs text-gray-500">You will need to sign in again on all your devices.</p>
          </div>
          <button onClick={logout} className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
