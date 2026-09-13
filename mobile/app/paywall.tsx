import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { Button, Card, Text, useToast } from '../src/components/ui';
import { useTheme } from '../src/theme/ThemeProvider';
import { useBilling } from '../src/hooks/useBilling';
import { canPurchase, classifyPackage } from '../src/lib/billing';
import { SubscriptionStatus } from '../src/components/SubscriptionStatus';
import { usePurchases } from '../src/context/PurchasesProvider';

// Sunrise wash (matches the rest of the app's headers).
const LIGHT_G = ['#fff2c9', '#ffd3e2', '#cfe8ff'] as const;
const DARK_G = ['#33263f', '#2b2142', '#1b2540'] as const;

const PRIVACY_URL = 'https://oursweetfamily.com/privacy';
// Apple's standard EULA — required Terms link on the paywall unless we host our own.
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

type TierId = 'plus' | 'premium';
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
    features: ['Everything in Plus', 'Unlimited video', 'Every reel type', 'Private memories'],
    accent: true,
    badge: 'Most popular',
  },

};

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, scheme } = useTheme();
  const toast = useToast();
  const purchases = usePurchases();
  const billing = useBilling();
  const actionLock = useRef(false);
  const allowed = canPurchase(billing.status, purchases.ready, purchases.hasSubscription) && !billing.pending;

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('annual');
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const loadOfferings = useCallback(async () => {
    if (!allowed) { setLoading(false); setOffering(null); return; }
    setLoading(true);
    setError(null);
    try {
      const offerings = await purchases.getOfferings();
      setOffering(offerings.current ?? null);
      if (!offerings.current || offerings.current.availablePackages.length === 0) {
        setError('Plans are being set up — please check back soon.');
      }
    } catch (e: any) {
      setError('Could not load plans. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [allowed, purchases.getOfferings]);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  // Unknown products stay unavailable until their exact store IDs are configured.
  const { tiers, byTierPeriod, hasAnnual, hasMonthly } = useMemo(() => {
    const pkgs = offering?.availablePackages ?? [];
    const map: Partial<Record<TierId, Partial<Record<Period, PurchasesPackage>>>> = {};

    let annual = false;
    let monthly = false;
    for (const p of pkgs) {
      const c = classifyPackage(p);
      if (c) {

        (map[c.tier] ??= {})[c.period] = p;
        if (c.period === 'annual') annual = true;
        else monthly = true;
      }
    }
    const order: TierId[] = ['plus', 'premium'];
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

  const onBuy = useCallback(async (pkg: PurchasesPackage) => {
    if (!allowed || actionLock.current || !classifyPackage(pkg)) return;
    actionLock.current = true; setBuyingId(pkg.identifier);
    try {
      // Reconcile with RevenueCat immediately before opening the store checkout.
      const latest = await billing.sync();
      if (!canPurchase(latest, purchases.ready, purchases.hasSubscription)) return;
      await purchases.purchase(pkg);
      try {
        await billing.sync(true, classifyPackage(pkg)?.tier);
        toast('Subscription confirmed for your family.', 'success');
        router.back();
      } catch { toast('Purchase received. Family access confirmation is pending.', 'info'); }
    } catch (e: any) {
      if (!e?.userCancelled) toast(e?.message?.includes('subscription already exists') ? 'A subscription already exists. Use Manage subscription to make changes.' : 'Purchase could not be completed. Please try again.', 'error');
    } finally { actionLock.current = false; setBuyingId(null); }
  }, [allowed, billing, purchases, router, toast]);

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
        <SubscriptionStatus />
        {billing.pending ? <Button title="Retry purchase confirmation" onPress={async () => { try { await billing.sync(); toast("Family access confirmed.", "success"); } catch {} }} /> : null}
        {!allowed ? null : loading ? (
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
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {tiers.length === 0 ? <Text>No supported plans are available yet.</Text> : null}
            {/* Tier cards */}
            {tiers.map((tierId) => {
              const meta = TIER_META[tierId];
              const pkg = byTierPeriod[tierId]?.[period] ?? byTierPeriod[tierId]?.monthly ?? byTierPeriod[tierId]?.annual;
              if (!pkg) return null;
              const isAnnual = classifyPackage(pkg)?.period === 'annual';
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
                    disabled={!allowed || !!buyingId}
                    onPress={() => onBuy(pkg)}
                  />
                </Card>
              );
            })}

            {/* Footer */}
            <Text variant="caption" color="textMuted" center>
              Plans auto-renew until canceled. Manage anytime in your store subscription settings.
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
