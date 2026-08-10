import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
// Vite + React app (not Next.js), so import from '@vercel/analytics/react'.
import { Analytics } from '@vercel/analytics/react';
import App from './App.jsx';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  // Fail loudly in dev so setup isn't silently broken. See CLERK_SETUP.md.
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY. Set it from your Clerk dashboard (see CLERK_SETUP.md).');
}

// Luminous "Sunrise" theming for all Clerk surfaces (sign-in/up, UserButton, profile).
const clerkAppearance = {
  variables: {
    colorPrimary: '#ef3f74',
    colorText: '#232a45',
    colorTextSecondary: '#5a627e',
    colorBackground: '#ffffff',
    colorInputBackground: '#ffffff',
    fontFamily: '"Poppins", system-ui, sans-serif',
    borderRadius: '0.9rem',
  },
  elements: {
    card: 'shadow-soft border border-black/5',
    formButtonPrimary:
      'bg-brand-500 hover:bg-brand-600 rounded-full font-semibold normal-case',
    footerActionLink: 'text-brand-600 hover:text-brand-700',
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/" appearance={clerkAppearance}>
      <App />
      <Analytics />
    </ClerkProvider>
  </React.StrictMode>
);
