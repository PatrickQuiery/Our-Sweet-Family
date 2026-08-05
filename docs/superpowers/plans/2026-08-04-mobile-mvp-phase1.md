# Mobile App — Phase 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A usable Expo (React Native) app where a user signs in (email/password + Google), sees their family timeline, opens a memory, and captures + uploads a photo/video — all against the existing production API.

**Architecture:** New `mobile/` TypeScript workspace in the npm-workspaces monorepo. Expo Router with a signed-out `(auth)` group and a signed-in `(app)` tab group. `@clerk/clerk-expo` handles auth with a `expo-secure-store` token cache; a thin `fetch` API client attaches the Clerk bearer token to every request against the existing Railway API. Media is read from the existing authed endpoints via `expo-image`/`expo-video` with an `Authorization` header. Logic (token cache, API client, data mapping) is unit-tested with `jest-expo`; screens and native capture are verified in the iOS Simulator.

**Tech Stack:** Expo SDK 52+, React Native, TypeScript, Expo Router, `@clerk/clerk-expo`, `expo-secure-store`, `expo-image`, `expo-video`, `expo-image-picker`, `expo-camera`, `jest-expo`, `@testing-library/react-native`.

---

## Conventions & pre-flight

- **Work from the repo root** unless a step says otherwise: `~/Documents/Claude/Our-Sweet-Family`.
- **Branch:** all work lands on `feature/mobile-apps` (already created).
- **API base:** `https://our-sweet-family-production.up.railway.app` (the app appends `/api`). This is the same API the web client and prior verifications use.
- **Clerk publishable key:** the production instance `clerk.oursweetfamily.com`. Its `pk_live_...` key comes from the Clerk dashboard (API Keys). Store it in `mobile/.env` (git-ignored) as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — Expo inlines `EXPO_PUBLIC_*` vars at build time.
- **SDK-version caveat:** a few APIs used here are version-sensitive (`expo-video`'s `useVideoPlayer`, Clerk's `useSSO`). At scaffold time, confirm the installed Expo SDK version and cross-check these two APIs against that SDK's docs; the code below targets SDK 52. If `useSSO` is unavailable in the installed `@clerk/clerk-expo`, use `useOAuth` with `{ strategy: 'oauth_google' }` (same return shape used in Task 6).
- **Simulator verification** uses the iOS Simulator tooling available in this environment. Email/password sign-in and image-picker work in the simulator; Google SSO is best verified on a device or a dev build with the URL scheme registered (Task 6 notes this).

---

## File structure (created in this plan)

```
mobile/
  app.json                      # Expo config: name, slug, scheme, bundle ids, plugins
  babel.config.js
  metro.config.js               # monorepo-aware Metro config
  tsconfig.json
  jest.config.js
  .env                          # EXPO_PUBLIC_* (git-ignored)
  app/
    _layout.tsx                 # Root: ClerkProvider + auth-gate redirect
    (auth)/
      _layout.tsx               # Stack for signed-out routes
      sign-in.tsx               # Email/password + Google sign-in
    (app)/
      _layout.tsx               # Bottom tabs (Timeline / Capture / Settings)
      index.tsx                 # Timeline feed
      capture.tsx               # Capture -> upload
      settings.tsx              # Minimal: account + sign out
    memory/
      [id].tsx                  # Memory detail
  src/
    lib/
      config.ts                 # API base + env
      tokenCache.ts             # SecureStore-backed Clerk token cache
      api.ts                    # fetch wrapper that attaches the bearer token
      memories.ts               # getFamilies / getMemories / uploadMemory
      types.ts                  # Family, Child, Memory types
    hooks/
      useMemories.ts            # paginated feed hook
    components/
      AuthedImage.tsx           # expo-image with Authorization header
      MemoryCard.tsx            # one feed card
    lib/__tests__/
      tokenCache.test.ts
      api.test.ts
      memories.test.ts
```

---

## Task 1: Scaffold the Expo app in the monorepo

**Files:**
- Create: `mobile/` (via `create-expo-app`)
- Modify: root `package.json` (workspaces array), root `.gitignore`
- Create: `mobile/metro.config.js`, `mobile/.env`

- [ ] **Step 1: Scaffold the app**

Run from repo root:
```bash
npx create-expo-app@latest mobile --template expo-template-blank-typescript
```
Then move into it and add Expo Router + the config it needs:
```bash
cd mobile
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```

- [ ] **Step 2: Convert to Expo Router entry**

