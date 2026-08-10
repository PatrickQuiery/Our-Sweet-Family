import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth as useClerkAuth, SignUp } from '@clerk/clerk-react';
import api from '../lib/api';

// Flow: fetch invite info (public) → if the visitor isn't signed in, show Clerk
// <SignUp/> with the invited email prefilled and redirect back here after auth →
// once signed in, POST /claim to link membership, then go to the dashboard.
export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { isLoaded, isSignedIn } = useClerkAuth();
  const navigate = useNavigate();

  const [info, setInfo] = useState(null);
  const [state, setState] = useState('loading'); // loading | invalid | ready
  const [error, setError] = useState('');
  const claiming = useRef(false);

  useEffect(() => {
    if (!token) { setState('invalid'); setError('This invitation link is missing its token.'); return; }
    api.get(`/invitations/${token}`)
      .then(({ data }) => { setInfo(data); setState('ready'); })
      .catch((err) => { setState('invalid'); setError(err.response?.data?.error || 'This invitation is no longer valid.'); });
  }, [token]);

  useEffect(() => {
    if (state !== 'ready' || !isLoaded || !isSignedIn || claiming.current) return;
    claiming.current = true;
    api.post(`/invitations/${token}/claim`)
      // Full navigation (not SPA) so AuthContext re-initializes and re-fetches the
      // families list — the membership was just created, and the in-memory family
      // state predates it (otherwise the dashboard shows "set up your family").
      .then(() => { window.location.href = '/dashboard'; })
      .catch((err) => {
        claiming.current = false;
        setState('invalid');
        setError(err.response?.data?.error || 'Could not accept the invitation.');
      });
  }, [state, isLoaded, isSignedIn, token, navigate]);

  const redirectBack = `/accept-invite?token=${token}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sunrise px-4 py-10">
      <Link to="/" className="mb-8">
        <img src="/brand/osf-5-compact-sunrise.svg" alt="Our Sweet Family" className="h-28 w-auto" />
      </Link>

      {state === 'loading' && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />}

      {state === 'invalid' && (
        <div className="card p-6 max-w-sm text-center">
          <div className="text-4xl mb-3">🔗</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invitation unavailable</h1>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <Link to="/login" className="btn-primary">Go to sign in</Link>
        </div>
      )}

      {state === 'ready' && (
        <>
          <div className="text-center mb-5 max-w-sm">
            <h1 className="text-2xl font-bold text-gray-900">You're invited!</h1>
            <p className="text-gray-500 mt-1 text-sm">
              <span className="font-medium">{info.inviterName}</span> invited you to join{' '}
              <span className="font-medium">{info.familyName}</span>.
            </p>
          </div>
          {isSignedIn ? (
            <div className="card p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto" />
              <p className="text-sm text-gray-500 mt-3">Joining {info.familyName}…</p>
            </div>
          ) : (
            <SignUp
              routing="hash"
              initialValues={{ emailAddress: info.email }}
              signInUrl="/login"
              forceRedirectUrl={redirectBack}
              signInForceRedirectUrl={redirectBack}
            />
          )}
        </>
      )}
    </div>
  );
}
