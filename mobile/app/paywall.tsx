import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Purchases, {
  PACKAGE_TYPE,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { Button, Card, Text, useToast } from '../src/components/ui';
import { useTheme } from '../src/theme/ThemeProvider';
import { useFamily } from '../src/context/FamilyProvider';
import { usePurchases } from '../src/context/PurchasesProvider';

// Sunrise wash (matches the rest of the app's headers).
const LIGHT_G = ['#fff2c9', '#ffd3e2', '#cfe8ff'] as const;
const DARK_G = ['#33263f', '#2b2142', '#1b2540'] as const;

const PRIVACY_URL = 'https://oursweetfamily.com/privacy';
// Apple's standard EULA — required Terms link on the paywall unless we host our own.
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

type TierId = 'plus' | 'premium' | 'pro';
type Period = 'monthly' | 'annual';

const TIER_META: Record<TierId, { name: string; blurb: string; features: string[]; accent: boolean; badge?: string }> = {
  plus: {
    name: 'Plus',
    blurb: 'For growing families',
    features: ['200 GB of video', 'HD photo quality', 'Monthly memory reels', 'Milestones & growth', 'Export your originals'],
    accent: false,
  },
  premium: {
    name: 'Premium',
    blurb: 'Everything, unlimited',
    features: ['Everything in Plus', 'Unlimited video', 'Every reel type', 'AI face tagging', 'Private memories'],
    accent: true,
    badge: 'Most popular',
  },
  // Fallback when the offering isn't split into Plus/Premium yet.
  pro: {
    name: 'Our Sweet Family Pro',
    blurb: 'Unlock everything',
    features: ['Unlimited video', 'HD photos', 'All memory reels', 'Milestones & growth', 'Private memories'],
    accent: true,
  },
};

function classify(pkg: PurchasesPackage): { tier: TierId; period: Period } | null {
  const s = `${pkg.identifier} ${pkg.product?.identifier ?? ''}`.toLowerCase();
  const tier: TierId | null = s.includes('premium') ? 'premium' : s.includes('plus') ? 'plus' : null;
  if (!tier) return null;
  const annual = pkg.packageType === PACKAGE_TYPE.ANNUAL || /annual|year/.test(s);
  const monthly = pkg.packageType === PACKAGE_TYPE.MONTHLY || /month/.test(s);
  if (annual) return { tier, period: 'annual' };
  if (monthly) return { tier, period: 'monthly' };
  return null;
}

function periodOf(pkg: PurchasesPackage): Period | null {
  const s = `${pkg.identifier} ${pkg.product?.identifier ?? ''}`.toLowerCase();
  if (pkg.packageType === PACKAGE_TYPE.ANNUAL || /annual|year/.test(s)) return 'annual';
  if (pkg.packageType === PACKAGE_TYPE.MONTHLY || /month/.test(s)) return 'monthly';
  return null;
}

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, scheme } = useTheme();
  const toast = useToast();
  const { refresh } = usePurchases();
  const { refresh: refreshFamily } = useFamily();

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('annual');
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const loadOfferings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offerings = await Purchases.getOfferings();
      setOffering(offerings.current ?? null);
      if (!offerings.current || offerings.current.availablePackages.length === 0) {
        setError('Plans are being set up — please check back soon.');
      }
    } catch (e: any) {
      setError('Could not load plans. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  // Bucket packages by tier + period; fall back to a single "pro" tier if the
  // offering isn't split into Plus/Premium yet.
  const { tiers, byTierPeriod, hasAnnual, hasMonthly } = useMemo(() => {
    const pkgs = offering?.availablePackages ?? [];
    const map: Partial<Record<TierId, Partial<Record<Period, PurchasesPackage>>>> = {};
    let sawTier = false;
    let annual = false;
    let monthly = false;
    for (const p of pkgs) {
      const c = classify(p);
      if (c) {
        sawTier = true;
        (map[c.tier] ??= {})[c.period] = p;
        if (c.period === 'annual') annual = true;
        else monthly = true;
      }
    }
    if (!sawTier) {
      // Fallback: treat everything as one tier.
      for (const p of pkgs) {
        const per = periodOf(p);
        if (!per) continue;
        (map.pro ??= {})[per] = p;
        if (per === 'annual') annual = true;
        else monthly = true;
      }
    }
    const order: TierId[] = sawTier ? ['plus', 'premium'] : ['pro'];
    return {
      tiers: order.filter((t) => map[t]),
      byTierPeriod: map,
      hasAnnual: annual,
      hasMonthly: monthly,
    };
  }, [offering]);

  // Keep the selected period valid for what's on offer.
  useEffect(() => {
    if (period === 'annual' && !hasAnnual && hasMonthly) setPeriod('monthly');
    if (period === 'monthly' && !hasMonthly && hasAnnual) setPeriod('annual');
  }, [hasAnnual, hasMonthly]); // eslint-disable-line react-hooks/exhaustive-deps

  const onBuy = useCallback(
    async (pkg: PurchasesPackage) => {
      setBuyingId(pkg.identifier);
      try {
        await Purchases.purchasePackage(pkg);
        await Promise.all([refresh(), refreshFamily()]);
        toast('Subscription active — thank you! 🎉', 'success');
        router.back();
      } catch (e: any) {
        if (!e?.userCancelled) toast(e?.message ?? 'Purchase failed. Please try again.', 'error');
      } finally {
        setBuyingId(null);
      }
    },
    [refresh, refreshFamily, router, toast],
  );

  const onRestore = useCallback(async () => {
    try {
      const info = await Purchases.restorePurchases();
      const active = Object.keys(info.entitlements.active).length > 0;
      await Promise.all([refresh(), refreshFamily()]);
      if (active) {
        toast('Purchases restored', 'success');
        router.back();
      } else {
        toast('No purchases to restore', 'info');
      }
    } catch {
      toast('Could not restore purchases', 'error');
    }
  }, [refresh, refreshFamily, router, toast]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Sunrise header */}
      <LinearGradient
        colors={scheme === 'dark' ? DARK_G : LIGHT_G}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={26} color={colors.primary} />
          </View>
          <Text variant="title" center style={{ marginTop: spacing.xs }}>
            Unlock every memory
          </Text>
          <Text variant="body" color="textSecondary" center>
            Choose the plan that fits your family.
          </Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        {loading ? (
          <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <Card style={{ padding: spacing.lg, alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
            <Text variant="body" color="textSecondary" center>
              {error}
            </Text>
            <Button title="Try again" variant="secondary" onPress={loadOfferings} />
          </Card>
        ) : (
          <>
            {/* Monthly / Annual toggle */}
            {hasAnnual && hasMonthly ? (
              <View style={{ flexDirection: 'row', backgroundColor: colors.fill, borderRadius: radius.pill, padding: 4 }}>
                {(['monthly', 'annual'] as Period[]).map((p) => {
                  const active = period === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setPeriod(p)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: radius.pill, backgroundColor: active ? colors.surface : 'transparent' }}
                    >
                      <Text variant="bodyMedium" color={active ? 'text' : 'textMuted'}>
                        {p === 'monthly' ? 'Monthly' : 'Annual'}
                      </Text>
                      {p === 'annual' ? (
                        <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text variant="label" color="primary">
                            Save 17%
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* Tier cards */}
            {tiers.map((tierId) => {
              const meta = TIER_META[tierId];
              const pkg = byTierPeriod[tierId]?.[period] ?? byTierPeriod[tierId]?.monthly ?? byTierPeriod[tierId]?.annual;
              if (!pkg) return null;
              const isAnnual = periodOf(pkg) === 'annual';
              const busy = buyingId === pkg.identifier;
              return (
                <Card
                  key={tierId}
                  style={{
                    padding: spacing.lg,
                    gap: spacing.md,
                    borderWidth: meta.accent ? 2 : 1,
                    borderColor: meta.accent ? colors.primary : colors.borderSubtle,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text variant="heading">{meta.name}</Text>
                      <Text variant="caption" color="textSecondary">
                        {meta.blurb}
                      </Text>
                    </View>
                    {meta.badge ? (
                      <View style={{ backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text variant="label" color="onPrimary">
                          {meta.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                    <Text variant="display">{pkg.product.priceString}</Text>
                    <Text variant="body" color="textSecondary" style={{ marginBottom: 6 }}>
                      {isAnnual ? '/ year' : '/ month'}
                    </Text>
                  </View>

                  <View style={{ gap: spacing.sm }}>
                    {meta.features.map((f) => (
                      <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                        <Text variant="body">{f}</Text>
                      </View>
                    ))}
                  </View>

                  <Button
                    title={`Choose ${meta.name}`}
                    variant={meta.accent ? 'primary' : 'secondary'}
                    loading={busy}
                    onPress={() => onBuy(pkg)}
                  />
                </Card>
              );
            })}

            {/* Footer */}
            <Pressable onPress={onRestore} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: spacing.sm }}>
              <Text variant="bodyMedium" color="primary">
                Restore purchases
              </Text>
            </Pressable>
            <Text variant="caption" color="textMuted" center>
              Plans auto-renew until canceled. Manage anytime in your App Store settings.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md }}>
              <Pressable onPress={() => Linking.openURL(TERMS_URL)} hitSlop={8}>
                <Text variant="caption" color="textSecondary">
                  Terms
                </Text>
              </Pressable>
              <Text variant="caption" color="textMuted">
                ·
              </Text>
              <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8}>
                <Text variant="caption" color="textSecondary">
                  Privacy
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