Set the entry point and scheme. Edit `mobile/package.json` `"main"`:
```json
"main": "expo-router/entry"
```
Edit `mobile/app.json` — set `expo.scheme` and iOS/Android identifiers (used later for OAuth + deep links):
```json
{
  "expo": {
    "name": "Our Sweet Family",
    "slug": "our-sweet-family",
    "scheme": "oursweetfamily",
    "ios": { "bundleIdentifier": "com.oursweetfamily.app", "supportsTablet": false },
    "android": { "package": "com.oursweetfamily.app" },
    "plugins": ["expo-router", "expo-secure-store"]
  }
}
```
Delete the scaffolded `mobile/App.tsx` (Expo Router uses the `app/` dir instead).

- [ ] **Step 3: Monorepo Metro config**

Create `mobile/metro.config.js` so Metro watches the repo root and resolves hoisted deps:
```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
module.exports = config;
```

- [ ] **Step 4: Register the workspace**

Edit root `package.json` `"workspaces"` to include mobile:
```json
"workspaces": ["client", "server", "mobile"]
```
Add to root `.gitignore` (if not already covered):
```
mobile/.expo/
mobile/ios/
mobile/android/
mobile/.env
```
Create `mobile/.env` (git-ignored) with the two public vars:
```
EXPO_PUBLIC_API_BASE_URL=https://our-sweet-family-production.up.railway.app
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_REPLACE_WITH_KEY_FROM_CLERK_DASHBOARD
```

- [ ] **Step 5: Create a placeholder root route so the app boots**

Create `mobile/app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```
Create `mobile/app/index.tsx`:
```tsx
import { Text, View } from 'react-native';
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Our Sweet Family — mobile boot OK</Text>
    </View>
  );
}
```

- [ ] **Step 6: Verify it boots in the iOS Simulator**

From `mobile/`:
```bash
npx expo run:ios
```
Expected: the app builds, the simulator launches, and the screen reads "Our Sweet Family — mobile boot OK". (Use the iOS Simulator tooling to screenshot and confirm.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "mobile: scaffold Expo Router app in monorepo, boots in simulator"
```

---

## Task 2: Test tooling (jest-expo)

**Files:**
- Modify: `mobile/package.json` (devDeps + `test` script)
- Create: `mobile/jest.config.js`
- Test: `mobile/src/lib/__tests__/smoke.test.ts`

- [ ] **Step 1: Install test deps**

From `mobile/`:
```bash
npx expo install -- --save-dev jest-expo jest @testing-library/react-native @types/jest
```

- [ ] **Step 2: Configure jest**

Create `mobile/jest.config.js`:
```js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@clerk/.*|expo-router|react-navigation|@react-navigation/.*))',
  ],
  setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
};
```
Add to `mobile/package.json` scripts:
```json
"test": "jest"
```

- [ ] **Step 3: Write a failing smoke test**

Create `mobile/src/lib/__tests__/smoke.test.ts`:
```ts
import { sum } from '../smoke';
test('sum adds numbers', () => {
  expect(sum(2, 3)).toBe(5);
});
```

- [ ] **Step 4: Run it — expect FAIL (module not found)**

```bash
npm test --workspace=mobile
```
Expected: FAIL — cannot find module `../smoke`.

- [ ] **Step 5: Implement**

Create `mobile/src/lib/smoke.ts`:
```ts
export const sum = (a: number, b: number): number => a + b;
```

- [ ] **Step 6: Run — expect PASS**

```bash
npm test --workspace=mobile
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "mobile: add jest-expo test tooling with passing smoke test"
```

---

## Task 3: Config + SecureStore token cache

**Files:**
- Create: `mobile/src/lib/config.ts`
- Create: `mobile/src/lib/tokenCache.ts`
- Test: `mobile/src/lib/__tests__/tokenCache.test.ts`

- [ ] **Step 1: Config module**

Create `mobile/src/lib/config.ts`:
```ts
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
export const API_ROOT = `${API_BASE_URL}/api`;
```

- [ ] **Step 2: Install SecureStore**

From `mobile/`:
```bash
npx expo install expo-secure-store
```

- [ ] **Step 3: Write the failing token-cache test**

Create `mobile/src/lib/__tests__/tokenCache.test.ts`:
```ts
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
import * as SecureStore from 'expo-secure-store';
import { tokenCache } from '../tokenCache';

describe('tokenCache', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the stored token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tok_123');
    await expect(tokenCache.getToken('key')).resolves.toBe('tok_123');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('key');
  });

  it('saves a token', async () => {
    await tokenCache.saveToken('key', 'tok_456');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('key', 'tok_456');
  });

  it('returns null when SecureStore throws', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('boom'));
    await expect(tokenCache.getToken('key')).resolves.toBeNull();
  });
});
```

- [ ] **Step 4: Run — expect FAIL**

```bash
npm test --workspace=mobile -- tokenCache
```
Expected: FAIL — cannot find module `../tokenCache`.

- [ ] **Step 5: Implement the token cache**

Create `mobile/src/lib/tokenCache.ts`:
```ts
import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/clerk-expo/dist/cache';

