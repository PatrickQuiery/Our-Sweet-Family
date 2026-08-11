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
// colorNeutral seeds Clerk's entire derived gray scale — setting it to ink gives every
// border, muted label, and hover a warm Sunrise undertone instead of flat gray.
const clerkAppearance = {
  variables: {
    colorPrimary: '#ef3f74',
    colorText: '#232a45',
    colorTextSecondary: '#5a627e',
    colorNeutral: '#232a45',
    colorBackground: '#ffffff',
    colorInputText: '#232a45',
    colorInputBackground: '#ffffff',
    colorShimmer: 'rgba(239,63,116,0.08)',
    fontFamily: '"Poppins", system-ui, sans-serif',
    borderRadius: '0.9rem',
  },
  elements: {
    card: 'shadow-soft border border-black/5',
    formButtonPrimary:
      'bg-brand-500 hover:bg-brand-600 rounded-full font-semibold normal-case',
    footerActionLink: 'text-brand-600 hover:text-brand-700',
    // UserProfile / Account panel (mounted in Settings and the UserButton modal)
    navbar: 'bg-gradient-to-b from-brand-50/70 to-white border-r border-black/5',
    navbarButton: 'text-ink-soft hover:text-ink',
    headerTitle: 'text-ink',
    headerSubtitle: 'text-ink-soft',
    profileSectionTitleText: 'text-ink',
    formFieldLabel: 'text-ink-soft',
    badge: 'bg-brand-50 text-brand-700',
    avatarBox: 'rounded-full',
    // UserButton dropdown
    userButtonPopoverCard: 'shadow-soft border border-black/5 rounded-2xl',
    userButtonPopoverActionButton: 'text-ink-soft hover:bg-brand-50 hover:text-ink',
    userButtonPopoverActionButtonText: 'text-ink-soft',
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
