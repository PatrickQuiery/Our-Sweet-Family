import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { AuthProvider } from './context/AuthContext';

// Landing is the signed-out first paint — keep it eager so the marketing hero
// renders instantly. Everything else is route-split (PF-1) to shrink the initial
// bundle; each page loads on navigation behind the <Suspense> fallback below.
import Landing from './pages/Landing';
import AppLayout from './components/AppLayout';

const Contact = lazy(() => import('./pages/Contact'));
const Privacy = lazy(() => import('./pages/Privacy'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Activity = lazy(() => import('./pages/Activity'));
const Upload = lazy(() => import('./pages/Upload'));
const MemoryDetail = lazy(() => import('./pages/MemoryDetail'));
const Children = lazy(() => import('./pages/Children'));
const Family = lazy(() => import('./pages/Family'));
const Reels = lazy(() => import('./pages/Reels'));
const Milestones = lazy(() => import('./pages/Milestones'));
const Settings = lazy(() => import('./pages/Settings'));
const Referrals = lazy(() => import('./pages/Referrals'));

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useClerkAuth();
  if (!isLoaded) return <Spinner />;
  if (!isSignedIn) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { isLoaded, isSignedIn } = useClerkAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route
        path="/onboarding"
        element={<ProtectedRoute><Onboarding /></ProtectedRoute>}
      />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/memories/:id" element={<MemoryDetail />} />
        <Route path="/children" element={<Children />} />
        <Route path="/family" element={<Family />} />
        <Route path="/reels" element={<Reels />} />
        <Route path="/milestones" element={<Milestones />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/refer" element={<Referrals />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