export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore write failures; Clerk will re-fetch a token
    }
  },
};
```
> If the `@clerk/clerk-expo/dist/cache` type import is not resolvable in the installed version, replace the annotation with an inline type: `{ getToken(k: string): Promise<string | null>; saveToken(k: string, v: string): Promise<void> }`.

- [ ] **Step 6: Run — expect PASS**

```bash
npm test --workspace=mobile -- tokenCache
```
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "mobile: add config + SecureStore-backed Clerk token cache (tested)"
```

---

## Task 4: API client (bearer-token fetch wrapper)

**Files:**
- Create: `mobile/src/lib/api.ts`
- Test: `mobile/src/lib/__tests__/api.test.ts`

The web client attaches `Authorization: Bearer <clerkToken>` on every request ([client/src/lib/api.js:11-14](../../../client/src/lib/api.js)). This mirrors that with `fetch`. The Clerk token getter is **injected** (not imported from a React hook) so it is unit-testable and usable outside components.

- [ ] **Step 1: Write the failing test**

Create `mobile/src/lib/__tests__/api.test.ts`:
```ts
import { createApi } from '../api';

describe('createApi', () => {
  const okJson = (body: unknown) =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

  it('attaches the bearer token and hits API_ROOT + path', async () => {
    const fetchMock = jest.fn().mockReturnValue(okJson({ hello: 'world' }));
    const api = createApi({ root: 'https://x/api', getToken: async () => 'tok_9', fetchImpl: fetchMock });

    const res = await api.get('/auth/me');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://x/api/auth/me');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok_9');
    expect(res).toEqual({ hello: 'world' });
  });

  it('omits Authorization when there is no token', async () => {
    const fetchMock = jest.fn().mockReturnValue(okJson({}));
    const api = createApi({ root: 'https://x/api', getToken: async () => null, fetchImpl: fetchMock });
    await api.get('/public');
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('throws ApiError with status on non-2xx', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false, status: 403, json: () => Promise.resolve({ error: 'nope' }),
    } as Response);
    const api = createApi({ root: 'https://x/api', getToken: async () => 't', fetchImpl: fetchMock });
    await expect(api.get('/x')).rejects.toMatchObject({ status: 403, message: 'nope' });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test --workspace=mobile -- api
```
Expected: FAIL — cannot find module `../api`.

- [ ] **Step 3: Implement**

Create `mobile/src/lib/api.ts`:
```ts
import { API_ROOT } from './config';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type GetToken = () => Promise<string | null>;

interface ApiDeps {
  root?: string;
  getToken: GetToken;
  fetchImpl?: typeof fetch;
}

export interface Api {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown): Promise<T>;
  del<T = unknown>(path: string): Promise<T>;
  postForm<T = unknown>(path: string, form: FormData): Promise<T>;
}

export function createApi({ root = API_ROOT, getToken, fetchImpl = fetch }: ApiDeps): Api {
  async function request<T>(method: string, path: string, opts: { body?: unknown; form?: FormData } = {}): Promise<T> {
    const token = await getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let body: BodyInit | undefined;
    if (opts.form) {
      body = opts.form as unknown as BodyInit; // let fetch set the multipart boundary
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }

    const res = await fetchImpl(`${root}${path}`, { method, headers, body });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (json && (json.error || json.message)) || `HTTP ${res.status}`;
      throw new ApiError(res.status, message);
    }
    return json as T;
  }

  return {
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, { body: b }),
    patch: (p, b) => request('PATCH', p, { body: b }),
    del: (p) => request('DELETE', p),
    postForm: (p, form) => request('POST', p, { form }),
  };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test --workspace=mobile -- api
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "mobile: add injectable bearer-token fetch API client (tested)"
```

---

## Task 5: Domain types + memories data layer

**Files:**
- Create: `mobile/src/lib/types.ts`
- Create: `mobile/src/lib/memories.ts`
- Test: `mobile/src/lib/__tests__/memories.test.ts`

Endpoint shapes (confirmed against the running API this session): `GET /api/families` → `{ families: [{ id, name, children: [...] }] }`; `GET /api/memories?familyId=&page=&limit=` → `{ memories: [...] }`; each memory has `id, fileType ('photo'|'video'), fileUrl, thumbnailUrl, caption, childIds, ageLabels, size, processing, createdAt`; `POST /api/memories` (multipart: `file`, `familyId`, `childIds` JSON string, `caption`) → `{ memory: {...} }`.

