import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/DialogProvider';
import api from '../lib/api';

const PERMISSION_LABELS = {
  view_only: 'View only',
  upload: 'Can upload',
  share_download: 'Can share & download',
  all: 'Parent (full access)',
};

const PERMISSION_COLORS = {
  view_only: 'bg-ink/5 text-ink-soft',
  upload: 'bg-blue-100 text-blue-700',
  share_download: 'bg-green-100 text-green-700',
  all: 'bg-brand-100 text-brand-700',
};

export default function Family() {
  const confirm = useConfirm();
  const toast = useToast();
  const { user, family, refreshFamily } = useAuth();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', permissions: 'view_only' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isOwner = user?.role === 'owner';

  useEffect(() => {
    if (!family || !isOwner) { setLoading(false); return; }
    Promise.all([
      api.get(`/members?familyId=${family.id}`),
      api.get(`/invitations?familyId=${family.id}`),
    ]).then(([mRes, iRes]) => {
      setMembers(mRes.data.members);
      setInvitations(iRes.data.invitations);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [family, isOwner]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviteLink('');
    setCopied(false);
    setSubmitting(true);
    try {
      const { data } = await api.post('/members', {
        familyId: family.id,
        email: inviteForm.email,
        permissions: inviteForm.permissions,
      });
      if (data.member) {
        // Existing user — added directly.
        setMembers((prev) => [...prev, data.member]);
        setSuccess(`${inviteForm.email} already has an account and was added.`);
      } else if (data.invitation) {
        // New email — pending invitation with a shareable link.
        setInvitations((prev) => [data.invitation, ...prev]);
        setInviteLink(data.inviteUrl);
        setSuccess(`Invitation created for ${inviteForm.email}. Share the link below.`);
      }
      setInviteForm({ email: '', permissions: 'view_only' });
      setShowInvite(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to invite');
    } finally {
      setSubmitting(false);
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleRevokeInvite = async (id) => {
    const ok = await confirm({ title: 'Revoke this pending invitation?', confirmLabel: 'Revoke', destructive: true });
    if (!ok) return;
    try {
      await api.delete(`/invitations/${id}`);
      setInvitations((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to revoke', 'error');
    }
  };

  const handleUpdatePermission = async (memberId, permissions) => {
    try {
      const { data } = await api.put(`/members/${memberId}`, { permissions });
      setMembers((prev) => prev.map((m) => (m.id === memberId ? data.member : m)));
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to update', 'error');
    }
  };

  const handleRevoke = async (memberId) => {
    const ok = await confirm({ title: "Revoke this person's access?", confirmLabel: 'Revoke', destructive: true });
    if (!ok) return;
    try {
      await api.delete(`/members/${memberId}`);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to revoke', 'error');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="type-title text-ink">Family Members</h1>
          <p className="text-ink-muted text-sm mt-1">{family?.name}</p>
        </div>
        {isOwner && (
          <button onClick={() => setShowInvite(!showInvite)} className="btn-primary">
            + Invite
          </button>
        )}
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-4">{success}</div>
      )}

      {inviteLink && (
        <div className="card p-4 mb-4 bg-brand-50 border-brand-200">
          <p className="text-sm font-medium text-ink-soft mb-2">Invite link — share it with your loved one:</p>
          <div className="flex gap-2">
            <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} className="input flex-1 text-xs" />
            <button onClick={copyInviteLink} className="btn-primary text-sm whitespace-nowrap">
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          <p className="text-xs text-ink-muted mt-2">We also emailed this link. It expires in 7 days.</p>
        </div>
      )}

      {showInvite && isOwner && (
        <div className="card p-5 mb-6">
          <h3 className="font-semibold text-ink mb-4">Invite a loved one</h3>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
          <form onSubmit={handleInvite} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Email address</label>
              <input
                type="email"
                className="input"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="grandma@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Access level</label>
              <select
                className="input"
                value={inviteForm.permissions}
                onChange={(e) => setInviteForm({ ...inviteForm, permissions: e.target.value })}
              >
                {Object.entries(PERMISSION_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Inviting...' : 'Send invite'}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowInvite(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {isOwner && invitations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-2">Pending invitations</h2>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="card p-4 flex items-center gap-4 border-dashed">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink text-sm truncate">{inv.email}</p>
                  <p className="text-xs text-ink-muted">Invited · awaiting acceptance</p>
                </div>
                <button
                  onClick={() => handleRevokeInvite(inv.id)}
                  className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0 text-sm font-medium"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isOwner ? (
        <div className="card p-6 text-center">
          <p className="text-ink-muted">Family member management is available to the family owner.</p>
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="text-lg font-semibold text-ink mb-2">No loved ones invited yet</h3>
          <p className="text-ink-muted text-sm">Invite grandparents, relatives, and close friends to share in the memories.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm flex-shrink-0">
                {member.user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-sm">{member.user?.name}</p>
                <p className="text-xs text-ink-muted truncate">{member.user?.email}</p>
              </div>
              <select
                value={member.permissions}
                onChange={(e) => handleUpdatePermission(member.id, e.target.value)}
                className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${PERMISSION_COLORS[member.permissions]}`}
              >
                {Object.entries(PERMISSION_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <button
                onClick={() => handleRevoke(member.id)}
                className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                title="Revoke access"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
