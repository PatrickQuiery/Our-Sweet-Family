import { useAuth, useUser } from '@clerk/clerk-expo';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen, Text } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function Settings() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const { colors, spacing, scheme } = useTheme();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const initial = (user?.firstName?.[0] ?? email[0] ?? '?').toUpperCase();

  return (
    <Screen padded>
      <View style={{ gap: spacing.lg }}>
        {/* Account */}
        <Card style={{ padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="title" color="primary">
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" numberOfLines={1}>
              {user?.fullName ?? 'Signed in'}
            </Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {email}
            </Text>
          </View>
        </Card>

        {/* Appearance */}
        <Card style={{ padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.fill,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="contrast-outline" size={20} color={colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium">Appearance</Text>
            <Text variant="caption" color="textSecondary">
              Automatic — following your device ({scheme})
            </Text>
          </View>
        </Card>

        <Button
          variant="secondary"
          title="Sign out"
          icon={<Ionicons name="log-out-outline" size={18} color={colors.danger} />}
          onPress={() => signOut()}
        />

        <Text variant="caption" color="textMuted" center>
          Our Sweet Family
        </Text>
      </View>
    </Screen>
  );
}