- [ ] **Step 1: Types**

Create `mobile/src/lib/types.ts`:
```ts
export interface Child { id: string; name: string; gender?: string | null; dateOfBirth?: string | null; avatarUrl?: string | null; }
export interface Family { id: string; name: string; children: Child[]; showPhotoLocation?: boolean; }
export interface Memory {
  id: string;
  fileType: 'photo' | 'video';
  fileUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  childIds: string[];
  ageLabels?: string[];
  locationCity?: string | null;
  locationState?: string | null;
  processing?: boolean;
  createdAt: string;
}
```

- [ ] **Step 2: Write the failing data-layer test**

Create `mobile/src/lib/__tests__/memories.test.ts`:
```ts
import { getFamilies, getMemories, buildUploadForm } from '../memories';
import type { Api } from '../api';

function fakeApi(overrides: Partial<Api>): Api {
  return {
    get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), postForm: jest.fn(),
    ...overrides,
  } as Api;
}

describe('memories data layer', () => {
  it('getFamilies unwraps the families array', async () => {
    const api = fakeApi({ get: jest.fn().mockResolvedValue({ families: [{ id: 'f1', name: 'Fam', children: [] }] }) });
    await expect(getFamilies(api)).resolves.toEqual([{ id: 'f1', name: 'Fam', children: [] }]);
    expect(api.get).toHaveBeenCalledWith('/families');
  });

  it('getMemories builds the paginated query and unwraps memories', async () => {
    const get = jest.fn().mockResolvedValue({ memories: [{ id: 'm1' }] });
    const api = fakeApi({ get });
    const res = await getMemories(api, { familyId: 'f1', page: 2, limit: 20 });
    expect(get).toHaveBeenCalledWith('/memories?familyId=f1&page=2&limit=20');
    expect(res).toEqual([{ id: 'm1' }]);
  });

  it('buildUploadForm assembles multipart fields', () => {
    const form = buildUploadForm({
      familyId: 'f1',
      childIds: ['c1', 'c2'],
      caption: 'hi',
      asset: { uri: 'file:///x.jpg', name: 'x.jpg', mimeType: 'image/jpeg' },
    });
    // FormData is opaque in jest; assert via _parts when available (RN polyfill) or that it is a FormData
    expect(form).toBeInstanceOf(FormData);
    const parts = (form as unknown as { _parts?: [string, unknown][] })._parts;
    if (parts) {
      const keys = parts.map((p) => p[0]);
      expect(keys).toEqual(expect.arrayContaining(['file', 'familyId', 'childIds', 'caption']));
      expect(parts.find((p) => p[0] === 'childIds')?.[1]).toBe('["c1","c2"]');
    }
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

```bash
npm test --workspace=mobile -- memories
```
Expected: FAIL — cannot find module `../memories`.

- [ ] **Step 4: Implement**

Create `mobile/src/lib/memories.ts`:
```ts
import type { Api } from './api';
import type { Family, Memory } from './types';

export async function getFamilies(api: Api): Promise<Family[]> {
  const data = await api.get<{ families: Family[] }>('/families');
  return data.families ?? [];
}

export interface MemoriesQuery { familyId: string; page?: number; limit?: number; }

export async function getMemories(api: Api, q: MemoriesQuery): Promise<Memory[]> {
  const page = q.page ?? 1;
  const limit = q.limit ?? 20;
  const data = await api.get<{ memories: Memory[] }>(
    `/memories?familyId=${encodeURIComponent(q.familyId)}&page=${page}&limit=${limit}`
  );
  return data.memories ?? [];
}

export interface UploadAsset { uri: string; name: string; mimeType: string; }
export interface UploadInput { familyId: string; childIds: string[]; caption?: string; asset: UploadAsset; }

export function buildUploadForm(input: UploadInput): FormData {
  const form = new FormData();
  // React Native FormData accepts { uri, name, type } for file parts
  form.append('file', { uri: input.asset.uri, name: input.asset.name, type: input.asset.mimeType } as unknown as Blob);
  form.append('familyId', input.familyId);
  form.append('childIds', JSON.stringify(input.childIds));
  if (input.caption) form.append('caption', input.caption);
  return form;
}

