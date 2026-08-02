import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [state, setState] = useState('loading'); // loading | ready | invalid | done | existing
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState({ name: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState('invalid'); setError('This invitation link is missing its token.'); return; }
    api.get(`/invitations/${token}`)
      .then(({ data }) => {
        setInfo(data);
        setForm((f) => ({ ...f, name: (data.email || '').split('@')[0] }));
        setState('ready');
      })
      .catch((err) => {
        setState('invalid');
        setError(err.response?.data?.error || 'This invitation is no longer valid.');
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post(`/invitations/${token}/accept`, {
        name: form.name,
        password: form.password,
      });
      if (data.existingAccount) {
        setState('existing');
        return;
      }
      // Log the new loved one in and take them to the dashboard.
      localStorage.setItem('token', data.token);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.error ||
        'Could not accept the invitation.'
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-50 to-pink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/logo.svg" alt="Our Sweet Family" className="w-16 h-16" />
          </Link>
        </div>

        <div className="card p-6">
          {state === 'loading' && (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
            </div>
          )}

          {state === 'invalid' && (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">🔗</div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Invitation unavailable</h1>
              <p className="text-gray-500 text-sm mb-6">{error}</p>
              <Link to="/login" className="btn-primary">Go to sign in</Link>
            </div>
          )}

          {state === 'existing' && (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">👋</div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">You're all set</h1>
              <p className="text-gray-500 text-sm mb-6">
                You already have an account, and you've been added to {info?.familyName || 'the family'}. Please sign in.
              </p>
              <Link to="/login" className="btn-primary">Sign in</Link>
            </div>
          )}

          {state === 'ready' && (
            <>
              <div className="text-center mb-5">
                <h1 className="text-2xl font-bold text-gray-900">You're invited!</h1>
                <p className="text-gray-500 mt-1 text-sm">
                  <span className="font-medium">{info.inviterName}</span> invited you to join{' '}
                  <span className="font-medium">{info.familyName}</span>. Set a password to accept.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input type="email" className="input bg-gray-50" value={info.email} disabled />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
                  <input type="text" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoComplete="name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Create a password</label>
                  <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 8 characters" required autoComplete="new-password" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
                  <input type="password" className="input" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required autoComplete="new-password" />
                </div>
                <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
                  {submitting ? 'Accepting...' : 'Accept & join'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
