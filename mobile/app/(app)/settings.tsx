import { useAuth, useUser } from '@clerk/clerk-expo';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen, Text, Touchable } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useFamily } from '../../src/context/FamilyProvider';

export default function Settings() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { colors, spacing, scheme } = useTheme();
  const { families, activeFamily, activeFamilyId, setActiveFamilyId } = useFamily();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const initial = (user?.firstName?.[0] ?? email[0] ?? '?').toUpperCase();
  const childCount = activeFamily?.children?.length ?? 0;

  return (
    <Screen padded>
      <View style={{ gap: spacing.lg }}>
        {/* Account */}
        <Card style={{ padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
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

        {/* Family */}
        <Card style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Text variant="label" color="textMuted">
            FAMILY
          </Text>

          {families.length > 1 ? (
            families.map((f) => {
              const active = f.id === activeFamilyId;
              return (
                <Touchable
                  key={f.id}
                  onPress={() => setActiveFamilyId(f.id)}
                  pressedScale={0.99}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}
                >
                  <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.primary : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{f.name}</Text>
                    <Text variant="caption" color="textSecondary">
                      {f.children?.length ?? 0} {(f.children?.length ?? 0) === 1 ? 'child' : 'children'}
                    </Text>
                  </View>
                </Touchable>
              );
            })
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="home-outline" size={20} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{activeFamily?.name ?? 'Your family'}</Text>
                <Text variant="caption" color="textSecondary">
                  {childCount} {childCount === 1 ? 'child' : 'children'}
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginVertical: spacing.xs }} />

          <Touchable
            onPress={() => router.push('/children')}
            pressedScale={0.99}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
            </View>
            <Text variant="bodyMedium" style={{ flex: 1 }}>
              Manage children
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Touchable>

          <Touchable
            onPress={() => router.push('/members')}
            pressedScale={0.99}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="share-social-outline" size={20} color={colors.textSecondary} />
            </View>
            <Text variant="bodyMedium" style={{ flex: 1 }}>
              Members &amp; sharing
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Touchable>
        </Card>

        {/* Appearance */}
        <Card style={{ padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}>
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
