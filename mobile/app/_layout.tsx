import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';

// Sunrise header wash for the native-stack sub-screens (Memory, Children, …).
const LIGHT_G = ['#fff2c9', '#ffd3e2', '#cfe8ff'] as const;
const DARK_G = ['#33263f', '#2b2142', '#1b2540'] as const;
import { tokenCache } from '../src/lib/tokenCache';
import { CLERK_PUBLISHABLE_KEY } from '../src/lib/config';
import { interFontMap } from '../src/theme/fonts';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { FamilyProvider } from '../src/context/FamilyProvider';
import { ToastProvider } from '../src/components/ui';
import { AnimatedSplash } from '../src/components/AnimatedSplash';

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
    return <AnimatedSplash />;
  }
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ToastProvider>
      <FamilyProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
            headerTintColor: colors.primary,
            headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
            headerBackground: () => (
              <LinearGradient colors={scheme === 'dark' ? DARK_G : LIGHT_G} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
            ),
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
      </ToastProvider>
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
