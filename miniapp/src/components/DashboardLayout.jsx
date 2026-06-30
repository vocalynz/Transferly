import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Clock3,
  Copy,
  FileText,
  Home,
  Menu,
  MessageCircle,
  Settings,
  Shield,
  Sparkles,
  Users,
  Wallet,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';

const navItems = [
  { icon: Home, label: 'Dashboard', paths: ['/dashboard'] },
  { icon: Sparkles, label: 'Services', paths: ['/services', '/dashboard/generate'] },
  { icon: Clock3, label: 'Transactions', paths: ['/transactions', '/dashboard/history'] },
  { icon: Users, label: 'Referral', paths: ['/referral', '/dashboard/referral'] },
  { icon: Settings, label: 'Settings', paths: ['/profile', '/dashboard/profile'] }
];

function initialsFromUser(profile, user) {
  const source = profile?.name || user?.name || user?.email || 'U';
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0].toUpperCase())
    .join('');
}

export default function DashboardLayout({ children }) {
  const { user, profile, config, logout } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const brand = config?.brand_color || '#f8812d';

  const referralLink = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return `https://t.me/TransferlyBot?start=${profile?.referral_code || ''}`;
  }, [profile?.referral_code]);

  const points = Number(profile?.points || 0);
  const initials = initialsFromUser(profile, user);

  const isActive = (paths) => paths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCopyReferral = async () => {
    if (!referralLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success('Referral link copied');
    } catch (_error) {
      toast.error('Unable to copy referral link');
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-[#121212] text-white">
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-5">
        <Link to="/" className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black text-white shadow-[0_18px_45px_rgba(248,129,45,0.32)]"
            style={{ backgroundColor: brand }}
          >
            TR
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Transferly</p>
            <p className="text-lg font-black tracking-[-0.03em] text-white">Workspace</p>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-full border border-white/10 p-2 text-white/70 md:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-5 pt-5">
        <div className="rounded-[22px] border border-white/8 bg-white/5 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Current balance</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-3xl font-black tracking-[-0.04em]">{points.toLocaleString()}</span>
            <span className="pb-1 text-sm font-semibold text-white/55">pts</span>
          </div>
          <Link
            to="/buy-point"
            onClick={() => setMobileOpen(false)}
            className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
            style={{ backgroundColor: brand }}
          >
            <Wallet size={16} />
            Buy Points
          </Link>
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const active = isActive(item.paths);
          const Icon = item.icon;
          const to = item.paths[0];

          return (
            <Link
              key={item.label}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                active ? 'bg-white text-slate-950 shadow-[0_18px_40px_rgba(255,255,255,0.12)]' : 'text-white/65 hover:bg-white/6 hover:text-white'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {profile?.is_admin && (
          <Link
            to="/admin"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              location.pathname.startsWith('/admin') ? 'bg-white text-slate-950' : 'text-white/65 hover:bg-white/6 hover:text-white'
            }`}
          >
            <Shield size={18} />
            <span>Admin</span>
          </Link>
        )}
      </nav>

      <div className="border-t border-white/8 px-5 py-5">
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/8 hover:text-white"
        >
          <ArrowUpRight size={16} />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f6f4ee]" style={{ fontFamily: 'Nunito, ui-sans-serif, system-ui, sans-serif' }}>
      <div className="flex min-h-screen">
        <aside className="hidden w-[290px] shrink-0 md:block">{sidebar}</aside>

        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-slate-950/55 md:hidden" onClick={() => setMobileOpen(false)} />
            <aside className="fixed inset-y-0 left-0 z-50 w-[290px] md:hidden">{sidebar}</aside>
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[#e9e4da] bg-[#faf8f3]">
            <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e4ddd0] bg-white text-slate-700 md:hidden"
                >
                  <Menu size={20} />
                </button>
                <div className="hidden items-center gap-3 rounded-full border border-[#ebe4d9] bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 sm:flex">
                  <FileText size={15} className="text-slate-400" />
                  <span>Referred:</span>
                  <span className="text-slate-950">{profile?.referral_count || 0}</span>
                  <button
                    onClick={handleCopyReferral}
                    className="inline-flex items-center gap-1 text-slate-500 transition hover:text-slate-900"
                  >
                    <Copy size={13} />
                    Copy Ref Link
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to="/buy-point"
                  className="hidden rounded-full px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 sm:inline-flex"
                  style={{ backgroundColor: brand }}
                >
                  Buy Points
                </Link>
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-3 rounded-full border border-[#e6dfd3] bg-white px-2.5 py-2 text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white"
                    style={{ backgroundColor: brand }}
                  >
                    {initials}
                  </div>
                  <div className="hidden pr-1 text-left sm:block">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Balance</p>
                    <p className="text-sm font-black tracking-[-0.03em] text-slate-950">{points.toLocaleString()}pts</p>
                  </div>
                </Link>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
      <a
        href="https://t.me/+DhQqLRVqOHpmMmQ0"
        target="_blank"
        rel="noreferrer"
        aria-label="Chat with us on Telegram"
        className="fixed bottom-5 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#229ed9] text-white shadow-[0_18px_45px_rgba(34,158,217,0.32)] transition hover:translate-y-[-2px] hover:bg-[#1b8fc6]"
      >
        <MessageCircle size={24} />
      </a>
    </div>
  );
}
