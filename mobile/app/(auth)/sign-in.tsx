import { useSignIn, useSSO } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Button, Text, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

// Dismiss the in-app browser automatically when an OAuth redirect completes.
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
    setBusy(true);
    setError(null);
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
      const { createdSessionId, setActive: setActiveSSO } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({ scheme: 'oursweetfamily', path: 'sso-callback' }),
      });
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
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
      />
      {error ? <Text style={{ color: 'crimson' }}>{error}</Text> : null}
      {busy ? <ActivityIndicator /> : <Button title="Sign in" onPress={onEmailSignIn} />}
      <Text style={{ textAlign: 'center', color: '#888' }}>or</Text>
      <Button title="Continue with Google" onPress={onGoogle} />
    </View>
  );
}
