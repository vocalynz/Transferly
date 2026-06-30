import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, ShieldCheck, Smartphone, User2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/DashboardLayout';
import { useAppContext } from '../context/AppContext';

const tabs = [
  { key: 'profile', label: 'Profile', icon: User2 },
  { key: 'session', label: 'Session', icon: Smartphone },
  { key: 'danger', label: 'Danger Zone', icon: AlertTriangle }
];

function initialsFromName(name, email) {
  return (name || email || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function ProfilePage() {
  const { user, profile, receipts, updateProfile, deleteAccount, config, telegramAuthState } = useAppContext();
  const [activeTab, setActiveTab] = useState('profile');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '' });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const brand = config?.brand_color || '#f8812d';

  useEffect(() => {
    if (profile) {
      setFormData({ name: profile.name || '' });
    }
  }, [profile]);

  const memberSince = useMemo(() => {
    if (!profile?.created_at) {
      return 'Recently joined';
    }

    return new Date(profile.created_at).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }, [profile?.created_at]);

  const handleSaveProfile = async () => {
    if (!formData.name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setSaving(true);
    const result = await updateProfile({ name: formData.name.trim() });
    setSaving(false);

    if (result.success) {
      toast.success('Profile updated');
      setEditMode(false);
      return;
    }

    toast.error(result.message || 'Failed to update profile');
  };

  const handleDeleteAccount = async () => {
    const result = await deleteAccount();
    if (result.success) {
      toast.success('Account deleted');
      window.location.href = '/';
      return;
    }

    toast.error(result.message || 'Failed to delete account');
  };

  const initials = initialsFromName(profile?.name, user?.email);
  const stats = [
    { label: 'Points', value: `${Number(profile?.points || 0).toLocaleString()} pts` },
    { label: 'Receipts', value: receipts.length },
    { label: 'Referrals', value: profile?.referral_count || 0 }
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="rounded-[32px] bg-[#121212] px-6 py-7 text-white shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black text-white shadow-[0_18px_45px_rgba(248,129,45,0.28)]"
                style={{ backgroundColor: brand }}
              >
                {initials}
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-[-0.05em] text-white">
                {profile?.name || 'Transferly User'}
              </h1>
              <p className="mt-2 text-sm text-white/65">{user?.email}</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/70">
                <ShieldCheck size={14} />
                {profile?.is_admin ? 'Admin account' : 'Standard member'}
              </div>

              <div className="mt-6 grid gap-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-[24px] border border-white/8 bg-white/6 px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">{stat.label}</p>
                    <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-[#e9e0d2] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Account summary</p>
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                <div className="rounded-[24px] bg-[#faf7f1] px-4 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Member since</p>
                  <p className="mt-1 font-bold text-slate-950">{memberSince}</p>
                </div>
                <div className="rounded-[24px] bg-[#faf7f1] px-4 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Referral code</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="font-black tracking-[0.18em] text-slate-950">{profile?.referral_code || 'N/A'}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(profile?.referral_code || '');
                        toast.success('Referral code copied');
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-[#eadfce] bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-[#f2c39a] hover:text-slate-950"
                    >
                      <Copy size={14} />
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="rounded-[30px] border border-[#e9e0d2] bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap gap-3">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-black transition ${
                        active ? 'text-white shadow-[0_18px_45px_rgba(248,129,45,0.24)]' : 'border border-[#eadfce] bg-[#faf7f1] text-slate-700 hover:border-[#f2c39a] hover:text-slate-950'
                      }`}
                      style={active ? { backgroundColor: brand } : undefined}
                    >
                      <Icon size={16} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab === 'profile' && (
              <div className="rounded-[30px] border border-[#e9e0d2] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Personal info</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Manage your dashboard identity.</h2>
                  </div>
                  <button
                    onClick={() => setEditMode((current) => !current)}
                    className="text-sm font-black"
                    style={{ color: brand }}
                  >
                    {editMode ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                <div className="mt-6 grid gap-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Full name</span>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                      disabled={!editMode}
                      className="w-full rounded-2xl border border-[#e6ddd0] bg-[#faf7f1] px-4 py-3 text-sm text-slate-950 outline-none transition disabled:cursor-not-allowed disabled:opacity-70 focus:border-[#f2c39a]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Email address</span>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full rounded-2xl border border-[#e6ddd0] bg-[#f3efe7] px-4 py-3 text-sm text-slate-500 outline-none"
                    />
                  </label>

                  {editMode && (
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: brand }}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'session' && (
              <div className="rounded-[30px] border border-[#e9e0d2] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Telegram session</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Access is controlled by the bot and API session.</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Transferly uses Telegram Mini App init data to establish the API session, so there is no separate miniapp credential to manage here.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] bg-[#faf7f1] px-4 py-4 text-sm text-slate-600">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="mt-0.5 text-emerald-500" />
                      <div>
                        <p className="font-black text-slate-950">Session status</p>
                        <p className="mt-1 capitalize">{telegramAuthState || 'unavailable'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-[#faf7f1] px-4 py-4 text-sm text-slate-600">
                    <div className="flex items-start gap-3">
                      <ShieldCheck size={18} className="mt-0.5" style={{ color: brand }} />
                      <div>
                        <p className="font-black text-slate-950">Identity source</p>
                        <p className="mt-1">Telegram profile plus Transferly API wallet records.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'danger' && (
              <div className="rounded-[30px] border border-[#f0c9cd] bg-[#fff3f4] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.04)] md:p-7">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-500">Danger zone</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-red-950">Delete your account permanently.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-red-800/80">
                  This removes your profile and generated receipt history. There is no rollback path after confirmation.
                </p>
                <button
                  onClick={() => setDeleteModalOpen(true)}
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700"
                >
                  Delete Account
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-[30px] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between border-b border-[#efe5d6] px-6 py-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Delete account</p>
                <h3 className="mt-1 text-xl font-black tracking-[-0.04em] text-slate-950">Confirm permanent removal</h3>
              </div>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e6ddd0] bg-[#faf7f1] text-slate-500 transition hover:text-slate-950"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="rounded-[24px] bg-[#fff3f4] px-4 py-4 text-sm text-red-800">
                All receipts, profile records, and dashboard activity linked to this account will be removed.
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-[#e6ddd0] bg-[#faf7f1] px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-[#f2c39a] hover:text-slate-950"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700"
                >
                  Delete Forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
