import React from 'react';
import { Link } from 'react-router-dom';
import { SignUp } from '@clerk/clerk-react';

// New accounts land on onboarding to create their family.
export default function Signup() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-50 to-pink-50 px-4 py-10">
      <Link to="/" className="mb-6">
        <img src="/logo.svg" alt="Our Sweet Family" className="w-16 h-16" />
      </Link>
      <SignUp routing="hash" signInUrl="/login" fallbackRedirectUrl="/onboarding" />
    </div>
  );
}
