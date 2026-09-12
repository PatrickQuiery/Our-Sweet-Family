import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import api from '../lib/api';
import { clearFeedCache } from '../lib/feedCache';

const AuthContext = createContext(null);

// Clerk owns authentication (session, password, social, MFA). This context layers on
// the app-specific identity: the local user row (role/plan) synced from Clerk, and the
// active family. It keeps the previous interface (user, family, loading, refreshFamily,
// logout) so the rest of the app is unchanged.
export function AuthProvider({ children }) {
  const { isLoaded, isSignedIn, signOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const identity = isSignedIn ? clerkUser?.id : null;
  return <AccountProvider key={identity || 'signed-out'} identity={identity} isLoaded={isLoaded} isSignedIn={isSignedIn} signOut={signOut}>{children}</AccountProvider>;
}

// Account-scoped state unmounts immediately when Clerk identity changes. In-flight
// responses from the previous account can never populate the next account's context.
function AccountProvider({ children, identity, isLoaded, isSignedIn, signOut }) {
  const [user, setUser] = useState(null);
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  const fetchFamily = useCallback(async () => {
    try {
      const { data } = await api.get('/families');
      setFamily(data.families.length > 0 ? data.families[0] : null);
    } catch {
      setFamily(null);
    }
  }, []);

  useEffect(() => () => clearFeedCache(), []);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && identity) {
      let active = true;
      (async () => {
        setLoading(true);
        await fetchMe();
        if (active) await fetchFamily();
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }
    setUser(null);
    setFamily(null);
    setLoading(false);
    clearFeedCache(); // signed out — drop any cached family memories
  }, [isLoaded, isSignedIn, identity, fetchMe, fetchFamily]);

  const logout = () => signOut({ redirectUrl: '/' });
  const refreshFamily = () => fetchFamily();
  const updateUser = (updates) => setUser((u) => ({ ...u, ...updates }));

  return (
    <AuthContext.Provider value={{ user, loading, family, logout, refreshFamily, refreshUser: fetchMe, updateUser, isSignedIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
