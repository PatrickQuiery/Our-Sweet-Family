import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { tokenCache } from '../src/lib/tokenCache';
import { CLERK_PUBLISHABLE_KEY } from '../src/lib/config';
import { interFontMap } from '../src/theme/fonts';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { FamilyProvider } from '../src/context/FamilyProvider';
import { Loading } from '../src/components/ui';

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const [fontsLoaded] = useFonts(interFontMap);
  const { colors, fonts, scheme } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isSignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (isSignedIn && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [isLoaded, isSignedIn, segments]);

  if (!isLoaded || !fontsLoaded) {
    return <Loading />;
  }
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <FamilyProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            headerStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
            headerTintColor: colors.primary,
            headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen
            name="memory/[id]"
            options={{ headerShown: true, title: 'Memory', headerBackButtonDisplayMode: 'minimal' }}
          />
          <Stack.Screen
            name="children"
            options={{ headerShown: true, title: 'Children', headerBackButtonDisplayMode: 'minimal' }}
          />
          <Stack.Screen
            name="members"
            options={{ headerShown: true, title: 'Family & Sharing', headerBackButtonDisplayMode: 'minimal' }}
          />
          <Stack.Screen
            name="accept-invite"
            options={{ headerShown: true, title: 'Invitation', headerBackButtonDisplayMode: 'minimal' }}
          />
        </Stack>
      </FamilyProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <ThemeProvider>
        <AuthGate />
      </ThemeProvider>
    </ClerkProvider>
  );
}
