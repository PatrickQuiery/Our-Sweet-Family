import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../src/hooks/useApi';
import { useFamily } from '../src/context/FamilyProvider';
import { getMembers, inviteMember, removeMember } from '../src/lib/members';
import { getInvitations, revokeInvitation, PERMISSION_LABELS } from '../src/lib/invitations';
import { Button, Card, Chip, Input, Loading, Screen, Text, Touchable, useToast } from '../src/components/ui';
import { useTheme } from '../src/theme/ThemeProvider';
import { wideColumn } from '../src/lib/layout';
import type { Invitation, Member, Permission } from '../src/lib/types';

const PERMISSION_OPTIONS: Permission[] = ['view_only', 'upload', 'share_download', 'all'];

function Avatar({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="bodyMedium" color="primary">
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export default function Members() {
  const api = useApi();
  const { activeFamily, canManage, me } = useFamily();
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const familyId = activeFamily?.id ?? null;
  const manage = canManage();

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<Permission>('view_only');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!familyId || !manage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [m, inv] = await Promise.all([getMembers(api, familyId), getInvitations(api, familyId)]);
      setMembers(m);
      setInvites(inv);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [api, familyId, manage]);

  useEffect(() => {
    load();
  }, [load]);

  const onInvite = async () => {
    if (!familyId || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await inviteMember(api, { familyId, email: email.trim(), permissions: permission });
      setEmail('');
      if (res.inviteUrl) {
        await Share.share({ message: `Join our family on Our Sweet Family: ${res.inviteUrl}` });
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not send invite');
    } finally {
      setBusy(false);
    }
  };

  const onRemoveMember = (m: Member) => {
    Alert.alert('Remove member', `Remove ${m.user?.name ?? m.user?.email ?? 'this member'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(api, m.id);
            await load();
          } catch (e: any) {
            toast(e?.message ?? 'Could not remove this member. Please try again.', 'error');
          }
        },
      },
    ]);
  };

  const onRevoke = (inv: Invitation) => {
    Alert.alert('Revoke invitation', `Revoke the invite to ${inv.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          try {
            await revokeInvitation(api, inv.id);
            await load();
          } catch (e: any) {
            toast(e?.message ?? 'Could not revoke the invitation. Please try again.', 'error');
          }
        },
      },
    ]);
  };

  if (!manage) {
    return (
      <Screen padded>
        <Text variant="body" color="textSecondary">
          Only a parent can manage family members.
        </Text>
      </Screen>
    );
  }
  if (loading) return <Loading />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ ...wideColumn, padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        {/* Invite */}
        <Card style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text variant="heading">Invite a loved one</Text>
          <Input placeholder="Email address" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {PERMISSION_OPTIONS.map((p) => (
              <Chip key={p} label={PERMISSION_LABELS[p]} selected={permission === p} onPress={() => setPermission(p)} />
            ))}
          </View>
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
          <Button
            title="Send invite"
            onPress={onInvite}
            loading={busy}
            disabled={!email.trim()}
            icon={<Ionicons name="mail-outline" size={18} color={colors.onPrimary} />}
          />
        </Card>

        {/* Members */}
        <View style={{ gap: spacing.sm }}>
          <Text variant="label" color="textMuted">
            MEMBERS
          </Text>
          <Card style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar label={(me?.name?.[0] ?? me?.email?.[0] ?? '?') as string} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{me?.name ?? 'You'}</Text>
              <Text variant="caption" color="textSecondary">
                {me?.email ?? ''}
              </Text>
            </View>
            <Chip label="Owner" />
          </Card>
          {members.map((m) => (
            <Card key={m.id} style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Avatar label={(m.user?.name?.[0] ?? m.user?.email?.[0] ?? '?') as string} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{m.user?.name ?? m.user?.email ?? 'Member'}</Text>
                <Text variant="caption" color="textSecondary">
                  {PERMISSION_LABELS[m.permissions ?? 'view_only']}
                </Text>
              </View>
              <Touchable onPress={() => onRemoveMember(m)} style={{ padding: 8 }}>
                <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
              </Touchable>
            </Card>
          ))}
        </View>

        {/* Pending invitations */}
        {invites.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" color="textMuted">
              PENDING INVITATIONS
            </Text>
            {invites.map((inv) => (
              <Card key={inv.id} style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="hourglass-outline" size={20} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" numberOfLines={1}>
                    {inv.email}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {PERMISSION_LABELS[inv.permissions ?? 'view_only']} · pending
                  </Text>
                </View>
                <Touchable onPress={() => onRevoke(inv)} style={{ padding: 8 }}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Touchable>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
