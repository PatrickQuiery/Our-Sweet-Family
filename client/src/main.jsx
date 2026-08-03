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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <App />
      <Analytics />
    </ClerkProvider>
  </React.StrictMode>
);
