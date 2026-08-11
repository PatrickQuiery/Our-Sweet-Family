import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Share, Switch, View } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen, Text, Touchable } from '../../src/components/ui';
import { SunriseHeader } from '../../src/components/SunriseHeader';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useFamily } from '../../src/context/FamilyProvider';
import { useApi } from '../../src/hooks/useApi';
import { getFamilyUsage, updateFamilySettings } from '../../src/lib/family';
import { getReferral, type ReferralInfo } from '../../src/lib/referrals';
import { formatBytes, PLAN_LABELS } from '../../src/lib/format';
import type { FamilyUsage } from '../../src/lib/types';

function Row({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>{children}</View>;
}

function IconBubble({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={20} color={colors.textSecondary} />
    </View>
  );
}

export default function Settings() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const api = useApi();
  const { colors, spacing, scheme } = useTheme();
  const { families, activeFamily, activeFamilyId, setActiveFamilyId, refresh } = useFamily();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const initial = (user?.firstName?.[0] ?? email[0] ?? '?').toUpperCase();
  const childCount = activeFamily?.children?.length ?? 0;

  const [usage, setUsage] = useState<FamilyUsage | null>(null);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [locBusy, setLocBusy] = useState(false);

  const loadExtras = useCallback(async () => {
    if (!activeFamily) return;
    const [u, r] = await Promise.all([
      getFamilyUsage(api, activeFamily.id).catch(() => null),
      getReferral(api).catch(() => null),
    ]);
    setUsage(u);
    setReferral(r);
  }, [api, activeFamily?.id]);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const onToggleLocation = async (val: boolean) => {
    if (!activeFamily) return;
    setLocBusy(true);
    try {
      await updateFamilySettings(api, activeFamily.id, { showPhotoLocation: val });
      await refresh();
    } catch (e: any) {
      Alert.alert('Could not update', e?.message ?? 'Please try again.');
    } finally {
      setLocBusy(false);
    }
  };

  const shareReferral = () => {
    if (!referral) return;
    Share.share({
      message: `Join our family memories on Our Sweet Family. Use my code ${referral.code} when you sign up — we each get ${referral.rewardDays} days of Plus!`,
    });
  };

  const usedVideo = usage?.usedVideoBytes ?? 0;
  const limit = usage?.videoLimitBytes ?? null;
  const pct = limit ? Math.min(1, usedVideo / limit) : 0;

  return (
    <Screen>
      <SunriseHeader title="Settings" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
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
                <Touchable key={f.id} onPress={() => setActiveFamilyId(f.id)} pressedScale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
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
            <Row>
              <IconBubble name="home-outline" />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{activeFamily?.name ?? 'Your family'}</Text>
                <Text variant="caption" color="textSecondary">
                  {childCount} {childCount === 1 ? 'child' : 'children'}
                </Text>
              </View>
            </Row>
          )}
          <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginVertical: spacing.xs }} />
          <Touchable onPress={() => router.push('/children')} pressedScale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
            <IconBubble name="people-outline" />
            <Text variant="bodyMedium" style={{ flex: 1 }}>
              Manage children
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Touchable>
          <Touchable onPress={() => router.push('/members')} pressedScale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
            <IconBubble name="share-social-outline" />
            <Text variant="bodyMedium" style={{ flex: 1 }}>
              Members &amp; sharing
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Touchable>
        </Card>

        {/* Storage & plan */}
        {usage ? (
          <Card style={{ padding: spacing.lg, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="label" color="textMuted">
                STORAGE
              </Text>
              <Text variant="label" color="primary">
                {PLAN_LABELS[usage.plan] ?? usage.plan}
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.fill, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(pct * 100)}%`, height: 8, backgroundColor: colors.primary }} />
            </View>
            <Text variant="caption" color="textSecondary">
              {formatBytes(usedVideo)}
              {limit ? ` of ${formatBytes(limit)} video` : ' video · unlimited'} · {usage.photoCount} photos · {usage.videoCount} videos
            </Text>
          </Card>
        ) : null}

        {/* Privacy */}
        <Card style={{ padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <IconBubble name="location-outline" />
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium">Show photo location</Text>
            <Text variant="caption" color="textSecondary">
              Display where a photo was taken
            </Text>
          </View>
          <Switch
            value={!!activeFamily?.showPhotoLocation}
            onValueChange={onToggleLocation}
            disabled={locBusy}
            trackColor={{ true: colors.primary, false: colors.fill }}
            thumbColor="#fff"
          />
        </Card>

        {/* Refer */}
        {referral ? (
          <Card style={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <IconBubble name="gift-outline" />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">Refer a friend</Text>
                <Text variant="caption" color="textSecondary">
                  You both get {referral.rewardDays} days of Plus{referral.count ? ` · ${referral.count} joined` : ''}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                <Text variant="heading" color="primary">
                  {referral.code}
                </Text>
              </View>
              <Button title="Share" fullWidth={false} onPress={shareReferral} icon={<Ionicons name="share-outline" size={18} color={colors.onPrimary} />} />
            </View>
          </Card>
        ) : null}

        {/* Appearance */}
        <Card style={{ padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <IconBubble name="contrast-outline" />
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium">Appearance</Text>
            <Text variant="caption" color="textSecondary">
              Automatic — following your device ({scheme})
            </Text>
          </View>
        </Card>

        <Button variant="secondary" title="Sign out" icon={<Ionicons name="log-out-outline" size={18} color={colors.danger} />} onPress={() => signOut()} />

        <Text variant="caption" color="textMuted" center>
          Our Sweet Family
        </Text>
      </ScrollView>
    </Screen>
  );
}
