import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();

  const [inviteInfo, setInviteInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ name: '', password: '', confirmPassword: '' });
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load invite details on mount
  useEffect(() => {
    if (!token) {
      setLoadError('This invite link is missing a token.');
      return;
    }
    api.get(`/auth/invite-info?token=${token}`)
      .then(({ data }) => {
        setInviteInfo(data);
        setForm((f) => ({ ...f, name: data.email.split('@')[0] }));
      })
      .catch((err) => {
        setLoadError(err.response?.data?.error || 'This invite link is invalid or has expired.');
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (form.password !== form.confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setSubmitError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/accept-invite', {
        token,
        name: form.name.trim(),
        password: form.password,
      });
      // Log the user straight in using the returned JWT
      localStorage.setItem('token', data.token);
      window.location.href = '/dashboard';
    } catch (err) {
      setSubmitError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // ── Invalid / expired token ──────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-50 to-pink-50 px-4">
        <div className="w-full max-w-sm text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/logo.svg" alt="Our Sweet Family" className="w-16 h-16" />
          </Link>
          <div className="card p-8">
            <div className="text-4xl mb-4">🔗</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Link unavailable</h1>
            <p className="text-gray-500 text-sm mb-6">{loadError}</p>
            <p className="text-sm text-gray-500">
              Ask the family owner to send you a new invitation.
            </p>
          </div>
          <p className="text-center mt-4 text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (!inviteInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-pink-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  // ── Setup form ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-50 to-pink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/logo.svg" alt="Our Sweet Family" className="w-16 h-16" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Set up your account</h1>
          <p className="text-gray-500 mt-1 text-sm">
            You've been invited to the{' '}
            <span className="font-semibold text-gray-700">{inviteInfo.familyName}</span> family
            {inviteInfo.inviterName ? ` by ${inviteInfo.inviterName}` : ''}.
          </p>
        </div>

        <div className="card p-6">
          {/* Invite context pill */}
          <div className="bg-pink-50 border border-pink-100 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">{inviteInfo.familyName}</p>
              <p className="text-xs text-gray-500">Invited by {inviteInfo.inviterName}</p>
            </div>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
              <input
                type="text"
                className="input"
                placeholder="Alex Johnson"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                className="input bg-gray-50"
                value={inviteInfo.email}
                readOnly
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Choose a password</label>
              <input
                type="password"
                className="input"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
              <input
                type="password"
                className="input"
                placeholder="Repeat your password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? 'Setting up account…' : 'Join family & sign in'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4 text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
