import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, Send } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Footer() {
  const { config } = useAppContext();
  const brand = config?.brand_color || '#f8812d';
  const platformName = config?.platform_name || 'Transferly';
  const supportEmail = config?.support_email || config?.email || 'support@transferly.app';
  const supportPhone = config?.phone || '+1-718-409-4162';

  return (
    <footer className="bg-[#0f0f0f] text-white">
      <div className="border-b border-white/8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-2xl space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Join Our Community</p>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-white">Stay close to updates, support, and new service drops.</h2>
            <p className="text-sm leading-7 text-white/65">
              Join the Telegram channel for support, vendor help, point funding guidance, and launch updates across the platform.
            </p>
          </div>
          <a
            href={config?.telegramSupportLink || 'https://t.me/+DhQqLRVqOHpmMmQ0'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 self-start rounded-full px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
            style={{ backgroundColor: brand }}
          >
            <Send size={16} />
            Join Telegram
          </a>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr] lg:px-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black text-white"
              style={{ backgroundColor: brand }}
            >
              TR
            </div>
            <div>
              <p className="text-lg font-black tracking-[-0.03em] text-white">{platformName}</p>
              <p className="text-xs uppercase tracking-[0.16em] text-white/35">Digital Services</p>
            </div>
          </div>
          <p className="max-w-sm text-sm leading-7 text-white/60">
            A trusted platform for receipts, flash emails, support-style pages, and utility tools powered by a single points balance.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-white/40">Resources</h3>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <Link to="/help" className="block transition hover:text-white">Help Center</Link>
            <Link to="/privacy" className="block transition hover:text-white">Privacy Policy</Link>
            <Link to="/terms" className="block transition hover:text-white">Terms & Conditions</Link>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-white/40">Company</h3>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <Link to="/about" className="block transition hover:text-white">About Us</Link>
            <Link to="/help" className="block transition hover:text-white">Contact Us</Link>
            <Link to="/miniapp" className="block transition hover:text-white">Open Mini App</Link>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-white/40">Contact</h3>
          <div className="mt-4 space-y-4 text-sm text-white/70">
            <a href={`mailto:${supportEmail}`} className="flex items-center gap-3 transition hover:text-white">
              <Mail size={16} />
              <span>{supportEmail}</span>
            </a>
            <a href={`tel:${supportPhone}`} className="flex items-center gap-3 transition hover:text-white">
              <Phone size={16} />
              <span>{supportPhone}</span>
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-5 text-sm text-white/45 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} {platformName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
