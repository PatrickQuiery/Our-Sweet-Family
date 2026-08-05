import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../src/hooks/useApi';
import { useFamily } from '../src/context/FamilyProvider';
import { claimInvitation, getInvitationInfo, type InvitationInfo } from '../src/lib/invitations';
import { Button, Loading, Screen, Text } from '../src/components/ui';
import { useTheme } from '../src/theme/ThemeProvider';

export default function AcceptInvite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const api = useApi();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { refresh, setActiveFamilyId } = useFamily();
  const { colors, spacing } = useTheme();

  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invitation token.');
      setLoading(false);
      return;
    }
    getInvitationInfo(api, token)
      .then(setInfo)
      .catch((e: any) => setError(e?.message ?? 'Invitation not found'))
      .finally(() => setLoading(false));
  }, [api, token]);

  const onAccept = async () => {
    if (!token) return;
    setClaiming(true);
    setError(null);
    try {
      const res = await claimInvitation(api, token);
      await refresh();
      if (res.familyId) setActiveFamilyId(res.familyId);
      router.replace('/(app)');
    } catch (e: any) {
      setError(e?.message ?? 'Could not accept the invitation');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={error ? 'close-circle-outline' : 'heart'} size={36} color={colors.primary} />
        </View>

        {error ? (
          <>
            <Text variant="heading" center>
              Invitation unavailable
            </Text>
            <Text variant="body" color="textSecondary" center>
              {error}
            </Text>
            <Button title="Go to app" variant="secondary" onPress={() => router.replace('/(app)')} />
          </>
        ) : (
          <>
            <Text variant="title" center>
              {info?.familyName ?? 'A family'}
            </Text>
            <Text variant="body" color="textSecondary" center>
              {info?.inviterName ? `${info.inviterName} invited you` : 'You have been invited'} to share in their family's
              memories.
            </Text>
            {info?.email ? (
              <Text variant="caption" color="textMuted" center>
                Invitation for {info.email}
              </Text>
            ) : null}
            {isSignedIn ? (
              <Button title="Accept invitation" onPress={onAccept} loading={claiming} style={{ marginTop: spacing.md }} />
            ) : (
              <Button
                title="Sign in to accept"
                onPress={() => router.replace('/(auth)/sign-in')}
                style={{ marginTop: spacing.md }}
              />
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