export async function uploadMemory(api: Api, input: UploadInput): Promise<Memory> {
  const data = await api.postForm<{ memory: Memory }>('/memories', buildUploadForm(input));
  return data.memory;
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
npm test --workspace=mobile -- memories
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "mobile: add domain types + memories data layer (families/feed/upload, tested)"
```

---

## Task 6: Clerk provider + auth gate + sign-in screen

**Files:**
- Install: `@clerk/clerk-expo`
- Modify: `mobile/app/_layout.tsx`
- Create: `mobile/app/(auth)/_layout.tsx`, `mobile/app/(auth)/sign-in.tsx`
- Create: `mobile/app/(app)/_layout.tsx` (temporary, replaced in Task 7)
- Delete: `mobile/app/index.tsx` (placeholder from Task 1)

This task is verified in the **simulator** (auth UI is not unit-tested). Email/password is the primary simulator path; Google SSO is wired but best verified on a device/dev build.

- [ ] **Step 1: Install Clerk + OAuth deps**

From `mobile/`:
```bash
npx expo install @clerk/clerk-expo expo-web-browser expo-auth-session
```

- [ ] **Step 2: Root layout with ClerkProvider + auth gate**

Replace `mobile/app/_layout.tsx`:
```tsx
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { tokenCache } from '../src/lib/tokenCache';
import { CLERK_PUBLISHABLE_KEY } from '../src/lib/config';

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isSignedIn && !inAuthGroup) router.replace('/(auth)/sign-in');
    else if (isSignedIn && inAuthGroup) router.replace('/(app)');
  }, [isLoaded, isSignedIn, segments]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Slot />;
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <AuthGate />
    </ClerkProvider>
  );
}
```
Delete the placeholder route:
```bash
rm mobile/app/index.tsx
```

- [ ] **Step 3: Auth group layout**

Create `mobile/app/(auth)/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 4: Sign-in screen (email/password + Google)**

Create `mobile/app/(auth)/sign-in.tsx`:
```tsx
import { useSignIn, useSSO } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { ActivityIndicator, Button, Text, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onEmailSignIn = useCallback(async () => {
    if (!isLoaded) return;
    setBusy(true); setError(null);
    try {
      const res = await signIn.create({ identifier: email, password });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        router.replace('/(app)');
      } else {
        setError('Additional verification required.');
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }, [isLoaded, email, password]);

  const onGoogle = useCallback(async () => {
    setError(null);
    try {
      const { createdSessionId, setActive: setActiveSSO } = await startSSOFlow({ strategy: 'oauth_google' });
      if (createdSessionId && setActiveSSO) {
        await setActiveSSO({ session: createdSessionId });
        router.replace('/(app)');
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? 'Google sign-in failed');
    }
  }, []);

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }}>Our Sweet Family</Text>
      <TextInput placeholder="Email" autoCapitalize="none" keyboardType="email-address"
        value={email} onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }} />
      <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }} />
      {error ? <Text style={{ color: 'crimson' }}>{error}</Text> : null}
      {busy ? <ActivityIndicator /> : <Button title="Sign in" onPress={onEmailSignIn} />}
      <Text style={{ textAlign: 'center', color: '#888' }}>or</Text>
      <Button title="Continue with Google" onPress={onGoogle} />
    </View>
  );
}
```
> **Google SSO redirect:** `startSSOFlow` uses the app `scheme` (`oursweetfamily`) set in Task 1. In the Clerk dashboard, ensure the native redirect is allowed (Clerk auto-allows the scheme for Expo). If Google fails in the simulator, verify email/password works there and test Google on a physical device / dev build. If `useSSO` is missing in the installed Clerk version, swap to `useOAuth({ strategy: 'oauth_google' })` and call the returned `startOAuthFlow()`.

- [ ] **Step 5: Temporary signed-in landing**

Create `mobile/app/(app)/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```
Create `mobile/app/(app)/index.tsx`:
```tsx
import { useAuth } from '@clerk/clerk-expo';
import { Button, Text, View } from 'react-native';
export default function Home() {
  const { signOut } = useAuth();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text>Signed in ✅</Text>
      <Button title="Sign out" onPress={() => signOut()} />
    </View>
  );
}
```

- [ ] **Step 6: Verify in the simulator**

From `mobile/`: `npx expo run:ios`. Expected flow: app opens on the sign-in screen → sign in with the owner email/password (`patrick.quiery@gmail.com`) → lands on "Signed in ✅" → Sign out returns to the sign-in screen. Screenshot each state with the simulator tooling.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "mobile: Clerk auth provider, auth-gate routing, sign-in screen (email + Google)"
```

---

## Task 7: Tabs + Timeline feed

**Files:**
- Create: `mobile/src/hooks/useMemories.ts`
- Create: `mobile/src/components/AuthedImage.tsx`, `mobile/src/components/MemoryCard.tsx`
- Replace: `mobile/app/(app)/_layout.tsx` (tabs), `mobile/app/(app)/index.tsx` (feed)
- Create: `mobile/app/(app)/settings.tsx`
- Install: `expo-image`

A shared `useApi()` helper wires the Clerk `getToken` into `createApi` inside components.

- [ ] **Step 1: Install expo-image + a shared useApi hook**

From `mobile/`: `npx expo install expo-image`.

Create `mobile/src/hooks/useApi.ts`:
```ts
import { useAuth } from '@clerk/clerk-expo';
import { useMemo } from 'react';
import { createApi, type Api } from '../lib/api';

