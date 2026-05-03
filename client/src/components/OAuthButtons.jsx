import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID;

/**
 * Renders "Continue with Google" and "Continue with Apple" buttons followed
 * by an "or" divider. Pass `redirectTo` to control the post-auth destination.
 *
 * Both providers send their identity token to the backend which issues our own
 * JWT — no provider session is stored client-side.
 */
export default function OAuthButtons({ redirectTo = '/dashboard', onError }) {
  const { loginWithOAuth } = useAuth();
  const navigate = useNavigate();
  const googleRef = useRef(null);
  const [appleLoading, setAppleLoading] = useState(false);

  // ── Google Sign-In (Identity Services) ────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const init = () => {
      if (!window.google || !googleRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(googleRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleRef.current.offsetWidth || 320,
        text: 'continue_with',
        shape: 'rectangular',
      });
    };

    if (window.google) {
      init();
    } else {
      // Script loads async — wait for it
      const script = document.getElementById('google-gsi-script');
      if (script) {
        script.addEventListener('load', init);
        return () => script.removeEventListener('load', init);
      }
    }
  }, []);

  const handleGoogleCredential = async (response) => {
    try {
      await loginWithOAuth('google', { idToken: response.credential });
      navigate(redirectTo);
    } catch (err) {
      onError?.(err.response?.data?.error || 'Google sign-in failed. Please try again.');
    }
  };

  // ── Apple Sign-In ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!APPLE_CLIENT_ID || !window.AppleID) return;
    window.AppleID.auth.init({
      clientId: APPLE_CLIENT_ID,
      scope: 'name email',
      redirectURI: window.location.origin,
      usePopup: true,
    });
  }, []);

  const handleAppleSignIn = async () => {
    if (!window.AppleID) return;
    setAppleLoading(true);
    try {
      const response = await window.AppleID.auth.signIn();
      const idToken = response.authorization?.id_token;
      // Apple only sends name on the very first sign-in
      const name = response.user
        ? `${response.user.name?.firstName || ''} ${response.user.name?.lastName || ''}`.trim() || undefined
        : undefined;
      await loginWithOAuth('apple', { idToken, name });
      navigate(redirectTo);
    } catch (err) {
      if (err?.error !== 'popup_closed_by_user') {
        onError?.(err?.response?.data?.error || 'Apple sign-in failed. Please try again.');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  // Don't render the section at all when neither provider is configured
  const googleEnabled = Boolean(GOOGLE_CLIENT_ID);
  const appleEnabled = Boolean(APPLE_CLIENT_ID && window.AppleID);
  if (!googleEnabled && !appleEnabled) return null;

  return (
    <>
      <div className="space-y-3">
        {googleEnabled && (
          <div ref={googleRef} className="w-full" />
        )}

        {appleEnabled && (
          <button
            type="button"
            onClick={handleAppleSignIn}
            disabled={appleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm font-medium text-gray-700 disabled:opacity-60"
          >
            {/* Apple logo */}
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            {appleLoading ? 'Signing in…' : 'Continue with Apple'}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 my-4">
        <hr className="flex-1 border-gray-200" />
        <span className="text-xs text-gray-400 font-medium">or</span>
        <hr className="flex-1 border-gray-200" />
      </div>
    </>
  );
}
