import React from 'react';
import { Link } from 'react-router-dom';
import { SignIn } from '@clerk/clerk-react';

// Clerk renders email/password + the enabled social providers (Google/Apple/Facebook),
// with password strength + breach detection handled for us.
export default function Login() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sunrise px-4 py-10">
      <Link to="/" className="mb-7 bg-white rounded-3xl shadow-soft p-3">
        <img src="/logo.svg" alt="Our Sweet Family" className="w-24 h-24 object-contain" />
      </Link>
      <SignIn routing="hash" signUpUrl="/signup" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
