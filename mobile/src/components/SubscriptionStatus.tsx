import { useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Text } from './ui';
import { useBilling } from '../hooks/useBilling';
import { usePurchases } from '../context/PurchasesProvider';
import { useTheme } from '../theme/ThemeProvider';
import { nativeManagementURL } from '../lib/billing';

export function SubscriptionStatus() {
  const billing = useBilling();
  const purchases = usePurchases();
  const router = useRouter();
  const { spacing } = useTheme();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage(null);
    try { await action(); } catch { setMessage('Could not complete this action. Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const s = billing.status;
  return <Card style={{ padding: spacing.lg, gap: spacing.md }}>
    <Text variant="bodyMedium">{s ? `Our Sweet Family ${s.effectivePlan}` : 'Subscription'}</Text>
    {s ? <>
      <Text variant="caption" color="textSecondary">{!s.canManage ? 'Your family owner manages this shared plan.' : ['billing_issue', 'in_grace'].includes(s.subscriptionStatus ?? '') ? 'There is a payment issue. Check your subscription with the store.' : s.hasSubscription ? 'Your subscription is managed by the store where you purchased it.' : 'Explore plans for your family.'}</Text>
      {s.subscriptionExpiresAt ? <Text variant="caption">{s.subscriptionWillRenew ? 'Renews' : 'Access ends'} {new Date(s.subscriptionExpiresAt).toLocaleDateString()}</Text> : null}
      {s.planBoostUntil ? <Text variant="caption">Referral access through {new Date(s.planBoostUntil).toLocaleDateString()}</Text> : null}
      {s.canManage && (s.hasSubscription || purchases.hasSubscription) ? nativeManagementURL(s.subscriptionStore) ? <Button title="Manage subscription" disabled={busy} onPress={() => run(async () => {
        const sameStore = (Platform.OS === 'ios' && s.subscriptionStore === 'app_store') || (Platform.OS === 'android' && s.subscriptionStore === 'play_store');
        if (sameStore && purchases.ready) {
          try { await purchases.presentCustomerCenter(); }
          catch { await Linking.openURL(nativeManagementURL(s.subscriptionStore)!); return; }
          await billing.sync();
        } else {
          await Linking.openURL(nativeManagementURL(s.subscriptionStore)!);
        }
      })} /> : <Text variant="caption">Manage your subscription in the service where you originally purchased it.</Text> : null}
      {s.canManage && !s.hasSubscription && !purchases.hasSubscription ? <Button title="See plans" disabled={!purchases.ready || !s.syncAvailable || busy} onPress={() => router.push('/paywall')} /> : null}
      {s.canManage ? <Button title="Restore purchases" variant="secondary" disabled={!purchases.ready || busy} loading={busy} onPress={() => run(async () => {
        const restored = await purchases.restore();
        await billing.sync(restored);
        setMessage(restored ? 'Purchases restored and family access confirmed.' : 'No active purchases were found for this store account.');
      })} /> : null}
    </> : null}
    {purchases.error && s?.canManage ? <Text variant="caption">{purchases.error}</Text> : null}
    {s?.canManage && !s.syncAvailable ? <Text variant="caption">Subscription setup is not complete. Please check back soon.</Text> : null}
    {message ? <Text variant="caption">{message}</Text> : null}
    {billing.error ? <Text variant="caption">{billing.error}</Text> : null}
    {billing.error || billing.pending ? <Button title={billing.pending ? 'Retry confirmation' : 'Retry status'} variant="secondary" disabled={busy} onPress={() => run(async () => { if (billing.pending) await billing.sync(); else await billing.refresh(); })} /> : null}
  </Card>;
}
