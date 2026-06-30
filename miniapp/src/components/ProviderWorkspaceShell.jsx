import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { getProviderWorkspaceRoute } from '../lib/providerManifests';

const statusTone = {
  live: 'text-emerald-200 border-emerald-400/30 bg-emerald-400/10',
  healthy: 'text-emerald-200 border-emerald-400/30 bg-emerald-400/10',
  connected: 'text-emerald-200 border-emerald-400/30 bg-emerald-400/10',
  setup: 'text-sky-100 border-sky-400/30 bg-sky-400/10',
  pending: 'text-sky-100 border-sky-400/30 bg-sky-400/10',
  retrying: 'text-sky-100 border-sky-400/30 bg-sky-400/10',
  degraded: 'text-amber-100 border-amber-400/30 bg-amber-400/10',
  'rate-limited': 'text-amber-100 border-amber-400/30 bg-amber-400/10',
  success: 'text-emerald-200 border-emerald-400/30 bg-emerald-400/10',
  error: 'text-red-100 border-red-400/30 bg-red-400/10',
  disabled: 'text-[var(--tg-hint-color)] border-white/10 bg-white/5'
};

const workspaceStateCopy = {
  loading: {
    icon: Loader2,
    title: 'Loading provider workspace',
    detail: 'Preparing the latest Transferly provider context.',
    spin: true
  },
  empty: {
    icon: CheckCircle2,
    title: 'No provider records yet',
    detail: 'This workspace is ready for lane-specific provider data in the next migration phase.'
  },
  success: {
    icon: CheckCircle2,
    title: 'Provider workspace updated',
    detail: 'The latest Transferly provider context is ready.'
  },
  setup: {
    icon: CheckCircle2,
    title: 'Provider setup required',
    detail: 'This lane is scaffolded in Transferly and will become active after the provider adapter, secrets, webhooks, and persistence are connected.'
  },
  preview: {
    icon: CheckCircle2,
    title: 'Preview lane',
    detail: 'This lane is available for workspace planning while some provider operations are still being completed.'
  },
  unavailable: {
    icon: AlertCircle,
    title: 'Provider lane unavailable',
    detail: 'Transferly has not enabled this provider lane yet.'
  },
  disabled: {
    icon: AlertCircle,
    title: 'Provider lane disabled',
    detail: 'This lane is currently disabled by Transferly configuration or provider readiness checks.'
  },
  retrying: {
    icon: Loader2,
    title: 'Retrying provider workspace',
    detail: 'Transferly is checking the latest provider state again.',
    spin: true
  },
  'rate-limited': {
    icon: Clock3,
    title: 'Too many refreshes',
    detail: 'Wait a moment, then retry the provider workspace request.'
  },
  planned: {
    icon: CheckCircle2,
    title: 'Provider lane planned',
    detail: 'This workspace lane is reserved for a future provider rollout.'
  }
};

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function Badge({ children, tone = 'default' }) {
  const toneClass = statusTone[tone] || 'text-[var(--tg-subtitle-text-color)] border-white/10 bg-white/5';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${toneClass}`}>
      {children}
    </span>
  );
}

function ProviderLogo({ manifest }) {
  const [logoFailed, setLogoFailed] = React.useState(false);
  const shouldRenderLogo = Boolean(manifest.logoAsset && !logoFailed);

  return (
    <div
      className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[18px] border shadow-[0_18px_48px_rgba(0,0,0,0.24)]"
      style={{
        borderColor: 'var(--provider-accent-border)',
        background: 'linear-gradient(135deg, var(--provider-accent), color-mix(in srgb, var(--provider-accent) 52%, #1d4ed8))'
      }}
      aria-hidden="true"
    >
      {shouldRenderLogo ? (
        <img
          src={manifest.logoAsset}
          alt=""
          className="h-8 w-8 object-contain"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span className="text-sm font-black text-white">{manifest.iconLabel || manifest.displayName?.slice(0, 2)}</span>
      )}
    </div>
  );
}

function getBrandResources(brand = {}) {
  return [
    brand.assetSourceUrl
      ? {
          label: brand.assetSourceLabel || 'Brand assets',
          href: brand.assetSourceUrl
        }
      : null,
    brand.guidelinesUrl
      ? {
          label: brand.guidelinesLabel || 'Brand guidelines',
          href: brand.guidelinesUrl
        }
      : null,
    brand.buttonGuideUrl
      ? {
          label: brand.buttonGuideLabel || 'Button guide',
          href: brand.buttonGuideUrl
        }
      : null
  ].filter(Boolean);
}

function ProviderBrandPanel({ manifest }) {
  const brand = manifest.brand;

  if (!brand) {
    return null;
  }

  const resources = getBrandResources(brand);
  const principles = Array.isArray(brand.layoutPrinciples) ? brand.layoutPrinciples : [];

  return (
    <section
      className="rounded-[24px] border border-[var(--provider-accent-border)] bg-[linear-gradient(150deg,var(--provider-accent-soft),rgba(255,255,255,0.035))] p-4"
      aria-label={`${manifest.displayName} brand resources`}
    >
      <div className="flex items-start gap-3">
        <ProviderLogo manifest={manifest} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">
            Provider branding
          </p>
          <h2 className="mt-1 text-base font-black text-[var(--tg-text-color)]">{brand.label}</h2>
          {brand.summary ? (
            <p className="mt-2 text-xs font-semibold leading-5 text-[var(--tg-subtitle-text-color)]">{brand.summary}</p>
          ) : null}
        </div>
      </div>

      {principles.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {principles.map((principle) => (
            <span
              key={principle}
              className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] font-extrabold text-[var(--tg-text-color)]"
            >
              {principle}
            </span>
          ))}
        </div>
      ) : null}

      {resources.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {resources.map((resource) => (
            <a
              key={resource.href}
              href={resource.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-3 text-xs font-black text-[var(--tg-text-color)]"
            >
              {resource.label}
              <ExternalLink size={13} />
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function WorkspaceState({ state, error, onRetry, children }) {
  if (state === 'error') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-[24px] border border-[var(--tg-destructive-text-color)]/30 bg-[var(--tg-destructive-text-color)]/10 p-5"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 shrink-0 text-[var(--tg-destructive-text-color)]" size={20} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[var(--tg-text-color)]">Provider workspace unavailable</p>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
              {error || 'Transferly could not prepare this provider workspace.'}
            </p>
          </div>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            aria-label="Retry loading provider workspace"
            className="mt-4 inline-flex min-h-[42px] items-center gap-2 rounded-2xl bg-[var(--tg-button-color)] px-4 text-sm font-black text-[var(--tg-button-text-color)]"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  const stateCopy = workspaceStateCopy[state];
  if (stateCopy) {
    const Icon = stateCopy.icon;
    const canRetry = onRetry && ['disabled', 'rate-limited', 'unavailable'].includes(state);

    return (
      <div
        role={stateCopy.spin ? 'status' : 'note'}
        aria-live={stateCopy.spin ? 'polite' : undefined}
        aria-busy={stateCopy.spin ? 'true' : undefined}
        className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 text-center"
      >
        <Icon className={`mx-auto text-[var(--tg-button-color)] ${stateCopy.spin ? 'animate-spin' : ''}`} size={22} />
        <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">{stateCopy.title}</p>
        <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{stateCopy.detail}</p>
        {canRetry ? (
          <button
            type="button"
            onClick={onRetry}
            aria-label="Retry provider workspace"
            className="mt-4 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.065] px-4 text-sm font-black text-[var(--tg-text-color)]"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  return children;
}

// Transferly owns the page chrome; provider identity stays secondary metadata
// rather than a cloned provider dashboard.
export default function ProviderWorkspaceShell({
  manifest,
  activeLane = 'overview',
  lanes = [],
  environment = '',
  connectionStatus = '',
  capabilities = [],
  quickActions = [],
  state = 'ready',
  error = '',
  onRetry,
  children
}) {
  if (!manifest) {
    return null;
  }

  const status = normalizeStatus(connectionStatus || manifest.status);
  const environmentLabel = Array.isArray(environment) ? environment.join(' + ') : environment;

  return (
    <div
      className="space-y-4"
      style={{
        '--provider-accent': manifest.theme?.accentColor || 'var(--tg-button-color)',
        '--provider-accent-soft': manifest.theme?.accentSoft || 'rgba(96,165,250,0.14)',
        '--provider-accent-border': manifest.theme?.accentBorder || 'rgba(96,165,250,0.28)'
      }}
    >
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(150deg,rgba(255,255,255,0.075),rgba(255,255,255,0.03))] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.24)]">
        <Link
          to="/miniapp/services"
          className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--tg-subtitle-text-color)]"
        >
          <ArrowLeft size={14} />
          Services
        </Link>

        <div className="mt-5 flex items-start gap-4">
          <ProviderLogo manifest={manifest} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">
              Transferly provider workspace
            </p>
            <h1 className="mt-1 text-2xl font-black leading-tight text-[var(--tg-text-color)]">{manifest.displayName}</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
              {manifest.shortDescription}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {environmentLabel ? <Badge tone="setup">{environmentLabel}</Badge> : null}
          {status ? <Badge tone={status}>{connectionStatus || manifest.status}</Badge> : null}
          {manifest.launcherStatusLabel ? <Badge>{manifest.launcherStatusLabel}</Badge> : null}
        </div>

        {capabilities.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {capabilities.map((capability) => (
              <span
                key={capability}
                className="rounded-full border border-[var(--provider-accent-border)] bg-[var(--provider-accent-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--tg-text-color)]"
              >
                {capability}
              </span>
            ))}
          </div>
        ) : null}

        {(manifest.docsUrl || manifest.supportUrl) ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {manifest.docsUrl ? (
              <a
                href={manifest.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-xs font-black text-[var(--tg-text-color)]"
              >
                <BookOpen size={15} />
                Docs
                <ExternalLink size={13} />
              </a>
            ) : null}
            {manifest.supportUrl ? (
              <a
                href={manifest.supportUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-xs font-black text-[var(--tg-text-color)]"
              >
                Help
                <ExternalLink size={13} />
              </a>
            ) : null}
          </div>
        ) : null}
      </section>

      <ProviderBrandPanel manifest={manifest} />

      {lanes.length ? (
        <nav className="flex gap-2 overflow-x-auto rounded-[24px] border border-white/10 bg-[var(--tg-secondary-bg-color)] p-2" aria-label={`${manifest.displayName} lanes`}>
          {lanes.map((lane) => {
            const isActive = lane.id === activeLane;

            return (
              <Link
                key={lane.id}
                to={getProviderWorkspaceRoute(manifest.slug, lane.id)}
                className={`min-h-[42px] shrink-0 rounded-2xl px-4 py-2 text-center text-xs font-black transition ${
                  isActive
                    ? 'bg-[var(--provider-accent-soft)] text-[var(--tg-text-color)] ring-1 ring-[var(--provider-accent-border)]'
                    : 'text-[var(--tg-subtitle-text-color)] hover:bg-white/[0.045] hover:text-[var(--tg-text-color)]'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="block sm:hidden">{lane.shortLabel || lane.label}</span>
                <span className="hidden sm:block">{lane.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      {quickActions.length ? (
        <section className="grid gap-2 sm:grid-cols-3">
          {quickActions.map((action) => {
            const content = (
              <>
                <span className="min-w-0 flex-1">{action.label}</span>
                {action.external ? <ExternalLink size={14} /> : null}
              </>
            );

            if (action.external) {
              return (
                <a
                  key={action.label}
                  href={action.to}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.045] px-4 text-sm font-black text-[var(--tg-text-color)]"
                >
                  {content}
                </a>
              );
            }

            return (
              <Link
                key={action.label}
                to={action.to}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.045] px-4 text-sm font-black text-[var(--tg-text-color)]"
              >
                {content}
              </Link>
            );
          })}
        </section>
      ) : null}

      <WorkspaceState state={state} error={error} onRetry={onRetry}>
        {children}
      </WorkspaceState>
    </div>
  );
}
