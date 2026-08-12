import { Tabs } from 'expo-router';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Touchable } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';

// Soft full-screen wash behind the (transparent) tab scenes, so every glass
// panel refracts a hint of the Sunrise palette rather than flat color.
const BG_LIGHT = ['#fdeede', '#fbe4ef', '#e8eefb'] as const;
const BG_DARK = ['#1b1626', '#20182e', '#131a2e'] as const;

type TabButtonProps = {
  onPress?: (e: GestureResponderEvent) => void;
};

/** Raised brand-pink capture button — the signature center affordance. */
function CaptureTabButton({ onPress }: TabButtonProps) {
  const { colors, shadow } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Touchable
        onPress={onPress}
        pressedScale={0.9}
        style={{
          top: -18,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 4,
          borderColor: colors.bg,
          ...shadow.card,
        }}
      >
        <Ionicons name="camera" size={28} color={colors.onPrimary} />
      </Touchable>
    </View>
  );
}

export default function AppTabs() {
  const { colors, fonts, scheme } = useTheme();
  const isDark = scheme === 'dark';
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={isDark ? BG_DARK : BG_LIGHT}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    <Tabs
      screenOptions={{
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        // Floating frosted-glass bar over the content.
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(21,23,38,0.28)' : 'rgba(255,255,255,0.28)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.65)' }]} />
          </View>
        ),
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.text, fontSize: 20 },
        headerTitleAlign: 'left',
      }}
    >
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Timeline',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'images' : 'images-outline'} size={24} color={color} />
          ),
        }}
      />
      {/* Reels stays routable (opened from the Timeline header) but is off the tab bar. */}
      <Tabs.Screen name="reels" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Capture',
          headerShown: false,
          tabBarLabel: () => null,
          tabBarButton: (props) => <CaptureTabButton onPress={props.onPress ?? undefined} />,
        }}
      />
      <Tabs.Screen
        name="milestones"
        options={{
          title: 'Milestones',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'ribbon' : 'ribbon-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={23} color={color} />
          ),
        }}
      />
    </Tabs>
    </View>
  );
}
