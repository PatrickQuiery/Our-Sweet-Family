import { Tabs } from 'expo-router';
import { View, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Touchable } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';

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
  const { colors, fonts } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 1,
        },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.text, fontSize: 20 },
        headerTitleAlign: 'left',
      }}
    >
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
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Reels',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'film' : 'film-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Capture',
          tabBarLabel: () => null,
          tabBarButton: (props) => <CaptureTabButton onPress={props.onPress ?? undefined} />,
        }}
      />
      <Tabs.Screen
        name="milestones"
        options={{
          title: 'Milestones',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'ribbon' : 'ribbon-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={23} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
