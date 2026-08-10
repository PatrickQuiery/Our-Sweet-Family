import { useSignIn, useSSO } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Button, Input, Screen, Text } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const { colors, spacing } = useTheme();
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
    <Screen safeTop>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl }}
      >
        {/* Brand mark — the real recolorable OSF mark (closed heart + line-art family). */}
        <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
          <Image
            source={require('../../assets/logo-mark.png')}
            style={{ width: 104, height: 104, marginBottom: spacing.md }}
            resizeMode="contain"
            accessibilityLabel="Our Sweet Family"
          />
          <Text variant="title" center>
            Our Sweet Family
          </Text>
          <Text variant="body" color="textSecondary" center style={{ marginTop: spacing.xs }}>
            Every moment, kept close.
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <Input
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

          {error ? (
            <Text variant="caption" color="danger" style={{ marginTop: -spacing.xs }}>
              {error}
            </Text>
          ) : null}

          <Button title="Sign in" onPress={onEmailSignIn} loading={busy} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.sm }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text variant="caption" color="textMuted">
              or
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <Button
            title="Continue with Google"
            variant="secondary"
            onPress={onGoogle}
            icon={<Ionicons name="logo-google" size={18} color={colors.text} />}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
