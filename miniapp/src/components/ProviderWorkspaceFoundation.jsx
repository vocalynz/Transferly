import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Code2,
  CreditCard,
  FileText,
  Gauge,
  Landmark,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
  WalletCards
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  getProviderCapability,
  getProviderHealth,
  getProviderReadiness,
  getProviderStatus,
  getProviderScopedBalance,
  listProviderActivity,
  preflightProviderAction
} from '../lib/api';
import { getPaymentProviderLauncher } from '../lib/paymentProviderLaunchers';
import {
  getProviderLaneDefinition,
  getProviderManifest,
  getProviderWorkspaceRoute,
  getWorkspaceLauncherLaneId,
  isProviderLaneSupported
} from '../lib/providerManifests';
import {
  PROVIDER_CONTRACT_VERSION,
  PROVIDER_OPERATION_KEYS,
  isProviderOperationImplemented
} from '../lib/providerWorkspaceContract';
import AdminPaymentsTab from './AdminTabs/PaymentsTab';
import PayPalProviderWorkspace from './PayPalProviderWorkspace';
import ProviderWorkspaceShell from './ProviderWorkspaceShell';

const laneIcons = {
  overview: Gauge,
  'custom-details': ShieldCheck,
  invoices: FileText,
  payouts: Send,
  wallet: WalletCards,
  activity: Activity,
  payments: CreditCard,
  billing: Receipt,
  connect: Users,
  receive: Receipt,
  send: Send,
  balances: WalletCards,
  compliance: ShieldCheck,
  collections: CreditCard,
  customers: Users,
  'virtual-accounts': Landmark,
  subscriptions: RefreshCw,
  transfers: Send,
  settlements: Landmark,
  refunds: RefreshCw,
  confirmations: CheckCircle2,
  security: ShieldCheck,
  developer: Code2
};

const supportLabels = {
  live: 'Live',
  preview: 'Preview',
  setup: 'Setup',
  unavailable: 'Unavailable',
  planned: 'Planned'
};

const supportDetails = {
  live: 'This lane is connected to an existing Transferly workflow where backend support is available.',
  preview: 'This lane is available as a structured workspace while some backend operations are still being completed.',
  setup: 'This lane is intentionally scaffolded and will stay explicit until the provider backend is connected.',
  unavailable: 'This lane is not enabled in Transferly yet.',
  planned: 'This lane is planned for a later provider rollout.'
};

const embeddedLaneViews = {
  stripe: {
    payments: { mode: 'invoice', providerFilter: 'stripe' },
    connect: { mode: 'payout', providerFilter: 'stripe' }
  },
  crypto: {
    receive: { mode: 'invoice', providerFilter: 'crypto' }
  }
};

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function readProviderSlug(provider) {
  return normalizeKey(provider?.slug || provider?.key || provider?.id || provider?.provider);
}

function readHealthSlug(health) {
  return normalizeKey(health?.provider || health?.key || health?.slug || health?.id);
}

function formatEnvironment(manifest, providerRecord) {
  const value = providerRecord?.environment || providerRecord?.mode || providerRecord?.env;
  if (value) {
    return value;
  }

  return manifest.environmentSupport || [];
}

function readConnectionStatus(manifest, providerRecord, health) {
  return health?.status || providerRecord?.status || manifest.status || '';
}

function readBalanceSummary(balance) {
  if (!balance) {
    return 'No balance snapshot loaded';
  }

  if (typeof balance === 'string') {
    return balance;
  }

  const available = balance.available || balance.available_balance || balance.amount || balance.balance;
  const currency = balance.currency || balance.available_currency || balance.default_currency || '';
  if (available !== undefined && available !== null) {
    return `${available}${currency ? ` ${currency}` : ''}`;
  }

  return 'Balance snapshot available';
}

function readOperation(readiness, operation) {
  return readiness?.operations?.find((item) => item.operation === operation) || null;
}

function formatOperationLabel(operation) {
  return String(operation || '').charAt(0).toUpperCase() + String(operation || '').slice(1);
}

function normalizeApiError(error, fallback = 'Provider API state could not be loaded.') {
  return {
    message: error?.message || error?.payload?.error?.message || error?.payload?.message || fallback,
    code: error?.code || error?.payload?.error?.code || error?.payload?.code || '',
    requestId: error?.requestId || error?.payload?.requestId || '',
    status: error?.status || '',
    retryAfter: error?.retryAfter || error?.payload?.retryAfter || error?.payload?.error?.retryAfter || ''
  };
}