export function useApi(): Api {
  const { getToken } = useAuth();
  return useMemo(() => createApi({ getToken: () => getToken() }), [getToken]);
}
```

- [ ] **Step 2: Feed hook**

Create `mobile/src/hooks/useMemories.ts`:
```ts
import { useCallback, useEffect, useState } from 'react';
import { useApi } from './useApi';
import { getFamilies, getMemories } from '../lib/memories';
import type { Family, Memory } from '../lib/types';

export function useMemories() {
  const api = useApi();
  const [family, setFamily] = useState<Family | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);

  const loadFirst = useCallback(async () => {
    setRefreshing(true);
    try {
      const fams = await getFamilies(api);
      const fam = fams[0] ?? null;
      setFamily(fam);
      if (fam) {
        const first = await getMemories(api, { familyId: fam.id, page: 1, limit: 20 });
        setMemories(first);
        setPage(1);
        setDone(first.length < 20);
      }
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  const loadMore = useCallback(async () => {
    if (loading || done || !family) return;
    setLoading(true);
    try {
      const next = page + 1;
      const more = await getMemories(api, { familyId: family.id, page: next, limit: 20 });
      setMemories((prev) => [...prev, ...more]);
      setPage(next);
      if (more.length < 20) setDone(true);
    } finally {
      setLoading(false);
    }
  }, [api, family, page, loading, done]);

  useEffect(() => { loadFirst(); }, [loadFirst]);

  return { family, memories, loading, refreshing, refresh: loadFirst, loadMore };
}
```

- [ ] **Step 3: Authed image component**

Create `mobile/src/components/AuthedImage.tsx`:
```tsx
import { Image } from 'expo-image';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../lib/config';

/** Renders a memory image from a relative or absolute URL, adding the Clerk bearer header. */
export function AuthedImage({ path, style }: { path: string; style?: any }) {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { getToken().then(setToken); }, [getToken]);

  const uri = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  if (!token) return null;
  return <Image style={style} source={{ uri, headers: { Authorization: `Bearer ${token}` } }} contentFit="cover" transition={150} />;
}
```
> Memory `fileUrl`/`thumbnailUrl` are relative (`/memories/:id/thumb`) unless stored absolute; `AuthedImage` handles both. The `/api` prefix is NOT included on these media paths — they are served at `${API_BASE_URL}/memories/:id/...`. Confirm against a live memory during Step 6; if the running API serves them under `/api`, change the fallback to `${API_ROOT}${path}`.

- [ ] **Step 4: Memory card**

Create `mobile/src/components/MemoryCard.tsx`:
```tsx
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthedImage } from './AuthedImage';
import type { Memory } from '../lib/types';

export function MemoryCard({ memory }: { memory: Memory }) {
  const router = useRouter();
  const thumb = memory.thumbnailUrl ?? memory.fileUrl;
  return (
    <Pressable onPress={() => router.push(`/memory/${memory.id}`)} style={{ marginBottom: 16 }}>
      <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#eee' }}>
        <AuthedImage path={thumb} style={{ width: '100%', aspectRatio: 1 }} />
        {memory.processing ? (
          <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>Optimizing…</Text>
          </View>
        ) : null}
      </View>
      {memory.caption ? <Text style={{ marginTop: 6 }}>{memory.caption}</Text> : null}
      {memory.ageLabels?.length ? <Text style={{ color: '#888', fontSize: 12 }}>{memory.ageLabels.join(' · ')}</Text> : null}
    </Pressable>
  );
}
```

- [ ] **Step 5: Tabs + feed screen + settings**

Replace `mobile/app/(app)/_layout.tsx`:
```tsx
import { Tabs } from 'expo-router';
export default function AppTabs() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: 'Timeline' }} />
      <Tabs.Screen name="capture" options={{ title: 'Capture' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
```
Replace `mobile/app/(app)/index.tsx`:
```tsx
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useMemories } from '../../src/hooks/useMemories';
import { MemoryCard } from '../../src/components/MemoryCard';

export default function Timeline() {
  const { memories, refreshing, refresh, loadMore } = useMemories();
  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={memories}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => <MemoryCard memory={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      onEndReachedThreshold={0.5}
      onEndReached={loadMore}
      ListEmptyComponent={!refreshing ? <View style={{ padding: 32 }}><Text style={{ textAlign: 'center', color: '#888' }}>No memories yet. Tap Capture to add one.</Text></View> : null}
    />
  );
}
```
Create `mobile/app/(app)/settings.tsx`:
```tsx
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Button, Text, View } from 'react-native';
export default function Settings() {
  const { signOut } = useAuth();
  const { user } = useUser();
  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 18 }}>{user?.primaryEmailAddress?.emailAddress}</Text>
      <Button title="Sign out" onPress={() => signOut()} />
    </View>
  );
}
```
Create a placeholder `mobile/app/(app)/capture.tsx` (fully built in Task 9):
```tsx
import { Text, View } from 'react-native';
export default function Capture() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Capture — coming in Task 9</Text></View>;
}
```

- [ ] **Step 6: Verify in the simulator**

`npx expo run:ios`. Sign in → the **Timeline** tab shows the family's real memories (photos load through the authed endpoint), pull-to-refresh works, scrolling loads more. Confirm the media path assumption from Step 3 against a real thumbnail; fix the base if images 404 (check with the simulator + `npx expo start` logs).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "mobile: bottom tabs + timeline feed with authed media, settings sign-out"
```

