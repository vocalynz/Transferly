import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const publicLinks = [
  { label: 'Home', to: '/' },
  { label: 'Help', to: '/help' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/help' }
];

export default function Navbar() {
  const { user, logout, config } = useAppContext();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const brand = config?.brand_color || '#f8812d';

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate('/miniapp');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#111111]/92 text-white backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black text-white shadow-[0_16px_42px_rgba(248,129,45,0.33)]"
            style={{ backgroundColor: brand }}
          >
            TR
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Transferly</p>
            <p className="text-lg font-black tracking-[-0.03em] text-white">Digital Services</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {publicLinks.map((link) => (
            <Link key={link.label} to={link.to} className="text-sm font-semibold text-white/70 transition hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/8 hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/miniapp"
                className="rounded-full px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: brand }}
              >
                Open Mini App
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setMobileOpen((previous) => !previous)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 md:hidden"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#151515] px-4 py-4 md:hidden">
          <div className="space-y-2">
            {publicLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/6 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full rounded-2xl border border-white/10 px-4 py-3 text-left text-sm font-semibold text-white/75"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/miniapp"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-sm font-bold text-white"
                  style={{ backgroundColor: brand }}
                >
                  Open Mini App
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