function getLaneSupport(lane, manifest) {
  return lane?.support || manifest.laneSupport?.[lane?.id] || manifest.status || 'planned';
}

function useProviderApiSnapshot(providerSlug) {
  const [snapshot, setSnapshot] = useState({
    loading: false,
    error: '',
    errorCode: '',
    errorRequestId: '',
    errorStatus: '',
    retryAfter: '',
    capability: null,
    readiness: null,
    health: null,
    status: null,
    preflight: [],
    contractVersion: PROVIDER_CONTRACT_VERSION,
    warnings: [],
    balance: null,
    activity: []
  });

  useEffect(() => {
    if (!providerSlug) {
      return undefined;
    }

    let cancelled = false;
    setSnapshot((current) => ({
      ...current,
      loading: true,
      error: '',
      errorCode: '',
      errorRequestId: '',
      errorStatus: '',
      retryAfter: '',
      warnings: []
    }));

    async function loadSnapshot() {
      try {
        const [capabilityResult, readinessResult, healthResult, statusResult] = await Promise.allSettled([
          getProviderCapability(providerSlug),
          getProviderReadiness(providerSlug),
          getProviderHealth(providerSlug),
          getProviderStatus(providerSlug)
        ]);
        const capability = capabilityResult.status === 'fulfilled' ? capabilityResult.value?.data : null;
        const readiness = readinessResult.status === 'fulfilled' ? readinessResult.value?.data : null;
        const health = healthResult.status === 'fulfilled' ? healthResult.value?.data : null;
        const status = statusResult.status === 'fulfilled' ? statusResult.value?.data : null;
        const contractVersion =
          readinessResult.value?.contract_version ||
          capabilityResult.value?.contract_version ||
          healthResult.value?.contract_version ||
          statusResult.value?.contract_version ||
          PROVIDER_CONTRACT_VERSION;
        const baseErrorDetails = [capabilityResult, readinessResult]
          .filter((result) => result.status === 'rejected')
          .map((result) => normalizeApiError(result.reason));
        const primaryError = baseErrorDetails[0] || null;
        const warnings = healthResult.status === 'rejected'
          ? [normalizeApiError(healthResult.reason, 'Provider health could not be loaded.').message]
          : [];
        if (statusResult.status === 'rejected') {
          warnings.push(normalizeApiError(statusResult.reason, 'Provider status could not be loaded.').message);
        }

        const [balanceResult, activityResult] = await Promise.allSettled([
          isProviderOperationImplemented(readOperation(readiness, 'balance')?.status)
            ? getProviderScopedBalance(providerSlug)
            : Promise.resolve(null),
          isProviderOperationImplemented(readOperation(readiness, 'activity')?.status)
            ? listProviderActivity(providerSlug, { limit: 5 })
            : Promise.resolve(null)
        ]);
        if (balanceResult.status === 'rejected') {
          warnings.push(normalizeApiError(balanceResult.reason, 'Provider balance could not be loaded.').message);
        }
        if (activityResult.status === 'rejected') {
          warnings.push(normalizeApiError(activityResult.reason, 'Provider activity could not be loaded.').message);
        }
        const preflightResults = await Promise.allSettled(
          PROVIDER_OPERATION_KEYS.map((operation) => preflightProviderAction(providerSlug, operation))
        );
        const preflight = preflightResults.map((result, index) => {
          const operation = PROVIDER_OPERATION_KEYS[index];

          if (result.status === 'fulfilled') {
            return result.value?.data || {
              operation,
              label: formatOperationLabel(operation),
              allowed: false,
              status: 'unknown',
              reason: 'Action preflight returned no data.',
              code: 'PREFLIGHT_EMPTY',
              supported_providers: [],
              warnings: [],
              next_actions: []
            };
          }

          return {
            operation,
            label: formatOperationLabel(operation),
            allowed: false,
            status: 'unknown',
            reason: result.reason?.message || 'Action preflight could not be loaded.',
            code: result.reason?.code || 'PREFLIGHT_UNAVAILABLE',
            supported_providers: [],
            warnings: [],
            next_actions: []
          };
        });

        if (cancelled) {
          return;
        }

        setSnapshot({
          loading: false,
          error: primaryError?.message || '',
          errorCode: primaryError?.code || '',
          errorRequestId: primaryError?.requestId || '',
          errorStatus: primaryError?.status || '',
          retryAfter: primaryError?.retryAfter || '',
          capability,
          readiness,
          health,
          status,
          preflight,
          contractVersion,
          warnings: warnings.slice(0, 3),
          balance: balanceResult.status === 'fulfilled' ? balanceResult.value?.data : null,
          activity: activityResult.status === 'fulfilled' && Array.isArray(activityResult.value?.data)
            ? activityResult.value.data
            : []
        });
      } catch (error) {
        const normalizedError = normalizeApiError(error, 'Provider API snapshot could not be loaded.');
        if (!cancelled) {
          setSnapshot((current) => ({
            ...current,
            loading: false,
            error: normalizedError.message,
            errorCode: normalizedError.code,
            errorRequestId: normalizedError.requestId,
            errorStatus: normalizedError.status,
            retryAfter: normalizedError.retryAfter
          }));
        }
      }
    }

    loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [providerSlug]);

  return snapshot;
}

function ApiStateNotice({ snapshot }) {
  if (snapshot.loading) {
    return (
      <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-sm font-bold leading-6 text-[var(--tg-subtitle-text-color)]">
        Provider API state is loading.
      </div>
    );
  }

  if (snapshot.error) {
    const details = [
      snapshot.errorStatus ? `Status ${snapshot.errorStatus}` : '',
      snapshot.errorCode || '',
      snapshot.errorRequestId ? `Request ${snapshot.errorRequestId}` : '',
      snapshot.retryAfter ? `Retry after ${snapshot.retryAfter}s` : ''
    ].filter(Boolean);

    return (
      <div className="flex items-start gap-3 rounded-[22px] border border-red-400/30 bg-red-500/10 p-4">
        <AlertTriangle className="mt-0.5 shrink-0 text-red-200" size={18} />
        <div className="min-w-0">
          <p className="text-sm font-bold leading-6 text-[var(--tg-text-color)]">{snapshot.error}</p>
          {details.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {details.map((detail) => (
                <span key={detail} className="rounded-full border border-red-200/20 bg-red-200/10 px-2.5 py-1 text-[11px] font-black text-red-50">
                  {detail}
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-xs font-bold leading-5 text-red-100/85">
            Try again from the bot menu or reopen the workspace.
          </p>
        </div>
      </div>
    );
  }

  if (!snapshot.warnings?.length) {
    return null;
  }

  return (
    <div className="rounded-[22px] border border-amber-300/25 bg-amber-300/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-amber-100" size={18} />
        <div className="grid gap-1">
          {snapshot.warnings.map((warning) => (
            <p key={warning} className="text-sm font-bold leading-6 text-[var(--tg-text-color)]">{warning}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail }) {
  return (
    <article className="rounded-[22px] border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--provider-accent-soft)] text-[var(--tg-text-color)] ring-1 ring-[var(--provider-accent-border)]">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">{label}</p>
          <p className="mt-1 text-lg font-black text-[var(--tg-text-color)]">{value}</p>
          {detail ? <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{detail}</p> : null}
        </div>
      </div>
    </article>
  );
}

function LaneOverview({ manifest }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Workspace lanes</p>
          <h2 className="mt-2 text-xl font-black text-[var(--tg-text-color)]">Provider-first service routes</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
            Each lane keeps Transferly as the operating shell while adapting terminology, actions, and readiness checks to the selected provider.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {manifest.lanes.map((lane) => {
          const Icon = laneIcons[lane.id] || Gauge;

          return (
            <Link
              key={lane.id}
              to={getProviderWorkspaceRoute(manifest.slug, lane.id)}
              className="group rounded-[22px] border border-white/10 bg-white/[0.045] p-4 transition hover:border-[var(--provider-accent-border)] hover:bg-[var(--provider-accent-soft)]"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--provider-accent-soft)] text-[var(--tg-text-color)] ring-1 ring-[var(--provider-accent-border)]">
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-[var(--tg-text-color)]">{lane.label}</p>
                    <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">
                      {supportLabels[getLaneSupport(lane, manifest)] || supportLabels.planned}
                    </span>
                    <ArrowRight className="opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" size={15} />
                  </div>
                  <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{lane.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function LaneDetail({ manifest, lane, launcherLane }) {
  const Icon = laneIcons[lane.id] || Gauge;
  const support = getLaneSupport(lane, manifest);
  const supportLabel = supportLabels[support] || supportLabels.planned;

  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--provider-accent-soft)] text-[var(--tg-text-color)] ring-1 ring-[var(--provider-accent-border)]">
          <Icon size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">{manifest.displayName} lane</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-[var(--tg-text-color)]">{launcherLane?.title || lane.label}</h2>
            <span className="rounded-full border border-[var(--provider-accent-border)] bg-[var(--provider-accent-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--tg-text-color)]">
              {supportLabel}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
            {launcherLane?.subtitle || lane.description}
          </p>
        </div>
      </div>

      {launcherLane?.bullets?.length ? (
        <div className="mt-5 grid gap-2">
          {launcherLane.bullets.map((bullet) => (
            <div key={bullet} className="flex items-start gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
              <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--tg-button-color)]" size={16} />
              <p className="text-sm font-bold leading-5 text-[var(--tg-text-color)]">{bullet}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Implementation status</p>
        <p className="mt-2 text-sm font-bold leading-6 text-[var(--tg-subtitle-text-color)]">
          {supportDetails[support] || supportDetails.planned}
        </p>
      </div>
    </section>
  );
}

function LaneSetupGrid({ manifest, lane }) {
  const providerName = manifest.displayName;
  const support = getLaneSupport(lane, manifest);
  const items = [
    {
      title: 'Route foundation',
      detail: `${providerName} now has a dedicated ${lane.label.toLowerCase()} lane inside the Transferly provider workspace.`,
      ready: true
    },
    {
      title: 'Backend adapter',
      detail: support === 'live'
        ? 'Existing Transferly backend support is connected where available.'
        : 'Provider API calls remain gated until the adapter, secrets, webhooks, and persistence are wired.',
      ready: support === 'live'
    },
    {
      title: 'Operational safety',
      detail: 'Money movement and externally meaningful state changes must remain auditable before this lane becomes fully active.',
      ready: support === 'live'
    }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <article key={item.title} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
          <CheckCircle2
            className={item.ready ? 'text-[var(--tg-button-color)]' : 'text-[var(--tg-hint-color)]'}
            size={18}
          />
          <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">{item.title}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{item.detail}</p>
        </article>
      ))}
    </div>
  );
}

function OperationStatusGrid({ readiness, capability, preflight = [], loading, contractVersion }) {
  const operations = readiness?.operations || [];
  const preflightByOperation = new Map((preflight || []).map((item) => [item.operation, item]));
  const steps = Array.isArray(readiness?.recommended_next_steps)
    ? readiness.recommended_next_steps.slice(0, 2)
    : [];

  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">API contract</p>
          <h2 className="mt-2 text-xl font-black text-[var(--tg-text-color)]">
            {loading ? 'Loading provider API state' : readiness?.ready ? 'Provider operations are connected' : 'Provider setup is explicit'}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
            Bot actions and Mini App lanes use the same provider readiness contract so unavailable operations stay gated. Version {contractVersion || PROVIDER_CONTRACT_VERSION}.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {PROVIDER_OPERATION_KEYS.map((operation) => {
          const item = operations.find((entry) => entry.operation === operation);
          const preflightItem = preflightByOperation.get(operation);
          const label = formatOperationLabel(operation);
          return (
            <div key={operation} className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">{label}</p>
              <p className="mt-1 text-sm font-black text-[var(--tg-text-color)]">
                {item?.status || capability?.operations?.[operation]?.status || 'setup'}
              </p>
              <p className="mt-1 text-[11px] font-bold leading-4 text-[var(--tg-subtitle-text-color)]">
                {preflightItem
                  ? (preflightItem.allowed ? 'Action ready' : preflightItem.reason || 'Action gated')
                  : 'Preflight pending'}
              </p>
            </div>
          );
        })}
      </div>

      {steps.length ? (
        <div className="mt-4 grid gap-2">
          {steps.map((step) => (
            <div key={step.code || step.label} className="rounded-[18px] border border-white/10 bg-white/[0.035] p-3">
              <p className="text-sm font-black text-[var(--tg-text-color)]">{step.label}</p>
              {step.detail ? <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{step.detail}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ProviderActionPreflightPanel({ snapshot }) {
  const actions = Array.isArray(snapshot.preflight) ? snapshot.preflight : [];

  if (!actions.length) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Action preflight</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {actions.map((action, index) => (
          <article
            key={`${action.provider || snapshot.provider || 'provider'}-${action.operation || 'operation'}-${index}`}
            className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-[var(--tg-text-color)]">{action.label || formatOperationLabel(action.operation)}</p>
              <span
                className={
                  action.allowed
                    ? 'rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100'
                    : 'rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100'
                }
              >
                {action.allowed ? 'Ready' : 'Gated'}
              </span>
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
              {action.allowed ? action.status : action.reason || action.status || 'Unavailable'}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProviderApiSnapshotPanel({ snapshot }) {
  const activity = Array.isArray(snapshot.activity) ? snapshot.activity.slice(0, 5) : [];
  const health = snapshot.health || {};

  return (
    <section className="grid gap-3 lg:grid-cols-3">
      <article className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Provider health</p>
        <p className="mt-2 text-lg font-black text-[var(--tg-text-color)]">
          {health.status || 'unknown'} · {health.score ?? 0}/100
        </p>
        <p className="mt-2 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
          {health.failed_webhooks ?? 0} failed webhooks · {health.unresolved_issues ?? 0} open issues
        </p>
      </article>
      <article className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Balance snapshot</p>
        <p className="mt-2 text-lg font-black text-[var(--tg-text-color)]">{readBalanceSummary(snapshot.balance)}</p>
        <p className="mt-2 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
          Balance requests run only when the provider readiness contract marks balance as implemented.
        </p>
      </article>
      <article className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Recent activity</p>
        <div className="mt-3 grid gap-2">
          {activity.length ? activity.map((item) => (
            <div key={`${item.type}-${item.id}`} className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
              <p className="text-sm font-black text-[var(--tg-text-color)]">{item.label || item.id}</p>
              <p className="mt-1 text-xs font-bold text-[var(--tg-subtitle-text-color)]">{item.type} · {item.status}</p>
            </div>
          )) : (
            <p className="text-sm font-bold leading-6 text-[var(--tg-subtitle-text-color)]">No provider activity has been returned for this workspace yet.</p>
          )}
        </div>
      </article>
    </section>
  );
}

// Generic provider workspaces reuse existing aggregate payment views only where
// backend support already exists; setup lanes stay explicit and non-operational.
function EmbeddedProviderLane({ manifest, lane, launcherLane, view }) {
  return (
    <section className="space-y-4">
      <LaneDetail manifest={manifest} lane={lane} launcherLane={launcherLane} />
      <AdminPaymentsTab
        embedded
        mode={view.mode}
        providerFilter={view.providerFilter}
      />
    </section>
  );
}

function ProviderLaneContent({ manifest, lane, launcherLane, snapshot }) {
  const view = embeddedLaneViews[manifest.slug]?.[lane.id];

  if (view) {
    return <EmbeddedProviderLane manifest={manifest} lane={lane} launcherLane={launcherLane} view={view} />;
  }

  return (
    <div className="space-y-4">
      <LaneDetail manifest={manifest} lane={lane} launcherLane={launcherLane} />
      <OperationStatusGrid
        readiness={snapshot.readiness}
        capability={snapshot.capability}
        preflight={snapshot.preflight}
        loading={snapshot.loading}
        contractVersion={snapshot.contractVersion}
      />
      <ProviderActionPreflightPanel snapshot={snapshot} />
      <ApiStateNotice snapshot={snapshot} />
      <LaneSetupGrid manifest={manifest} lane={lane} />
    </div>
  );
}

export default function ProviderWorkspaceFoundation({ slug, lane = 'overview' }) {
  const manifest = getProviderManifest(slug);
  const {
    paymentProviders = [],
    providerHealth = [],
    providerBalances = {}
  } = useAppContext();

  const workspaceData = useMemo(() => {
    if (!manifest) {
      return null;
    }

    const providerRecord = paymentProviders.find((provider) => readProviderSlug(provider) === manifest.slug) || null;
    const health = providerHealth.find((item) => readHealthSlug(item) === manifest.slug) || null;
    const balance = providerBalances[manifest.slug] || null;

    return {
      providerRecord,
      health,
      balance,
      environment: formatEnvironment(manifest, providerRecord),
      connectionStatus: readConnectionStatus(manifest, providerRecord, health)
    };
  }, [manifest, paymentProviders, providerBalances, providerHealth]);
  const apiSnapshot = useProviderApiSnapshot(manifest?.slug && manifest.slug !== 'paypal' ? manifest.slug : '');

  if (!manifest) {
    return (
      <ProviderWorkspaceShell
        state="error"
        error="Transferly does not have a provider manifest for this service yet."
      />
    );
  }

  if (manifest.slug === 'paypal') {
    return <PayPalProviderWorkspace lane={lane} />;
  }

  const requestedLane = lane || 'overview';
  const activeLane = isProviderLaneSupported(manifest.slug, requestedLane) ? requestedLane : 'overview';
  const laneDefinition = getProviderLaneDefinition(activeLane);
  const manifestLane = manifest.lanes.find((item) => item.id === activeLane) || laneDefinition;
  const launcher = getPaymentProviderLauncher(manifest.slug);
  const launcherLaneId = getWorkspaceLauncherLaneId(manifest, activeLane);
  const launcherLane = launcher?.lanes?.find((item) => item.id === launcherLaneId) || null;
  const unsupportedLane = requestedLane !== activeLane;
  const composedStatus = apiSnapshot.status || null;
  const liveOperationCount = apiSnapshot.preflight?.length
    ? apiSnapshot.preflight.filter((item) => item.allowed).length
    : (apiSnapshot.readiness?.summary?.live_operations ?? 0);

  const quickActions = [
    { label: 'Command center', to: `/miniapp/ops?provider=${manifest.slug}` },
    ...manifest.lanes
      .filter((item) => item.id !== 'overview')
      .slice(0, 3)
      .map((item) => ({
        label: item.shortLabel || item.label,
        to: getProviderWorkspaceRoute(manifest.slug, item.id)
      }))
  ];

  return (
    <ProviderWorkspaceShell
      manifest={manifest}
      activeLane={activeLane}
      lanes={manifest.lanes}
      environment={workspaceData?.environment}
      connectionStatus={workspaceData?.connectionStatus}
      capabilities={manifest.capabilities}
      quickActions={quickActions}
      state={unsupportedLane ? 'error' : 'ready'}
      error={`${manifest.displayName} does not support the ${requestedLane} lane in Transferly yet.`}
    >
      <div className="space-y-4">
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={Gauge}
            label="Readiness"
            value={composedStatus?.status || (apiSnapshot.readiness?.ready ? 'ready' : apiSnapshot.readiness?.status || workspaceData?.connectionStatus || manifest.status || 'planned')}
            detail={composedStatus ? 'Loaded from the composed provider API status contract.' : manifest.launcherStatusLabel || 'Configured from the Transferly provider manifest.'}
          />
          <SummaryCard
            icon={Activity}
            label="Operations"
            value={`${liveOperationCount} ready`}
            detail={apiSnapshot.loading ? 'Loading provider operation state.' : 'Invoices, payouts, balance, and activity stay gated by preflight.'}
          />
          <SummaryCard
            icon={WalletCards}
            label="Balance"
            value={readBalanceSummary(apiSnapshot.balance || workspaceData?.balance)}
            detail="Balance is requested only when the provider API supports it."
          />
        </section>

        {activeLane === 'overview' ? (
          <>
            <OperationStatusGrid
              readiness={apiSnapshot.readiness}
              capability={apiSnapshot.capability}
              preflight={apiSnapshot.preflight}
              loading={apiSnapshot.loading}
              contractVersion={apiSnapshot.contractVersion}
            />
            <ProviderActionPreflightPanel snapshot={apiSnapshot} />
            <ApiStateNotice snapshot={apiSnapshot} />
            <LaneOverview manifest={manifest} />
            <ProviderApiSnapshotPanel snapshot={apiSnapshot} />
          </>
        ) : (
          <ProviderLaneContent
            manifest={manifest}
            lane={manifestLane}
            launcherLane={launcherLane}
            snapshot={apiSnapshot}
          />
        )}
      </div>
    </ProviderWorkspaceShell>
  );
}