---

## Task 8: Memory detail screen

**Files:**
- Create: `mobile/app/memory/[id].tsx`
- Install: `expo-video`

- [ ] **Step 1: Install expo-video**

From `mobile/`: `npx expo install expo-video`.

- [ ] **Step 2: Detail screen**

Create `mobile/app/memory/[id].tsx`:
```tsx
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useApi } from '../../src/hooks/useApi';
import { AuthedImage } from '../../src/components/AuthedImage';
import { API_BASE_URL } from '../../src/lib/config';
import { useAuth } from '@clerk/clerk-expo';
import type { Memory } from '../../src/lib/types';

const absolute = (path: string) => (path.startsWith('http') ? path : `${API_BASE_URL}${path}`);

export default function MemoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { getToken } = useAuth();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => { api.get<{ memory: Memory }>(`/memories/${id}`).then((d) => setMemory(d.memory)); }, [id]);
  useEffect(() => { getToken().then(setToken); }, [getToken]);

  const isVideo = memory?.fileType === 'video';
  const videoSource =
    isVideo && memory && token
      ? { uri: absolute(memory.fileUrl), headers: { Authorization: `Bearer ${token}` } }
      : null;

  // useVideoPlayer creates the player once; the source is fetched async, so load it via replace().
  const player = useVideoPlayer(videoSource);
  useEffect(() => { if (videoSource && player) player.replace(videoSource); }, [player, videoSource?.uri, token]);

  if (!memory) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {isVideo ? (
        <VideoView player={player} style={{ width: '100%', aspectRatio: 1 }} nativeControls />
      ) : (
        <AuthedImage path={memory.fileUrl} style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }} />
      )}
      {memory.caption ? <Text style={{ fontSize: 16 }}>{memory.caption}</Text> : null}
      {memory.ageLabels?.length ? <Text style={{ color: '#888' }}>{memory.ageLabels.join(' · ')}</Text> : null}
      {memory.locationCity ? <Text style={{ color: '#888' }}>{[memory.locationCity, memory.locationState].filter(Boolean).join(', ')}</Text> : null}
    </ScrollView>
  );
}
```
> **Video auth:** `expo-video` accepts a `headers` field on its source. The Clerk token is async, so the source starts `null` and is applied via `player.replace()` once the token resolves (the `useVideoPlayer` player instance is created once and is not re-created when the source arg changes). If the installed `expo-video` exposes `replaceAsync` instead of `replace`, use that. Same `absolute()` base assumption as `AuthedImage` (Task 7) applies.

- [ ] **Step 3: Verify in the simulator**

From the Timeline, tap a photo memory → detail shows the full image, caption, age labels, location (if enabled). Tap a video memory → it plays with native controls. If the video 401s, confirm the `headers` are attached to the player source.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "mobile: memory detail screen (authed photo + video playback)"
```

---

## Task 9: Capture → upload

**Files:**
- Replace: `mobile/app/(app)/capture.tsx`
- Install: `expo-image-picker`

Uses the system image picker (camera + library). In-app `expo-camera` UI is deferred; the picker covers "take photo" and "choose from library" and works in the simulator's photo library.

- [ ] **Step 1: Install the picker**

From `mobile/`: `npx expo install expo-image-picker`. Add its permission strings to `mobile/app.json` plugins:
```json
"plugins": [
  "expo-router",
  "expo-secure-store",
  ["expo-image-picker", { "photosPermission": "Allow Our Sweet Family to access your photos to share memories.", "cameraPermission": "Allow Our Sweet Family to use the camera to capture memories." }]
]
```

- [ ] **Step 2: Capture screen**

Replace `mobile/app/(app)/capture.tsx`:
```tsx
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Button, Image, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApi } from '../../src/hooks/useApi';
import { useMemories } from '../../src/hooks/useMemories';
import { uploadMemory, type UploadAsset } from '../../src/lib/memories';

