import React from 'react';

const logoSrcBySlug = {
  opay: '/brand-logos/opay.png',
  kuda: '/brand-logos/kuda.png',
  palmpay: '/brand-logos/palmpay.png',
  binance: '/brand-logos/binance.png',
  bybit: '/brand-logos/bybit.png',
  coinbase: '/brand-logos/coinbase.png',
  paypal: '/brand-logos/paypal.png',
  'crypto-com': '/brand-logos/crypto-com.png',
  wise: '/brand-logos/wise.png',
  'cash-app': '/brand-logos/cash-app.png',
  zelle: '/brand-logos/zelle.png',
  venmo: '/brand-logos/venmo.png',
  'trust-wallet': '/brand-logos/trust-wallet.png',
  gcash: '/brand-logos/gcash.png',
  'ai-reply': '/brand-logos/ai-reply.svg',
  articles: '/brand-logos/articles.svg',
  'faker-data': '/brand-logos/faker-data.svg',
  stripe: '/brand-logos/stripe.svg',
  paystack: '/brand-logos/paystack.svg',
  flutterwave: '/brand-logos/flutterwave.svg',
  crypto: '/brand-logos/crypto.svg',
  'crypto-receipts': '/brand-logos/crypto-receipts.svg',
  'support-sites': '/brand-logos/support-sites.svg',
  'pass-clone': '/brand-logos/pass-clone.svg',
  'wallet-tracker': '/brand-logos/wallet-tracker.svg',
  'qr-code': '/brand-logos/qr-code.svg',
  'link-shortener': '/brand-logos/link-shortener.svg',
  investinnova: '/brand-logos/investinnova.svg'
};

export function ServiceLogo({ service, size = 'md', showTitle = false, className = '' }) {
  const accent = service?.accent || {
    bg: '#1f2937',
    fg: '#f8fafc',
    edge: '#374151',
    glow: 'rgba(31,41,55,0.2)'
  };

  const sizes = {
    sm: {
      wrap: 'h-12 w-12 rounded-2xl',
      image: 'h-7 w-7',
      title: 'text-[10px]'
    },
    md: {
      wrap: 'h-14 w-14 rounded-[20px]',
      image: 'h-8 w-8',
      title: 'text-[11px]'
    },
    lg: {
      wrap: 'h-24 w-24 rounded-[30px]',
      image: 'h-14 w-14',
      title: 'text-xs'
    }
  };

  const selected = sizes[size] || sizes.md;
  const logoSrc = service?.logoSrc || logoSrcBySlug[service?.slug] || null;

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        className={`relative flex items-center justify-center overflow-hidden border bg-white shadow-[0_18px_45px_var(--glow)] ${selected.wrap}`}
        style={{
          borderColor: accent.edge,
          '--glow': accent.glow
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.6),transparent_55%)]" />
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={service?.title || 'Service logo'}
            className={`relative z-10 object-contain ${selected.image}`}
            loading="lazy"
          />
        ) : (
          <span
            className="relative z-10 font-black tracking-[0.18em]"
            style={{ color: accent.bg }}
          >
            {service?.mark || 'TR'}
          </span>
        )}
      </div>

      {showTitle ? (
        <div>
          <p className={`font-black uppercase tracking-[0.16em] text-slate-400 ${selected.title}`}>{service?.category}</p>
          <p className="text-sm font-black text-slate-950">{service?.title}</p>
        </div>
      ) : null}
    </div>
  );
}

export default ServiceLogo;
