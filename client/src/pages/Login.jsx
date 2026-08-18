import React from 'react';
import { Link } from 'react-router-dom';
import { SignIn } from '@clerk/clerk-react';

// Clerk renders email/password + the enabled social providers (Google/Apple/Facebook),
// with password strength + breach detection handled for us.
export default function Login() {
  return (
    <div className="theme-light min-h-screen flex flex-col items-center justify-center bg-sunrise px-4 py-10">
      <Link to="/" className="mb-8">
        <img src="/brand/osf-5-compact-sunrise.svg" alt="Our Sweet Family" className="h-32 w-auto" />
      </Link>
      <SignIn routing="hash" signUpUrl="/signup" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