export default function Capture() {
  const api = useApi();
  const router = useRouter();
  const { family, refresh } = useMemories();
  const [asset, setAsset] = useState<UploadAsset | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (fromCamera: boolean) => {
    setError(null);
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError('Permission denied'); return; }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 1 });
    if (result.canceled || !result.assets?.length) return;
    const a = result.assets[0];
    const name = a.fileName ?? (a.type === 'video' ? 'upload.mp4' : 'upload.jpg');
    const mimeType = a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg');
    setAsset({ uri: a.uri, name, mimeType });
    setPreview(a.uri);
  };

  const toggleChild = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const upload = async () => {
    if (!asset || !family) return;
    setBusy(true); setError(null);
    try {
      await uploadMemory(api, { familyId: family.id, childIds: selected, caption, asset });
      setAsset(null); setPreview(null); setSelected([]); setCaption('');
      await refresh();
      router.replace('/(app)');
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button title="Take photo/video" onPress={() => pick(true)} />
        <Button title="Choose from library" onPress={() => pick(false)} />
      </View>
      {preview ? <Image source={{ uri: preview }} style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }} /> : null}
      {family?.children?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {family.children.map((c) => (
            <Pressable key={c.id} onPress={() => toggleChild(c.id)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: selected.includes(c.id) ? '#4f46e5' : '#eee' }}>
              <Text style={{ color: selected.includes(c.id) ? '#fff' : '#333' }}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput placeholder="Add a caption…" value={caption} onChangeText={setCaption}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }} />
      {error ? <Text style={{ color: 'crimson' }}>{error}</Text> : null}
      {busy ? <ActivityIndicator /> : <Button title="Upload" onPress={upload} disabled={!asset} />}
    </View>
  );
}
```

- [ ] **Step 3: Verify the full loop in the simulator**

`npx expo run:ios`. On **Capture**: "Choose from library" → pick a simulator photo → tag a child → add a caption → **Upload**. Expected: returns to Timeline with the new memory at top. For a video, confirm it appears with an "Optimizing…" badge that clears (the dedicated transcode worker compresses it, per `server/WORKER.md`). Clean up test uploads afterward via the app or the API.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "mobile: capture -> upload (image picker, child tagging, caption)"
```

---

## Task 10: Phase 1 wrap-up

- [ ] **Step 1: Full unit suite green**

```bash
npm test --workspace=mobile
```
Expected: all suites pass (smoke, tokenCache, api, memories).

- [ ] **Step 2: End-to-end smoke in the simulator**

Fresh launch → sign in (email/password) → Timeline loads real memories → open a photo and a video detail → Capture a library photo, tag a child, upload → it appears on the Timeline → Settings → Sign out → back to sign-in. Screenshot the key states.

- [ ] **Step 3: Update docs**

Create `mobile/README.md` documenting: env vars (`EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`), `npx expo run:ios` to build/run, `npm test --workspace=mobile`, and the note that Google SSO needs a device/dev build. Commit:
```bash
git add -A
git commit -m "mobile: Phase 1 MVP complete — README + verified end-to-end"
```

- [ ] **Step 4: Open a PR (optional, when ready)**

```bash
git push -u origin feature/mobile-apps
gh pr create --title "Mobile app — Phase 1 MVP (Expo)" --body "Implements docs/superpowers/plans/2026-08-04-mobile-mvp-phase1.md"
```

---

## Notes for the implementer

- **TDD boundary:** business logic (config, token cache, API client, data layer) is unit-tested first (Tasks 2–5). UI screens and native modules (auth, feed rendering, capture, video) are verified in the iOS Simulator because they exercise native modules that jest cannot meaningfully run. Do not skip the simulator verification steps — they are the tests for those tasks.
- **Live API dependency:** Tasks 6–10 hit the production API with the owner's real account. Treat uploaded test memories as disposable and delete them after verifying (via the app or `DELETE /api/memories/:id`).
- **Media path assumption:** the one open detail is whether authed media is served at `${API_BASE_URL}/memories/:id/...` (relative, no `/api`) or under `/api`. Confirm against a live memory in Task 7 Step 6 and set the `AuthedImage`/video base accordingly. Everything else was confirmed against the running API this session.
- **Do not** commit `mobile/.env`, `mobile/ios/`, or `mobile/android/` (native dirs are generated by `expo run:ios`/prebuild).
