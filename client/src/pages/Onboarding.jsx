import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { completeReferralIfPending } from '../lib/referral';

const STEPS = ['Family', 'Child', 'Invite'];

export default function Onboarding() {
  const { user, refreshFamily } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [familyName, setFamilyName] = useState(`The ${user?.name?.split(' ')[1] || user?.name} Family`);
  const [childName, setChildName] = useState('');
  const [childDob, setChildDob] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [familyId, setFamilyId] = useState(null);

  const handleFamily = async () => {
    if (!familyName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/families', { name: familyName });
      setFamilyId(data.family.id);
      // Now that a family exists, redeem any pending referral (grants both sides
      // Plus for 90 days). Best-effort — never blocks onboarding.
      completeReferralIfPending();
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create family');
    } finally {
      setLoading(false);
    }
  };

  const handleChild = async () => {
    if (!childName.trim() || !childDob) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/children', { familyId, name: childName, dateOfBirth: childDob });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add child');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (inviteEmail.trim()) {
      setLoading(true);
      setError('');
      try {
        await api.post('/members', {
          familyId,
          email: inviteEmail,
          permissions: 'view_only',
        });
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to invite');
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }
    await refreshFamily();
    navigate('/dashboard');
  };

  const skipInvite = async () => {
    await refreshFamily();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-pink-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex gap-2 mb-8 justify-center">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                i < step ? 'bg-brand-500 text-white' : i === step ? 'bg-brand-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 ${i < step ? 'bg-brand-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="card p-8">
          {step === 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Name your family</h2>
              <p className="text-gray-500 text-sm mb-6">This is how your family will appear on the platform.</p>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
              <input
                type="text"
                className="input mb-4"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="The Johnson Family"
              />
              <button className="btn-primary w-full" onClick={handleFamily} disabled={loading || !familyName.trim()}>
                {loading ? 'Creating...' : 'Continue'}
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Add your first child</h2>
              <p className="text-gray-500 text-sm mb-6">You can add more children later in the Children section.</p>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Child's name</label>
                  <input
                    type="text"
                    className="input"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="Emma"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date of birth</label>
                  <input
                    type="date"
                    className="input"
                    value={childDob}
                    onChange={(e) => setChildDob(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              <button className="btn-primary w-full" onClick={handleChild} disabled={loading || !childName.trim() || !childDob}>
                {loading ? 'Adding...' : 'Add child'}
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Invite a loved one</h2>
              <p className="text-gray-500 text-sm mb-6">Share access with grandparents, relatives, or close friends.</p>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Their email address</label>
                <input
                  type="email"
                  className="input"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="grandma@example.com"
                />
              </div>
              <button className="btn-primary w-full mb-3" onClick={handleInvite} disabled={loading}>
                {loading ? 'Inviting...' : 'Invite & go to dashboard'}
              </button>
              <button className="btn-ghost w-full text-sm text-gray-500" onClick={skipInvite}>
                Skip for now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
