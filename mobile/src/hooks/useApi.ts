import { useAuth } from '@clerk/clerk-expo';
import { useMemo, useRef } from 'react';
import { createApi, type Api } from '../lib/api';

/**
 * An API client bound to the current Clerk session's bearer token.
 *
 * The client is created ONCE and kept referentially stable — Clerk's `getToken`
 * identity can change between renders, so depending on it in the memo deps would
 * hand consumers a new `api` every render, re-firing their effects in a loop
 * (which floods the API). We read the latest `getToken` through a ref instead.
 */
export function useApi(): Api {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  return useMemo(() => createApi({ getToken: () => getTokenRef.current() }), []);
}
