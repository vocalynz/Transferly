import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Gift, Send, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/DashboardLayout';
import { useAppContext } from '../context/AppContext';

export default function ReferralPage() {
  const { profile, config, fetchReferrals } = useAppContext();
  const [copied, setCopied] = useState(false);
  const [referredUsers, setReferredUsers] = useState([]);
  const brand = config?.brand_color || '#f8812d';
  const bonus = config?.referral_bonus || 20;

  const referralLink = useMemo(
    () => `https://t.me/TransferlyBot?start=${profile?.referral_code || ''}`,
    [profile?.referral_code]
  );

  useEffect(() => {
    if (!profile?.referral_code) {
      return;
    }

    fetchReferrals(profile.referral_code).then(setReferredUsers);
  }, [fetchReferrals, profile?.referral_code]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Referral link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      toast.error('Failed to copy referral link');
    }
  };

  const totalEarned = (profile?.referral_count || 0) * bonus;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="rounded-[32px] bg-[#121212] px-6 py-7 text-white shadow-[0_28px_80px_rgba(15,23,42,0.18)] md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
                <Users size={14} />
                Referral Program
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] text-white md:text-5xl">
                Invite friends, grow your balance, and keep creating.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70 md:text-base">
                Every successful bot-start through your code adds {bonus} points to your account. Copy the link once and share it anywhere you drive traffic.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Users, label: 'Referrals', value: profile?.referral_count || 0 },
                { icon: Gift, label: 'Total earned', value: `${totalEarned} pts` },
                { icon: Wallet, label: 'Per invite', value: `${bonus} pts` }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-[24px] border border-white/8 bg-white/6 p-4">
                    <div className="flex items-center gap-2 text-white/50">
                      <Icon size={15} />
                      <p className="text-[11px] font-black uppercase tracking-[0.16em]">{item.label}</p>
                    </div>
                    <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-white">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="rounded-[30px] border border-[#e9e0d2] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Your invite link</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Share this once, get rewarded every time it converts.</h2>
            <div className="mt-5 rounded-[24px] border border-[#eadfce] bg-[#faf7f1] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  type="text"
                  value={referralLink}
                  readOnly
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none"
                />
                <button
                  onClick={copyToClipboard}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                  style={{ backgroundColor: brand }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy Link'}
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-full border border-[#eadfce] bg-white px-4 py-2 font-bold text-slate-700">
                  Code: <span className="ml-1 font-black tracking-[0.18em]" style={{ color: brand }}>{profile?.referral_code || 'N/A'}</span>
                </span>
                <button
                  onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Join Transferly and get started fast.')}`, '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center gap-2 rounded-full border border-[#eadfce] bg-white px-4 py-2 font-bold text-slate-700 transition hover:border-[#f2c39a] hover:text-slate-950"
                >
                  <Send size={15} />
                  Share on Telegram
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                { step: '01', title: 'Share your link', description: 'Post it in groups, communities, or send it directly to prospects.' },
                { step: '02', title: 'They open the bot', description: 'When Telegram passes your start code into the miniapp, the platform attributes the referral to you.' },
                { step: '03', title: 'You earn points', description: `Each successful invite credits ${bonus} points back to your Transferly balance.` }
              ].map((item) => (
                <div key={item.step} className="rounded-[24px] bg-[#faf7f1] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: brand }}>{item.step}</p>
                  <h3 className="mt-3 text-lg font-black tracking-[-0.03em] text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[30px] border border-[#e9e0d2] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Payout loop</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Turn referrals into tool usage quickly.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Your referral rewards go straight into your points wallet, so your next wallet record or notification can be generated without waiting for a manual top-up.
              </p>
              <Link
                to="/buy-point"
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#eadfce] bg-[#faf7f1] px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-[#f2c39a] hover:text-slate-950"
              >
                <Wallet size={16} />
                View balance options
              </Link>
            </div>

            <div className="rounded-[30px] border border-[#e9e0d2] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Recent invites</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{referredUsers.length} referred users</h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {referredUsers.length === 0 ? (
                  <div className="rounded-[24px] bg-[#faf7f1] px-4 py-5 text-sm text-slate-600">
                    No referrals yet. Share your link across the same channels where you already get traffic.
                  </div>
                ) : (
                  referredUsers.map((user, index) => (
                    <div key={`${user.email}-${index}`} className="rounded-[24px] bg-[#faf7f1] px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">{user.name || 'New member'}</p>
                          <p className="truncate text-xs font-semibold text-slate-500">{user.email}</p>
                        </div>
                        <div className="text-right text-xs font-bold text-slate-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
