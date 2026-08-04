import { useAuth } from '@clerk/clerk-expo';
import { useMemo } from 'react';
import { createApi, type Api } from '../lib/api';

/** An API client bound to the current Clerk session's bearer token. */
export function useApi(): Api {
  const { getToken } = useAuth();
  return useMemo(() => createApi({ getToken: () => getToken() }), [getToken]);
}
