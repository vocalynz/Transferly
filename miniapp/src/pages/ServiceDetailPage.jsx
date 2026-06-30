import React, { useEffect, useState } from 'react';
import {
  Activity,
  Archive,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Bot,
  Clock3,
  Database,
  ExternalLink,
  FileText,
  Layers3,
  Link2,
  QrCode,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wallet
} from 'lucide-react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminPaymentsTab from '../components/AdminTabs/PaymentsTab';
import DashboardLayout from '../components/DashboardLayout';
import { useAppContext } from '../context/AppContext';
import ServiceLogo from '../components/ServiceLogo';
import {
  getRelatedServices,
  getServiceBySlug,
  getServiceEstimatedCost,
  getServicePreview,
  getRecommendedPointPacks
} from '../lib/servicesCatalog';
import {
  getPaymentProviderLauncher,
  normalizePaymentProviderView
} from '../lib/paymentProviderLaunchers';
import {
  getServiceCommandCenter,
  normalizeServiceCommandCenterView
} from '../lib/serviceCommandCenters';
import {
  createStripeConnectedAccount,
  createStripeConnectedAccountOnboardingLink,
  createServiceLaneActionIntent,
  getPaymentProviderBalance,
  getServiceCommandCenterSummary,
  getServiceLaneDetail,
  listStripeConnectedAccounts,
  listPaymentProviderInvoiceFeatures,
  listPaymentProviders,
  refreshStripeConnectedAccount
} from '../lib/api';

const laneIconMap = {
  'custom-details': Sparkles,
  invoices: FileText,
  payouts: Send,
  'wallet-balance': Wallet,
  'provider-activity': Activity
};

const serviceLaneIconMap = {
  'activity-audit': Activity,
  'activity-lessons': BookOpen,
  'activity-review': Activity,
  'activity-trail': Activity,
  'balance-overview': Wallet,
  'balance-readiness': Wallet,
  'custom-notification': Bell,
  'deposit-notification': Send,
  'draft-reply': Bot,
  'duplicate-receipt': Archive,
  'escalation-states': SlidersHorizontal,
  'invoice-handoff': FileText,
  'link-support': Link2,
  'operator-training': BookOpen,
  'payment-links': Link2,
  'payout-activity': Send,
  'payout-operations': Send,
  'provider-links': Link2,
  'provider-onboarding': Layers3,
  'provider-ops': Layers3,
  'provider-readiness': ShieldCheck,
  'provider-runbooks': BookOpen,
  'qr-activity': QrCode,
  'qr-studio': QrCode,
  'receipt-context': Archive,
  'receipt-vault': Archive,
  'sandbox-payload': Database,
  'saved-replies': BookOpen,
  'security-center': ShieldCheck,
  'security-context': ShieldCheck,
  'security-notes': ShieldCheck,
  'studio-link': Link2,
  'studio-preview': Sparkles,
  'support-context': Bot,
  'support-desk': Bot,
  'support-handoff': Bot,
  'support-playbooks': BookOpen,
  'support-safety': ShieldCheck,
  'support-triage': Bot,
  'template-library': BookOpen,
  'template-marketplace': BookOpen,
  'vault-reference': Archive,
  'vault-review': Archive,
  'vault-search': Archive,
  'wallet-activity': Activity,
  'wallet-record': Wallet
};

function getLaneStatusCopy(lane) {
  if (lane.status === 'live') {
    return {
      label: 'Live',
      classes: 'border-emerald-200 bg-emerald-50 text-emerald-700'
    };
  }

  return {
    label: 'Setup',
    classes: 'border-amber-200 bg-amber-50 text-amber-700'
  };
}

function getReadinessTone(status) {
  if (status === 'configured') {
    return {
      label: 'Configured',
      classes: 'border-emerald-200 bg-emerald-50 text-emerald-700'
    };
  }

  if (status === 'not_configured') {
    return {
      label: 'Not configured',
      classes: 'border-amber-200 bg-amber-50 text-amber-700'
    };
  }

  return {
    label: 'Static setup',
    classes: 'border-slate-200 bg-slate-50 text-slate-600'
  };
}

function ProviderReadinessPanel({ providerLauncher, providerStatus, invoiceFeatures, loading, error }) {
  const readiness = getReadinessTone(providerStatus?.status);
  const missingEnv = providerStatus?.missing_env || [];
  const requiredEnv = providerStatus?.required_env || [];
  const invoiceFeature = invoiceFeatures?.invoice_features;

  return (
    <div className="rounded-[28px] border border-white/70 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Provider Readiness</p>
          <h3 className="mt-3 text-xl font-black tracking-[-0.04em] text-slate-950">{providerLauncher.title}</h3>
        </div>
        <div className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${readiness.classes}`}>
          {loading ? 'Loading' : readiness.label}
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Required Env</p>
          <p className="mt-2 text-lg font-black text-slate-950">{requiredEnv.length || 'None'}</p>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Missing Env</p>
          <p className="mt-2 text-lg font-black text-slate-950">{missingEnv.length}</p>
        </div>
      </div>

      {missingEnv.length ? (
        <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-black text-slate-950">Set these environment variables before enabling provider operations:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingEnv.map((name) => (
              <span key={name} className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-black text-amber-800">
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {invoiceFeature ? (
        <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Invoice Feature</p>
          <p className="mt-2 text-sm font-black text-slate-950">
            {invoiceFeature.supported ? invoiceFeature.collection_method : 'Not invoice-capable'}
          </p>
          <p className="mt-2 text-xs leading-6 text-slate-600">
            {invoiceFeature.supported
              ? `Provider resource: ${invoiceFeature.provider_resource}. Hosted link field: ${invoiceFeature.provider_link_field || 'none'}.`
              : invoiceFeature.reason}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function formatProviderMoney(entry) {
  return `${entry.currency || '---'} ${entry.amount || '0.00'}`;
}

function ProviderBalancePanel({ balance, loading, error }) {
  if (loading) {
    return (
      <div className="rounded-[28px] border border-white/70 bg-white p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Wallet Balance</p>
        <p className="mt-3 text-sm font-bold text-slate-600">Loading provider balance...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-500">Wallet Balance</p>
        <p className="mt-3 text-sm font-bold text-rose-700">{error}</p>
      </div>
    );
  }

  if (!balance) {
    return null;
  }

  const available = Array.isArray(balance.available) ? balance.available : [];
  const pending = Array.isArray(balance.pending) ? balance.pending : [];

  return (
    <div className="rounded-[28px] border border-white/70 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Wallet Balance</p>
          <h3 className="mt-3 text-xl font-black tracking-[-0.04em] text-slate-950">Stripe {balance.mode === 'connected_account' ? 'connected account' : 'platform'} balance</h3>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            {balance.livemode ? 'Live mode' : 'Sandbox mode'}{balance.connected_account_id ? ` · ${balance.connected_account_id}` : ''}
          </p>
        </div>
        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
          Live
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Available</p>
          <div className="mt-3 space-y-2">
            {available.length ? available.map((entry) => (
              <div key={`available-${entry.currency}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-black text-slate-950">{entry.currency}</span>
                <span className="font-bold text-slate-700">{formatProviderMoney(entry)}</span>
              </div>
            )) : <p className="text-sm font-bold text-slate-500">No available balances returned.</p>}
          </div>
        </div>
        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Pending</p>
          <div className="mt-3 space-y-2">
            {pending.length ? pending.map((entry) => (
              <div key={`pending-${entry.currency}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-black text-slate-950">{entry.currency}</span>
                <span className="font-bold text-slate-700">{formatProviderMoney(entry)}</span>
              </div>
            )) : <p className="text-sm font-bold text-slate-500">No pending balances returned.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function getStripeAccountTone(status) {
  if (status === 'ready') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'restricted') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  if (status === 'pending_review') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function StripeConnectedAccountsPanel({ accent }) {
  const [accountsState, setAccountsState] = useState({
    accounts: [],
    loading: true,
    error: '',
    notice: ''
  });
  const [form, setForm] = useState({
    userId: '',
    stripeAccountId: '',
    email: '',
    country: 'US',
    businessType: 'individual'
  });
  const [busyAction, setBusyAction] = useState('');

  const loadAccounts = (notice = '') => {
    setAccountsState((previous) => ({ ...previous, loading: true, error: '' }));
    listStripeConnectedAccounts()
      .then((payload) => {
        setAccountsState({
        accounts: Array.isArray(payload?.data) ? payload.data : [],
        loading: false,
        error: '',
        notice
      });
      })
      .catch((error) => {
        setAccountsState({
          accounts: [],
          loading: false,
          error: error?.message || 'Stripe connected accounts could not be loaded.',
          notice: ''
        });
      });
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const updateForm = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusyAction('create');
    setAccountsState((previous) => ({ ...previous, error: '', notice: '' }));

    try {
      await createStripeConnectedAccount({
        userId: form.userId.trim() || undefined,
        stripeAccountId: form.stripeAccountId.trim() || undefined,
        email: form.email.trim() || undefined,
        country: form.country.trim().toUpperCase() || 'US',
        businessType: form.businessType || undefined
      });
      setForm({
        userId: '',
        stripeAccountId: '',
        email: '',
        country: 'US',
        businessType: 'individual'
      });
      loadAccounts('Stripe connected account saved.');
    } catch (error) {
      setAccountsState((previous) => ({
        ...previous,
        error: error?.message || 'Stripe connected account could not be saved.'
      }));
    } finally {
      setBusyAction('');
    }
  };

  const handleRefresh = async (accountId) => {
    setBusyAction(`refresh:${accountId}`);
    setAccountsState((previous) => ({ ...previous, error: '', notice: '' }));

    try {
      await refreshStripeConnectedAccount(accountId);
      loadAccounts('Connected account refreshed.');
    } catch (error) {
      setAccountsState((previous) => ({
        ...previous,
        error: error?.message || 'Connected account could not be refreshed.'
      }));
    } finally {
      setBusyAction('');
    }
  };

  const handleOnboarding = async (accountId) => {
    setBusyAction(`onboarding:${accountId}`);
    setAccountsState((previous) => ({ ...previous, error: '', notice: '' }));

    try {
      const payload = await createStripeConnectedAccountOnboardingLink(accountId);
      const url = payload?.onboarding_link?.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      loadAccounts('Stripe onboarding link opened.');
    } catch (error) {
      setAccountsState((previous) => ({
        ...previous,
        error: error?.message || 'Onboarding link could not be created.'
      }));
    } finally {
      setBusyAction('');
    }
  };

  const handleCopyAccountId = async (accountId) => {
    try {
      await navigator.clipboard.writeText(accountId);
      setAccountsState((previous) => ({ ...previous, notice: 'Stripe account id copied for payout receiver.' }));
    } catch (_error) {
      setAccountsState((previous) => ({ ...previous, notice: accountId }));
    }
  };

  return (
    <div className="rounded-[28px] border border-white/70 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Connected Accounts</p>
          <h3 className="mt-3 text-xl font-black tracking-[-0.04em] text-slate-950">Stripe onboarding</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Create or register a connected account, open Stripe-hosted onboarding, then refresh readiness before payout approval.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAccounts}
          disabled={accountsState.loading}
          className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-60"
          style={{ borderColor: accent.edge, color: accent.bg }}
        >
          <Activity size={14} />
          Refresh
        </button>
      </div>

      {accountsState.error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{accountsState.error}</p>
      ) : null}
      {accountsState.notice ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{accountsState.notice}</p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">User ID</label>
            <input
              value={form.userId}
              onChange={(event) => updateForm('userId', event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-slate-400"
              placeholder="demo-user"
            />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Existing Account ID</label>
            <input
              value={form.stripeAccountId}
              onChange={(event) => updateForm('stripeAccountId', event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-slate-400"
              placeholder="acct_..."
            />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Email</label>
            <input
              value={form.email}
              onChange={(event) => updateForm('email', event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-slate-400"
              placeholder="recipient@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Country</label>
              <input
                value={form.country}
                onChange={(event) => updateForm('country', event.target.value)}
                maxLength={2}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold uppercase text-slate-900 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Type</label>
              <select
                value={form.businessType}
                onChange={(event) => updateForm('businessType', event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-slate-400"
              >
                <option value="individual">Individual</option>
                <option value="company">Company</option>
                <option value="non_profit">Non-profit</option>
                <option value="government_entity">Government</option>
              </select>
            </div>
          </div>
        </div>
        <button
          type="submit"
          disabled={busyAction === 'create'}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition disabled:opacity-60"
          style={{ backgroundColor: accent.bg }}
        >
          <Sparkles size={14} />
          {form.stripeAccountId.trim() ? 'Register Account' : 'Create Account'}
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {accountsState.loading ? (
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-600">
            Loading connected accounts...
          </div>
        ) : null}
        {!accountsState.loading && !accountsState.accounts.length ? (
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-600">
            No Stripe connected accounts are tracked yet.
          </div>
        ) : null}
        {accountsState.accounts.map((account) => {
          const currentlyDue = Array.isArray(account.requirements?.currently_due)
            ? account.requirements.currently_due
            : [];
          const pastDue = Array.isArray(account.requirements?.past_due)
            ? account.requirements.past_due
            : [];
          return (
            <div key={account.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-all text-sm font-black text-slate-950">{account.stripe_account_id}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${getStripeAccountTone(account.status)}`}>
                      {account.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    {account.email || 'No email'} · {account.country_code || '--'} · {account.business_type || 'unknown'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyAccountId(account.stripe_account_id)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:border-slate-400"
                  >
                    Copy ID
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRefresh(account.id)}
                    disabled={busyAction === `refresh:${account.id}`}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOnboarding(account.id)}
                    disabled={busyAction === `onboarding:${account.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black text-white transition disabled:opacity-60"
                    style={{ backgroundColor: accent.bg }}
                  >
                    <ExternalLink size={13} />
                    Onboard
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Charges</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{account.charges_enabled ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Payouts</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{account.payouts_enabled ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Details</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{account.details_submitted ? 'Submitted' : 'Needed'}</p>
                </div>
              </div>

              {account.disabled_reason || currentlyDue.length || pastDue.length ? (
                <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">Requirements</p>
                  {account.disabled_reason ? (
                    <p className="mt-2 text-sm font-bold text-amber-900">{account.disabled_reason}</p>
                  ) : null}
                  <p className="mt-2 text-xs leading-6 text-amber-900">
                    {[...pastDue, ...currentlyDue].length ? [...pastDue, ...currentlyDue].join(', ') : 'No current requirements.'}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function shouldDisableLaneForReadiness(lane, providerStatus, isAdmin) {
  if (!lane || !providerStatus || !isAdmin) {
    return false;
  }

  return false;
}

function getLiveMetricToneClasses(tone) {
  if (tone === 'live') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function mergeServiceCommandCenterSummary(commandCenter, summary) {
  const liveCommandCenter = summary?.command_center;
  if (!commandCenter || !liveCommandCenter) {
    return commandCenter;
  }

  const liveLaneById = new Map(
    (liveCommandCenter.lanes || []).map((lane) => [lane.id, lane])
  );

  return {
    ...commandCenter,
    liveMetrics: liveCommandCenter.live_metrics || [],
    lanes: commandCenter.lanes.map((lane) => {
      const liveLane = liveLaneById.get(lane.id);
      return {
        ...lane,
        status: liveLane?.status || lane.status,
        liveMetrics: liveLane?.live_metrics || []
      };
    })
  };
}

function LiveMetricGrid({ metrics }) {
  if (!metrics?.length) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.id} className={`rounded-[18px] border px-4 py-3 ${getLiveMetricToneClasses(metric.tone)}`}>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">{metric.label}</p>
          <p className="mt-2 text-lg font-black tracking-[-0.03em]">{metric.value}</p>
          {metric.description ? (
            <p className="mt-2 text-xs font-bold leading-5 opacity-80">{metric.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function getLaneReadinessClasses(status) {
  if (status === 'ready') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function ServiceLaneActionKit({ laneDetail, loading, error, accent }) {
  const navigate = useNavigate();
  const [actionState, setActionState] = useState({ loading: false, error: '' });

  if (!loading && !error && !laneDetail) {
    return null;
  }

  const readiness = Array.isArray(laneDetail?.readiness) ? laneDetail.readiness : [];
  const prefill = laneDetail?.prefill;
  const recentReceipts = Array.isArray(laneDetail?.activity?.recent_receipts)
    ? laneDetail.activity.recent_receipts
    : [];
  const supportContext = laneDetail?.support_context;

  const handleLaunchAction = async () => {
    if (!laneDetail?.service?.slug || !laneDetail?.lane?.id || !laneDetail?.action?.route) {
      return;
    }

    setActionState({ loading: true, error: '' });

    try {
      const result = await createServiceLaneActionIntent(laneDetail.service.slug, laneDetail.lane.id, {
        source: 'miniapp',
        intent: laneDetail.action.kind || 'launch',
        metadata: { route: laneDetail.action.route }
      });
      navigate(result?.action_intent?.action?.route || laneDetail.action.route);
    } catch (launchError) {
      setActionState({
        loading: false,
        error: launchError?.message || 'Action could not be recorded.'
      });
    }
  };

  return (
    <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Action Kit</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-slate-950">
            {laneDetail?.lane?.title || 'Lane workspace'}
          </h3>
        </div>
        {loading ? (
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
            Loading
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {error}
        </p>
      ) : null}

      {laneDetail ? (
        <>
          {laneDetail.action ? (
            <div className="mt-4 flex flex-col gap-3 rounded-[20px] border border-white bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Primary Action</p>
                <p className="mt-2 text-sm font-black text-slate-950">{laneDetail.action.label}</p>
              </div>
              {laneDetail.action.route ? (
                <button
                  type="button"
                  onClick={handleLaunchAction}
                  disabled={actionState.loading}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
                  style={{ backgroundColor: accent.bg, color: accent.fg }}
                >
                  {actionState.loading ? 'Recording' : 'Launch'}
                  <ArrowRight size={15} />
                </button>
              ) : null}
            </div>
          ) : null}

          {actionState.error ? (
            <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {actionState.error}
            </p>
          ) : null}

          {readiness.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {readiness.map((check) => (
                <div key={check.id} className={`rounded-[18px] border px-4 py-3 ${getLaneReadinessClasses(check.status)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black">{check.label}</p>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] opacity-80">
                      {check.status === 'ready' ? 'Ready' : 'Attention'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold leading-5 opacity-80">{check.description}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[20px] border border-white bg-white px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Launch Prefill</p>
              {prefill ? (
                <>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Type</p>
                      <p className="mt-1 text-sm font-black text-slate-950">{prefill.receipt_type}</p>
                    </div>
                    <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Service</p>
                      <p className="mt-1 text-sm font-black text-slate-950">{prefill.service_title}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(prefill.suggested_fields || []).map((field) => (
                      <span key={field} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
                        {field}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm font-bold leading-6 text-slate-600">This lane opens a workspace section without generator prefill.</p>
              )}
            </div>

            <div className="rounded-[20px] border border-white bg-white px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Support Context</p>
              <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                {supportContext?.suggested_handoff || 'No support handoff is available yet.'}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Points</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{supportContext?.points_available || 0}</p>
                </div>
                <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Wallet</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{supportContext?.wallet?.available_balance || 'Not linked'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[20px] border border-white bg-white px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Recent Receipts</p>
            {recentReceipts.length ? (
              <div className="mt-3 grid gap-2">
                {recentReceipts.slice(0, 3).map((receipt) => (
                  <div key={receipt.id} className="flex flex-col gap-1 rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-950">{receipt.title}</p>
                      <p className="text-xs font-bold text-slate-500">{receipt.summary?.text || receipt.type}</p>
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{receipt.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm font-bold text-slate-600">No matching receipts yet.</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ServiceCommandCenterPage({
  service,
  commandCenter,
  activeLane,
  points,
  estimatedCost,
  recommendedPacks,
  needsTopUp,
  relatedServices,
  commandCenterSummaryLoading,
  commandCenterSummaryError,
  laneDetailState
}) {
  const accent = service.accent;
  const shellStyle = {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #ffffff 100%)',
    borderColor: accent.edge
  };

  if (activeLane) {
    const LaneIcon = serviceLaneIconMap[activeLane.id] || Layers3;
    const laneStatus = getLaneStatusCopy(activeLane);

    return (
      <DashboardLayout>
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          <div className="rounded-[32px] border bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-8" style={shellStyle}>
            <Link
              to={`/services/${service.slug}`}
              className="inline-flex items-center gap-2 text-sm font-black transition hover:opacity-75"
              style={{ color: accent.bg }}
            >
              <ArrowLeft size={16} />
              Back to {service.title} Launcher
            </Link>

            <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-4">
                  <ServiceLogo service={service} size="lg" />
                  <div
                    className="inline-flex rounded-full border bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em]"
                    style={{ borderColor: accent.edge, color: accent.bg }}
                  >
                    {commandCenter.title} Lane
                  </div>
                </div>
                <h1 className="mt-5 text-3xl font-black tracking-[-0.05em] text-slate-950 md:text-5xl">{activeLane.title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">{activeLane.subtitle}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[320px] lg:grid-cols-1">
                <div className="rounded-[22px] border border-white/70 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Service</p>
                  <p className="mt-3 text-lg font-black tracking-[-0.03em] text-slate-950">{service.title}</p>
                </div>
                <div className={`rounded-[22px] border px-4 py-4 text-sm font-black ${laneStatus.classes}`}>
                  {laneStatus.label}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <section className="rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] md:p-6">
                <div className="flex items-center gap-3">
                  <div
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white"
                    style={{ backgroundColor: accent.bg, color: accent.fg }}
                  >
                    <LaneIcon size={20} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Workspace Lane</p>
                    <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">{activeLane.title}</h2>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {activeLane.bullets.map((bullet) => (
                    <div key={bullet} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold leading-6 text-slate-700">
                      {bullet}
                    </div>
                  ))}
                </div>

                {activeLane.liveMetrics?.length ? (
                  <div className="mt-5">
                    <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Live Signals</p>
                    <LiveMetricGrid metrics={activeLane.liveMetrics} />
                  </div>
                ) : null}

                <ServiceLaneActionKit
                  laneDetail={laneDetailState.data}
                  loading={laneDetailState.loading}
                  error={laneDetailState.error}
                  accent={accent}
                />

                {activeLane.to &&
                activeLane.status === 'live' &&
                (laneDetailState.error || (!laneDetailState.loading && !laneDetailState.data)) ? (
                  <Link
                    to={activeLane.to}
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: accent.bg, color: accent.fg }}
                  >
                    {activeLane.ctaLabel}
                    <ArrowRight size={16} />
                  </Link>
                ) : activeLane.status !== 'live' ? (
                  <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="text-sm font-black text-slate-950">This lane is registered, but live operations are not enabled yet.</p>
                    <p className="mt-2 text-xs leading-6 text-slate-600">
                      Keep the workspace visible while the service flow, backend adapter, or release gate is completed.
                    </p>
                  </div>
                ) : null}
              </section>

              <aside className="space-y-4">
                <div className="rounded-[28px] border border-white/70 bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Service Group</p>
                  <h3 className="mt-3 text-xl font-black tracking-[-0.04em] text-slate-950">{service.category}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{commandCenter.description}</p>
                </div>
                <div className="rounded-[28px] border border-white/70 bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Other Lanes</p>
                  <div className="mt-4 space-y-2">
                    {commandCenter.lanes
                      .filter((lane) => lane.id !== activeLane.id)
                      .map((lane) => (
                        <Link
                          key={lane.id}
                          to={`/services/${service.slug}?view=${lane.id}`}
                          className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 transition hover:border-slate-300"
                        >
                          {lane.title}
                          <ArrowRight size={15} />
                        </Link>
                      ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="rounded-[32px] border bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-8" style={shellStyle}>
          <Link to="/services" className="inline-flex items-center gap-2 text-sm font-black text-slate-600 transition hover:text-slate-950">
            <ArrowLeft size={16} />
            Back to Services
          </Link>

          <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-4">
                <ServiceLogo service={service} size="lg" />
                <div
                  className="inline-flex rounded-full border bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em]"
                  style={{ borderColor: accent.edge, color: accent.bg }}
                >
                  {commandCenter.eyebrow}
                </div>
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-[-0.05em] text-slate-950 md:text-5xl">
                {commandCenter.title}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">{commandCenter.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[320px] lg:grid-cols-1">
              <div className="rounded-[22px] border border-white/70 bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Current balance</p>
                <p className="mt-3 text-2xl font-black tracking-[-0.05em] text-slate-950">{points.toLocaleString()} pts</p>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Service status</p>
                <p className="mt-3 text-lg font-black tracking-[-0.03em] text-slate-950">{commandCenter.statusLabel}</p>
              </div>
            </div>
          </div>

          {commandCenterSummaryLoading || commandCenterSummaryError || commandCenter.liveMetrics?.length ? (
            <div className="mt-8 rounded-[28px] border border-white/70 bg-white p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Live Summary</p>
                  <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-slate-950">Workspace signals</h2>
                </div>
                {commandCenterSummaryLoading ? (
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Loading
                  </div>
                ) : null}
              </div>
              {commandCenterSummaryError ? (
                <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                  {commandCenterSummaryError}
                </p>
              ) : null}
              <div className="mt-4">
                <LiveMetricGrid metrics={commandCenter.liveMetrics || []} />
              </div>
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {commandCenter.lanes.map((lane) => {
              const LaneIcon = serviceLaneIconMap[lane.id] || Layers3;
              const laneStatus = getLaneStatusCopy(lane);
              const primaryMetric = lane.liveMetrics?.[0];

              return (
                <Link
                  key={lane.id}
                  to={`/services/${service.slug}?view=${lane.id}`}
                  className="rounded-[26px] border border-white/70 bg-white px-5 py-5 text-left shadow-[0_14px_34px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white"
                      style={{ backgroundColor: accent.bg, color: accent.fg }}
                    >
                      <LaneIcon size={19} />
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${laneStatus.classes}`}>
                      {laneStatus.label}
                    </div>
                  </div>
                  <h2 className="mt-5 text-xl font-black tracking-[-0.04em] text-slate-950">{lane.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{lane.subtitle}</p>
                  {primaryMetric ? (
                    <div className={`mt-4 rounded-[16px] border px-3 py-2 ${getLiveMetricToneClasses(primaryMetric.tone)}`}>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">{primaryMetric.label}</p>
                      <p className="mt-1 text-sm font-black">{primaryMetric.value}</p>
                    </div>
                  ) : null}
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-black" style={{ color: accent.bg }}>
                    Open lane
                    <ArrowRight size={16} />
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-[28px] border border-white/70 bg-white p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Capabilities</p>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {commandCenter.capabilities.map((capability) => (
                  <div key={capability} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                    {capability}
                  </div>
                ))}
              </div>
            </section>

            <aside className="space-y-4">
              {estimatedCost !== null ? (
                <div className={`rounded-[28px] border px-5 py-5 ${needsTopUp ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                  <div className="flex items-start gap-3">
                    <Wallet size={18} className={needsTopUp ? 'mt-0.5 text-amber-700' : 'mt-0.5 text-emerald-700'} />
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {needsTopUp
                          ? `Your balance is below the ${estimatedCost.toLocaleString()} point recommendation.`
                          : `Your balance is ready for ${service.title}.`}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-slate-600">
                        Recommended packs: {recommendedPacks.map((pack) => `${pack.toLocaleString()} pts`).join(' · ')}
                      </p>
                    </div>
                  </div>
                  {needsTopUp ? (
                    <Link
                      to={`/buy-point?intent=${service.slug}`}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-black text-white transition hover:opacity-90"
                      style={{ backgroundColor: accent.bg, color: accent.fg }}
                    >
                      Buy Points
                      <ArrowRight size={15} />
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {relatedServices.length ? (
                <div className="rounded-[28px] border border-white/70 bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Related Services</p>
                  <div className="mt-4 space-y-2">
                    {relatedServices.map((related) => (
                      <Link
                        key={related.slug}
                        to={`/services/${related.slug}`}
                        className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 transition hover:border-slate-300"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <ServiceLogo service={related} size="sm" />
                          <span className="truncate">{related.title}</span>
                        </span>
                        <ArrowRight size={15} />
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ServiceDetailPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { config, profile, user } = useAppContext();
  const service = getServiceBySlug(slug || '');
  const serviceCommandCenter = service ? getServiceCommandCenter(service) : null;
  const hasServiceCommandCenter = Boolean(serviceCommandCenter);
  const points = Number(profile?.points || 0);
  const providerLauncher = getPaymentProviderLauncher(slug || '');
  const officialView = searchParams.get('view');
  const providerView = normalizePaymentProviderView(officialView);
  const activeProviderLane = providerLauncher?.lanes.find((lane) => lane.id === providerView);
  const serviceCommandView = normalizeServiceCommandCenterView(officialView, serviceCommandCenter);
  const [providerRegistryState, setProviderRegistryState] = useState({
    providers: [],
    invoiceFeatures: [],
    loading: false,
    error: ''
  });
  const [providerBalanceState, setProviderBalanceState] = useState({
    balance: null,
    loading: false,
    error: ''
  });
  const [serviceCommandSummaryState, setServiceCommandSummaryState] = useState({
    data: null,
    loading: false,
    error: ''
  });
  const [serviceLaneDetailState, setServiceLaneDetailState] = useState({
    data: null,
    loading: false,
    error: ''
  });

  useEffect(() => {
    if (!providerLauncher || !user?.isAdmin) {
      setProviderRegistryState((previous) => ({
        ...previous,
        providers: [],
        invoiceFeatures: [],
        loading: false,
        error: ''
      }));
      return undefined;
    }

    let cancelled = false;
    setProviderRegistryState((previous) => ({ ...previous, loading: true, error: '' }));

    Promise.all([
      listPaymentProviders(),
      listPaymentProviderInvoiceFeatures()
    ])
      .then(([providerPayload, invoiceFeaturePayload]) => {
        if (cancelled) {
          return;
        }

        setProviderRegistryState({
          providers: Array.isArray(providerPayload?.data) ? providerPayload.data : [],
          invoiceFeatures: Array.isArray(invoiceFeaturePayload?.data) ? invoiceFeaturePayload.data : [],
          loading: false,
          error: ''
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setProviderRegistryState({
          providers: [],
          invoiceFeatures: [],
          loading: false,
          error: error?.message || 'Provider readiness could not be loaded.'
        });
      });

    return () => {
      cancelled = true;
    };
  }, [providerLauncher, user?.isAdmin]);

  useEffect(() => {
    if (!providerLauncher || !user?.isAdmin || activeProviderLane?.id !== 'wallet-balance' || activeProviderLane.status !== 'live') {
      setProviderBalanceState({ balance: null, loading: false, error: '' });
      return undefined;
    }

    let cancelled = false;
    setProviderBalanceState({ balance: null, loading: true, error: '' });

    getPaymentProviderBalance(providerLauncher.key)
      .then((payload) => {
        if (cancelled) return;
        setProviderBalanceState({ balance: payload?.balance || null, loading: false, error: '' });
      })
      .catch((error) => {
        if (cancelled) return;
        setProviderBalanceState({
          balance: null,
          loading: false,
          error: error?.message || 'Provider balance could not be loaded.'
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeProviderLane?.id, activeProviderLane?.status, providerLauncher, user?.isAdmin]);

  useEffect(() => {
    if (!service?.slug || !hasServiceCommandCenter) {
      setServiceCommandSummaryState({ data: null, loading: false, error: '' });
      return undefined;
    }

    let cancelled = false;
    setServiceCommandSummaryState((previous) => ({ ...previous, loading: true, error: '' }));

    getServiceCommandCenterSummary(service.slug)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setServiceCommandSummaryState({
          data: payload || null,
          loading: false,
          error: ''
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setServiceCommandSummaryState({
          data: null,
          loading: false,
          error: error?.message || 'Live service summary could not be loaded.'
        });
      });

    return () => {
      cancelled = true;
    };
  }, [service?.slug, hasServiceCommandCenter]);

  useEffect(() => {
    if (!service?.slug || !hasServiceCommandCenter || !serviceCommandView) {
      setServiceLaneDetailState({ data: null, loading: false, error: '' });
      return undefined;
    }

    let cancelled = false;
    setServiceLaneDetailState({ data: null, loading: true, error: '' });

    getServiceLaneDetail(service.slug, serviceCommandView)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setServiceLaneDetailState({
          data: payload || null,
          loading: false,
          error: ''
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setServiceLaneDetailState({
          data: null,
          loading: false,
          error: error?.message || 'Lane action kit could not be loaded.'
        });
      });

    return () => {
      cancelled = true;
    };
  }, [service?.slug, hasServiceCommandCenter, serviceCommandView]);

  if (!service) {
    return <Navigate to="/services" replace />;
  }

  const isLive = service.status === 'available';
  const estimatedCost = getServiceEstimatedCost(service, config);
  const relatedServices = getRelatedServices(service.slug, 3);
  const preview = getServicePreview(service);
  const recommendedPacks = getRecommendedPointPacks(service, config);
  const needsTopUp = estimatedCost !== null && points < estimatedCost;
  const hydratedServiceCommandCenter = mergeServiceCommandCenterSummary(
    serviceCommandCenter,
    serviceCommandSummaryState.data
  );
  const activeServiceLane = hydratedServiceCommandCenter?.lanes.find((lane) => lane.id === serviceCommandView);
  const isFlashEmailService = service.category === 'Verified Notifications';
  const isBankSlipService = service.category === 'Verified Wallets';
  const isPayPalService = service.slug === 'paypal';
  const isOfficialInvoiceView = isPayPalService && officialView === 'official-invoicing';
  const isOfficialPayoutView = isPayPalService && officialView === 'official-payouts';
  const providerStatus = providerRegistryState.providers.find((entry) => entry.key === providerLauncher?.key) || null;
  const providerInvoiceFeatures =
    providerRegistryState.invoiceFeatures.find((entry) => entry.provider?.key === providerLauncher?.key) || null;

  if (providerLauncher) {
    const providerBackLabel = `Back to ${providerLauncher.title} Launcher`;
    const providerShellStyle = {
      background: `linear-gradient(135deg, ${providerLauncher.accent.soft} 0%, #ffffff 58%, ${providerLauncher.accent.soft} 100%)`,
      borderColor: providerLauncher.accent.edge
    };

    if (activeProviderLane) {
      const LaneIcon = laneIconMap[activeProviderLane.id] || Layers3;
      const laneStatus = getLaneStatusCopy(activeProviderLane);
      const isLiveProviderInvoice =
        ['paypal', 'stripe', 'crypto'].includes(providerLauncher.key) && activeProviderLane.id === 'invoices';
      const isLivePayPalPayout = providerLauncher.key === 'paypal' && activeProviderLane.id === 'payouts';
      const isLiveStripePayout = providerLauncher.key === 'stripe' && activeProviderLane.id === 'payouts';
      const requiresAdmin = Boolean(activeProviderLane.adminOnly);
      const isSetupLaneDisabled = shouldDisableLaneForReadiness(activeProviderLane, providerStatus, user?.isAdmin);

      if (isLivePayPalPayout && user?.isAdmin) {
        return (
          <div className="min-h-screen bg-[#f5f7fa] px-4 py-6 md:px-8">
            <div className="mx-auto max-w-[1180px]">
              <Link
                to={`/services/${service.slug}`}
                className="mb-4 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-black transition"
                style={{ borderColor: providerLauncher.accent.edge, color: providerLauncher.accent.bg }}
              >
                <ArrowLeft size={16} />
                {providerBackLabel}
              </Link>
              <AdminPaymentsTab mode="payout" embedded />
            </div>
          </div>
        );
      }

      if (isLiveStripePayout && user?.isAdmin) {
        return (
          <div className="min-h-screen bg-[#f5f7fa] px-4 py-6 md:px-8">
            <div className="mx-auto max-w-[1180px]">
              <Link
                to={`/services/${service.slug}`}
                className="mb-4 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-black transition"
                style={{ borderColor: providerLauncher.accent.edge, color: providerLauncher.accent.bg }}
              >
                <ArrowLeft size={16} />
                {providerBackLabel}
              </Link>
              <AdminPaymentsTab mode="payout" embedded providerFilter="stripe" />
            </div>
          </div>
        );
      }

      return (
        <DashboardLayout>
          <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
            <div className="rounded-[32px] border bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-8" style={providerShellStyle}>
              <Link
                to={`/services/${service.slug}`}
                className="inline-flex items-center gap-2 text-sm font-black transition hover:opacity-75"
                style={{ color: providerLauncher.accent.bg }}
              >
                <ArrowLeft size={16} />
                {providerBackLabel}
              </Link>

              <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-4">
                    <ServiceLogo service={service} size="lg" />
                    <div
                      className="inline-flex rounded-full border bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em]"
                      style={{ borderColor: providerLauncher.accent.edge, color: providerLauncher.accent.bg }}
                    >
                      {providerLauncher.title} Sub-Page
                    </div>
                  </div>
                  <h1 className="mt-5 text-3xl font-black tracking-[-0.05em] text-slate-950 md:text-5xl">{activeProviderLane.title}</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">{activeProviderLane.subtitle}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:w-[320px] lg:grid-cols-1">
                  <div className="rounded-[22px] border border-white/70 bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Provider</p>
                    <p className="mt-3 text-lg font-black tracking-[-0.03em] text-slate-950">{providerLauncher.title}</p>
                  </div>
                  <div className={`rounded-[22px] border px-4 py-4 text-sm font-black ${laneStatus.classes}`}>
                    {laneStatus.label}
                  </div>
                  {user?.isAdmin ? (
                    <div className={`rounded-[22px] border px-4 py-4 text-sm font-black ${getReadinessTone(providerStatus?.status).classes}`}>
                      {providerRegistryState.loading ? 'Loading readiness' : getReadinessTone(providerStatus?.status).label}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section className="rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] md:p-6">
                  <div className="flex items-center gap-3">
                    <div
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white"
                      style={{ backgroundColor: providerLauncher.accent.bg, color: providerLauncher.accent.fg }}
                    >
                      <LaneIcon size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Workspace Lane</p>
                      <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">{activeProviderLane.title}</h2>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {activeProviderLane.bullets.map((bullet) => (
                      <div key={bullet} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold leading-6 text-slate-700">
                        {bullet}
                      </div>
                    ))}
                  </div>

                  {activeProviderLane.kind === 'custom' ? (
                    <Link
                      to={activeProviderLane.to}
                      className="mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                      style={{ backgroundColor: providerLauncher.accent.bg, color: providerLauncher.accent.fg }}
                    >
                      {activeProviderLane.ctaLabel}
                      <ArrowRight size={16} />
                    </Link>
                  ) : null}

                  {requiresAdmin && !user?.isAdmin ? (
                    <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4">
                      <div className="flex items-start gap-3">
                        <Clock3 size={18} className="mt-0.5 text-amber-700" />
                        <div>
                          <p className="text-sm font-black text-slate-950">Admin access is required for this provider lane.</p>
                          <p className="mt-2 text-xs leading-6 text-slate-600">
                            This lane controls provider operations, state refresh, webhooks, settlement, or wallet readiness.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeProviderLane.status !== 'live' && (!requiresAdmin || user?.isAdmin) ? (
                    <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
                      <p className="text-sm font-black text-slate-950">
                        {isSetupLaneDisabled
                          ? 'This provider lane is disabled until required environment variables are configured.'
                          : 'This provider lane is registered, but live operations are still disabled.'}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-slate-600">
                        The backend adapter registry already describes this lane. The next implementation step is the signed provider client, webhook verifier, idempotency rules, ledger mapping, and sandbox smoke test.
                      </p>
                    </div>
                  ) : null}

                  {activeProviderLane.kind === 'balance' && activeProviderLane.status === 'live' && user?.isAdmin ? (
                    <div className="mt-6">
                      <ProviderBalancePanel
                        balance={providerBalanceState.balance}
                        loading={providerBalanceState.loading}
                        error={providerBalanceState.error}
                      />
                    </div>
                  ) : null}
                </section>

                <aside className="space-y-4">
                  {user?.isAdmin ? (
                    <ProviderReadinessPanel
                      providerLauncher={providerLauncher}
                      providerStatus={providerStatus}
                      invoiceFeatures={providerInvoiceFeatures}
                      loading={providerRegistryState.loading}
                      error={providerRegistryState.error}
                    />
                  ) : null}
                  {user?.isAdmin && providerLauncher.key === 'stripe' ? (
                    <StripeConnectedAccountsPanel accent={providerLauncher.accent} />
                  ) : null}
                  <div className="rounded-[28px] border border-white/70 bg-white p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Provider Group</p>
                    <h3 className="mt-3 text-xl font-black tracking-[-0.04em] text-slate-950">{providerLauncher.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{providerLauncher.description}</p>
                  </div>
                  <div className="rounded-[28px] border border-white/70 bg-white p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Other Sub-Pages</p>
                    <div className="mt-4 space-y-2">
                      {providerLauncher.lanes
                        .filter((lane) => lane.id !== activeProviderLane.id)
                        .map((lane) => (
                          <Link
                            key={lane.id}
                            to={`/services/${service.slug}?view=${lane.id}`}
                            className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 transition hover:border-slate-300"
                          >
                            {lane.title}
                            <ArrowRight size={15} />
                          </Link>
                        ))}
                    </div>
                  </div>
                </aside>
              </div>

              {isLiveProviderInvoice && user?.isAdmin ? (
                <div className="mt-8">
                  <AdminPaymentsTab mode="invoice" embedded providerFilter={providerLauncher.key} />
                </div>
              ) : null}
            </div>
          </div>
        </DashboardLayout>
      );
    }

    return (
      <DashboardLayout>
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          <div className="rounded-[32px] border bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-8" style={providerShellStyle}>
            <Link to="/services" className="inline-flex items-center gap-2 text-sm font-black text-slate-600 transition hover:text-slate-950">
              <ArrowLeft size={16} />
              Back to Services
            </Link>

            <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-4">
                  <ServiceLogo service={service} size="lg" />
                  <div
                    className="inline-flex rounded-full border bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em]"
                    style={{ borderColor: providerLauncher.accent.edge, color: providerLauncher.accent.bg }}
                  >
                    {providerLauncher.eyebrow}
                  </div>
                </div>
                <h1 className="mt-5 text-3xl font-black tracking-[-0.05em] text-slate-950 md:text-5xl">
                  {providerLauncher.title} Launcher
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">{providerLauncher.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[320px] lg:grid-cols-1">
                <div className="rounded-[22px] border border-white/70 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Current balance</p>
                  <p className="mt-3 text-2xl font-black tracking-[-0.05em] text-slate-950">{points.toLocaleString()} pts</p>
                </div>
                <div className="rounded-[22px] border border-white/70 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Provider status</p>
                  <p className="mt-3 text-lg font-black tracking-[-0.03em] text-slate-950">
                    {user?.isAdmin && providerStatus
                      ? getReadinessTone(providerStatus.status).label
                      : providerLauncher.statusLabel}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {providerLauncher.lanes.map((lane) => {
                const LaneIcon = laneIconMap[lane.id] || Layers3;
                const laneStatus = getLaneStatusCopy(lane);
                const disabledForReadiness = shouldDisableLaneForReadiness(lane, providerStatus, user?.isAdmin);
                const cardClassName = `rounded-[26px] border border-white/70 bg-white px-5 py-5 text-left shadow-[0_14px_34px_rgba(15,23,42,0.04)] transition ${
                  disabledForReadiness
                    ? 'cursor-not-allowed opacity-65'
                    : 'hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]'
                }`;
                const cardContent = (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white"
                        style={{ backgroundColor: providerLauncher.accent.bg, color: providerLauncher.accent.fg }}
                      >
                        <LaneIcon size={19} />
                      </div>
                      <div className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${disabledForReadiness ? 'border-slate-200 bg-slate-100 text-slate-500' : laneStatus.classes}`}>
                        {disabledForReadiness ? 'Env needed' : laneStatus.label}
                      </div>
                    </div>
                    <h2 className="mt-5 text-xl font-black tracking-[-0.04em] text-slate-950">{lane.title}</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{lane.subtitle}</p>
                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-black" style={{ color: disabledForReadiness ? '#64748b' : providerLauncher.accent.bg }}>
                      {disabledForReadiness ? 'Configure env first' : 'Open sub-page'}
                      <ArrowRight size={16} />
                    </div>
                  </>
                );

                return disabledForReadiness ? (
                  <div key={lane.id} className={cardClassName}>
                    {cardContent}
                  </div>
                ) : (
                  <Link
                    key={lane.id}
                    to={`/services/${service.slug}?view=${lane.id}`}
                    className={cardClassName}
                  >
                    {cardContent}
                  </Link>
                );
              })}
            </div>

            {user?.isAdmin ? (
              <div className="mt-8 space-y-6">
                <ProviderReadinessPanel
                  providerLauncher={providerLauncher}
                  providerStatus={providerStatus}
                  invoiceFeatures={providerInvoiceFeatures}
                  loading={providerRegistryState.loading}
                  error={providerRegistryState.error}
                />
                {providerLauncher.key === 'stripe' ? (
                  <StripeConnectedAccountsPanel accent={providerLauncher.accent} />
                ) : null}
              </div>
            ) : null}

            <div className="mt-8 rounded-[28px] border border-white/70 bg-white p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Provider Capabilities</p>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {providerLauncher.capabilities.map((capability) => (
                  <div key={capability} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                    {capability}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (hydratedServiceCommandCenter) {
    return (
      <ServiceCommandCenterPage
        service={service}
        commandCenter={hydratedServiceCommandCenter}
        activeLane={activeServiceLane}
        points={points}
        estimatedCost={estimatedCost}
        recommendedPacks={recommendedPacks}
        needsTopUp={needsTopUp}
        relatedServices={relatedServices}
        commandCenterSummaryLoading={serviceCommandSummaryState.loading}
        commandCenterSummaryError={serviceCommandSummaryState.error}
        laneDetailState={serviceLaneDetailState}
      />
    );
  }

  if (isFlashEmailService) {
    const launchOptions = [
      {
        title: 'Custom Notification',
        subtitle: 'Open the editable notification builder for this service.',
        to: `/dashboard/generate?type=email&service=${service.slug}&mailType=custom`
      },
      {
        title: 'Deposit Notification',
        subtitle: 'Use the same service flow with deposit context applied.',
        to: `/dashboard/generate?type=email&service=${service.slug}&mailType=deposit`
      }
    ];
    const officialOptions = isPayPalService
      ? [
          {
            title: 'Official Invoicing',
            subtitle: 'Jump into the canonical PayPal invoice workspace with hosted links, QR generation, reminder cadence, and sync controls.',
            to: `/services/${service.slug}?view=official-invoicing`,
            icon: FileText
          },
          {
            title: 'Official Payouts',
            subtitle: 'Open the operational PayPal payout console for provider-state tracking, reconciliation, and remediation actions.',
            to: `/services/${service.slug}?view=official-payouts`,
            icon: Send
          }
        ]
      : [];

    if (isOfficialPayoutView) {
      return (
        <div className="min-h-screen bg-[#f5f7fa] px-4 py-6 md:px-8">
          <div className="mx-auto max-w-[1180px]">
            <Link
              to={`/services/${service.slug}`}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#c7d6f1] bg-white px-4 py-2 text-sm font-black text-[#003087] transition hover:border-[#003087]"
            >
              <ArrowLeft size={16} />
              Back to PayPal Launcher
            </Link>
            {user?.isAdmin ? (
              <AdminPaymentsTab mode="payout" embedded />
            ) : (
              <div className="rounded-[28px] border border-[#d7e3f9] bg-white p-6 text-left shadow-[0_20px_60px_rgba(0,48,135,0.08)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#003087]">
                      <Layers3 size={14} />
                      Workspace Locked
                    </div>
                    <h1 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">
                      Admin access is required for the official PayPal payout workspace.
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                      This payout surface controls canonical PayPal provider-state remediation, payout review, and funding release.
                    </p>
                  </div>
                  <Clock3 size={18} className="mt-1 text-slate-400" />
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (isOfficialInvoiceView) {
      const viewTitle = isOfficialInvoiceView ? 'Official PayPal Invoicing' : 'Official PayPal Payouts';
      const viewSubtitle = isOfficialInvoiceView
        ? 'Launch the hosted PayPal invoice stack from a dedicated PayPal sub-launcher.'
        : 'Launch the official payout operations stack from a dedicated PayPal sub-launcher.';
      const viewDescription = isOfficialInvoiceView
        ? 'This launcher is for canonical PayPal invoice work only: hosted invoice links, QR creation, reminder cadence, template reuse, and provider sync.'
        : 'This launcher is for canonical PayPal payout work only: payout tracking, provider-state refresh, remediation actions, funding review, and reconciliation.';
      const checklist = isOfficialInvoiceView
        ? ['Hosted PayPal invoice links', 'Official QR generation', 'Template-backed invoice ops', 'Reminder cadence controls']
        : ['Official payout tracking', 'Provider-state remediation', 'Funding review alignment', 'Reconciliation issue handling'];

      return (
        <DashboardLayout>
          <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
            <div className="rounded-[32px] border border-[#d8e4f8] bg-[linear-gradient(180deg,#ffffff_0%,#f5f9ff_100%)] p-6 shadow-[0_20px_60px_rgba(0,48,135,0.08)] md:p-8">
              <div className="mx-auto max-w-4xl">
                <Link
                  to={`/services/${service.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-black text-[#003087] transition hover:text-[#001f5c]"
                >
                  <ArrowLeft size={16} />
                  Back to PayPal Launcher
                </Link>

                <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex items-center gap-4">
                      <ServiceLogo service={service} size="lg" />
                      <div className="inline-flex rounded-full border border-[#b7c9ea] bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#003087]">
                        PayPal Official Launcher
                      </div>
                    </div>
                    <h1 className="mt-5 text-3xl font-black tracking-[-0.05em] text-slate-950 md:text-5xl">{viewTitle}</h1>
                    <p className="mt-3 text-base font-semibold text-slate-700">{viewSubtitle}</p>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{viewDescription}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:w-[320px] lg:grid-cols-1">
                    <div className="rounded-[22px] border border-[#d9e4f7] bg-white p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Access</p>
                      <p className="mt-3 text-lg font-black tracking-[-0.03em] text-slate-950">
                        {user?.isAdmin ? 'Admin Enabled' : 'Admin Required'}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-[#d9e4f7] bg-white p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Readiness</p>
                      <p className="mt-3 text-lg font-black tracking-[-0.03em] text-slate-950">
                        {needsTopUp ? 'Balance Attention' : 'Operationally Ready'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <div className={`rounded-[24px] border px-4 py-4 text-left ${needsTopUp ? 'border-[#f2d0b0] bg-[#fff4e8]' : 'border-[#d9eee1] bg-[#effaf4]'}`}>
                      <div className="flex items-start gap-3">
                        <Wallet size={18} className={needsTopUp ? 'text-[#c76c1a]' : 'text-emerald-600'} />
                        <div>
                          <p className="text-sm font-black text-slate-950">
                            {needsTopUp
                              ? `Your balance is below the ${estimatedCost.toLocaleString()} point recommendation for ${service.title}.`
                              : `Your balance is ready for ${service.title}.`}
                          </p>
                          <p className="mt-2 text-xs leading-6 text-slate-600">
                            Recommended packs: {recommendedPacks.map((pack) => `${pack.toLocaleString()} pts`).join(' · ')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#d9e4f7] bg-white p-5">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                        <Sparkles size={14} />
                        Includes
                      </div>
                      <div className="mt-4 space-y-3">
                        {checklist.map((item) => (
                          <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {user?.isAdmin ? (
                  <div className="mt-8">
                    <AdminPaymentsTab
                      mode={isOfficialInvoiceView ? 'invoice' : 'payout'}
                      embedded
                    />
                  </div>
                ) : (
                  <div className="mt-8 rounded-[28px] border border-[#d7e3f9] bg-white/85 p-6 text-left">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#003087]">
                          <Layers3 size={14} />
                          Workspace Locked
                        </div>
                        <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">Admin access is required for the official PayPal workspace.</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                          The real invoice and payout consoles are embedded here, but they stay restricted because they control canonical PayPal operations, provider-state remediation, and funding release.
                        </p>
                      </div>
                      <Clock3 size={18} className="mt-1 text-slate-400" />
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to={`/services/${service.slug}`}
                    className="inline-flex items-center justify-center rounded-full border border-[#c7d6f1] bg-white px-5 py-3 text-sm font-black text-[#003087] transition hover:border-[#003087]"
                  >
                    Back to PayPal Launcher
                  </Link>
                  {!user?.isAdmin ? (
                    <Link
                      to="/help"
                      className="inline-flex items-center justify-center rounded-full border border-[#ece2d2] bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:border-[#f2c39a]"
                    >
                      Request Admin Help
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </DashboardLayout>
      );
    }

    return (
      <DashboardLayout>
        <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
          <div className="rounded-[32px] border border-[#ece2d2] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-8">
            <div className="mx-auto max-w-2xl text-center">
              <div className="flex justify-center">
                <ServiceLogo service={service} size="lg" />
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-[-0.05em] text-slate-950 md:text-5xl">{service.title}</h1>
              <p className="mt-3 text-base font-semibold text-slate-600">Choose the type of mail to Send</p>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                This launcher matches the live flow more closely: pick the mail variant first, then continue into the builder with {service.title} context already applied.
              </p>

              {estimatedCost !== null ? (
                <div className={`mt-6 rounded-[24px] border px-4 py-4 text-left ${needsTopUp ? 'border-[#f2d0b0] bg-[#fff4e8]' : 'border-[#d9eee1] bg-[#effaf4]'}`}>
                  <div className="flex items-start gap-3">
                    <Wallet size={18} className={needsTopUp ? 'text-[#c76c1a]' : 'text-emerald-600'} />
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {needsTopUp
                          ? `Your balance is below the ${estimatedCost.toLocaleString()} point recommendation for ${service.title}.`
                          : `Your balance is ready for ${service.title}.`}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-slate-600">
                        Recommended packs: {recommendedPacks.map((pack) => `${pack.toLocaleString()} pts`).join(' · ')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {launchOptions.map((option) => (
                  <Link
                    key={option.title}
                    to={option.to}
                    className="rounded-[26px] border border-[#ece2d2] bg-[#faf7f1] px-5 py-5 text-left transition hover:border-[#f2c39a] hover:bg-orange-50/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black tracking-[-0.03em] text-slate-950">{option.title}</p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{option.subtitle}</p>
                      </div>
                      <ArrowRight size={18} className="mt-1 text-slate-400" />
                    </div>
                  </Link>
                ))}
              </div>

              {isPayPalService ? (
                <div className="mt-8 rounded-[28px] border border-[#c9d7f0] bg-[linear-gradient(135deg,rgba(0,48,135,0.08),rgba(255,255,255,1))] p-5 text-left">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#003087]">Official PayPal Alternative</p>
                      <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-slate-950">Use the real invoice and payout operations when you need PayPal-hosted flows.</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                        This keeps notification drafting available while exposing the production-facing PayPal back office for hosted invoices, payout tracking, provider sync, and remediation.
                      </p>
                    </div>
                    <div className="inline-flex rounded-full border border-[#b5c7ea] bg-white/85 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#003087]">
                      {user?.isAdmin ? 'Admin enabled' : 'Admin required'}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {officialOptions.map((option) => {
                      const Icon = option.icon;

                      if (!user?.isAdmin) {
                        return (
                          <div
                            key={option.title}
                            className="rounded-[24px] border border-[#d7e3f9] bg-white/80 px-5 py-5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#003087] text-white">
                                  <Icon size={18} />
                                </div>
                                <p className="mt-4 text-lg font-black tracking-[-0.03em] text-slate-950">{option.title}</p>
                                <p className="mt-2 text-sm leading-7 text-slate-600">{option.subtitle}</p>
                                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Admin access required</p>
                              </div>
                              <Clock3 size={18} className="mt-1 text-slate-400" />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={option.title}
                          to={option.to}
                          className="rounded-[24px] border border-[#bcd0f6] bg-white px-5 py-5 transition hover:border-[#003087] hover:shadow-[0_18px_40px_rgba(0,48,135,0.08)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#003087] text-white">
                                <Icon size={18} />
                              </div>
                              <p className="mt-4 text-lg font-black tracking-[-0.03em] text-slate-950">{option.title}</p>
                              <p className="mt-2 text-sm leading-7 text-slate-600">{option.subtitle}</p>
                              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#003087]">Open official ops</p>
                            </div>
                            <ArrowRight size={18} className="mt-1 text-[#003087]" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                {needsTopUp ? (
                  <Link
                    to={`/buy-point?intent=${service.slug}`}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: service.accent.bg }}
                  >
                    Buy Points
                    <ArrowRight size={16} />
                  </Link>
                ) : null}
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center rounded-full border border-[#ece2d2] bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:border-[#f2c39a]"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isBankSlipService) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
          <div className="rounded-[32px] border border-[#ece2d2] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-8">
            <div className="mx-auto max-w-2xl text-center">
              <div className="flex justify-center">
                <ServiceLogo service={service} size="lg" />
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-[-0.05em] text-slate-950 md:text-5xl">{service.title}</h1>
              <p className="mt-3 text-base font-semibold text-slate-600">{isLive ? `${service.title} wallet records` : 'Wallet record flow coming soon'}</p>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                This launcher keeps wallet brands simple and direct: open the branded record builder, then generate a Transferly support record without extra navigation noise.
              </p>

              {estimatedCost !== null ? (
                <div className={`mt-6 rounded-[24px] border px-4 py-4 text-left ${needsTopUp ? 'border-[#f2d0b0] bg-[#fff4e8]' : 'border-[#d9eee1] bg-[#effaf4]'}`}>
                  <div className="flex items-start gap-3">
                    <Wallet size={18} className={needsTopUp ? 'text-[#c76c1a]' : 'text-emerald-600'} />
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {needsTopUp
                          ? `Your balance is below the ${estimatedCost.toLocaleString()} point recommendation for ${service.title}.`
                          : `Your balance is ready for ${service.title}.`}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-slate-600">
                        Recommended packs: {recommendedPacks.map((pack) => `${pack.toLocaleString()} pts`).join(' · ')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-8 grid gap-4">
                {isLive ? (
                  <Link
                    to={`/dashboard/generate?type=bank&service=${service.slug}`}
                    className="rounded-[26px] border border-[#ece2d2] bg-[#faf7f1] px-5 py-5 text-left transition hover:border-[#f2c39a] hover:bg-orange-50/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black tracking-[-0.03em] text-slate-950">Generate Record</p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">Open the branded wallet-record builder with {service.title} context already applied.</p>
                      </div>
                      <ArrowRight size={18} className="mt-1 text-slate-400" />
                    </div>
                  </Link>
                ) : (
                  <div className="rounded-[26px] border border-slate-200 bg-slate-100 px-5 py-5 text-left opacity-70">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black tracking-[-0.03em] text-slate-950">Coming Soon</p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">Keep this branded entry point in place until the {service.title} wallet-record flow is released.</p>
                      </div>
                      <Clock3 size={18} className="mt-1 text-slate-400" />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                {needsTopUp ? (
                  <Link
                    to={`/buy-point?intent=${service.slug}`}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: service.accent.bg }}
                  >
                    Buy Points
                    <ArrowRight size={16} />
                  </Link>
                ) : null}
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center rounded-full border border-[#ece2d2] bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:border-[#f2c39a]"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="rounded-[32px] bg-[#121212] px-6 py-7 text-white shadow-[0_28px_80px_rgba(15,23,42,0.18)] md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <Link to="/services" className="inline-flex items-center gap-2 text-sm font-bold text-white/65 transition hover:text-white">
                <ArrowLeft size={16} />
                Back to Services
              </Link>
              <div className="mt-5 flex items-center gap-4">
                <ServiceLogo service={service} size="lg" />
                <div>
                  <div className="inline-flex rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
                    {service.category}
                  </div>
                  <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-white md:text-5xl">{service.title}</h1>
                </div>
              </div>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/72 md:text-base">{service.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:w-[300px]">
              <div className="rounded-[24px] border border-white/8 bg-white/6 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">Current balance</p>
                <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-white">{points.toLocaleString()} pts</p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/6 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">Service status</p>
                <p className="mt-3 text-lg font-black tracking-[-0.03em] text-white">{isLive ? 'Available now' : 'Coming soon'}</p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/6 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">Badge</p>
                <p className="mt-3 text-lg font-black tracking-[-0.03em] text-white">{service.badge}</p>
              </div>
              {estimatedCost !== null ? (
                <div className="rounded-[24px] border border-white/8 bg-white/6 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">Suggested balance</p>
                  <p className="mt-3 text-lg font-black tracking-[-0.03em] text-white">{estimatedCost.toLocaleString()} pts</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
          <section className="rounded-[30px] border border-[#e9e0d2] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              <Sparkles size={14} />
              Service Overview
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">A dedicated page for the {service.title} flow.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">{service.detail}</p>

            <div className="mt-6 rounded-[28px] border border-[#ece2d2] bg-[#faf7f1] p-5">
              <div className="flex items-center gap-3">
                <ServiceLogo service={service} size="md" showTitle />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    <Layers3 size={14} />
                    Category
                  </div>
                  <p className="mt-2 text-lg font-black text-slate-950">{service.category}</p>
                </div>
                <div className="rounded-[24px] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    <Clock3 size={14} />
                    Status
                  </div>
                  <p className="mt-2 text-lg font-black text-slate-950">{isLive ? 'Ready to launch' : 'Awaiting release'}</p>
                </div>
              </div>
            </div>

            <div
              className="mt-6 overflow-hidden rounded-[28px] border p-5 text-white shadow-[0_18px_45px_var(--service-glow)]"
              style={{
                backgroundColor: service.accent.bg,
                borderColor: service.accent.edge,
                '--service-glow': service.accent.glow
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/55">{preview.eyebrow}</p>
                  <h3 className="mt-3 max-w-xl text-2xl font-black tracking-[-0.04em] text-white">{preview.headline}</h3>
                </div>
                <ServiceLogo service={service} size="md" />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {preview.bullets.map((bullet) => (
                  <div key={bullet} className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-4 text-sm font-bold text-white/85">
                    {bullet}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[30px] border border-[#e9e0d2] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Launch</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">
                {isLive ? 'Open this service now.' : 'This service is not active yet.'}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {isLive
                  ? 'Use the dedicated launch button below to continue into the matching Transferly tool flow.'
                  : 'The live capture marks this service as upcoming. Keep the dedicated service page in place so the catalog structure stays intact.'}
              </p>

              {estimatedCost !== null ? (
                <div className={`mt-5 rounded-[24px] border px-4 py-4 ${needsTopUp ? 'border-[#f2d0b0] bg-[#fff4e8]' : 'border-[#d9eee1] bg-[#effaf4]'}`}>
                  <div className="flex items-start gap-3">
                    <Wallet size={18} className={needsTopUp ? 'text-[#c76c1a]' : 'text-emerald-600'} />
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {needsTopUp
                          ? `You need at least ${estimatedCost.toLocaleString()} points for this flow.`
                          : `Your balance is ready for this ${service.category === 'Verified Wallets' ? 'wallet record' : 'notification'} flow.`}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-slate-600">
                        Recommended top-up packs: {recommendedPacks.map((pack) => `${pack.toLocaleString()} pts`).join(' · ')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {isLive ? (
                <div className="mt-6 space-y-3">
                  {needsTopUp ? (
                    <Link
                      to={`/buy-point?intent=${service.slug}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-black text-white transition hover:opacity-90"
                      style={{ backgroundColor: service.accent.bg }}
                    >
                      Buy Points for {service.title}
                      <ArrowRight size={16} />
                    </Link>
                  ) : null}
                  <Link
                    to={service.launchTo}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-black transition ${
                      needsTopUp ? 'border border-[#eadfce] bg-[#faf7f1] text-slate-800 hover:border-[#f2c39a]' : 'text-white hover:opacity-90'
                    }`}
                    style={needsTopUp ? undefined : { backgroundColor: service.accent.bg }}
                  >
                    {service.launchLabel}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ) : (
                <button
                  disabled
                  className="mt-6 inline-flex w-full cursor-not-allowed items-center justify-center rounded-full bg-slate-300 px-5 py-3.5 text-sm font-black text-white"
                >
                  {service.launchLabel}
                </button>
              )}
            </div>

            {relatedServices.length ? (
              <div className="rounded-[30px] border border-[#e9e0d2] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Related services</p>
                <div className="mt-4 space-y-3">
                  {relatedServices.map((related) => (
                    <Link
                      key={related.slug}
                      to={`/services/${related.slug}`}
                      className="flex items-center justify-between rounded-[24px] border border-[#ece2d2] bg-[#faf7f1] px-4 py-4 text-sm font-black text-slate-800 transition hover:border-[#f2c39a]"
                    >
                      <div className="flex items-center gap-3">
                        <ServiceLogo service={related} size="sm" />
                        <div>
                          <p className="text-sm font-black text-slate-950">{related.title}</p>
                          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{related.badge}</p>
                        </div>
                      </div>
                      <ArrowRight size={16} />
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-[30px] border border-[#e9e0d2] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Navigation</p>
              <div className="mt-4 space-y-3">
                <Link
                  to="/services"
                  className="flex items-center justify-between rounded-[24px] border border-[#ece2d2] bg-[#faf7f1] px-4 py-4 text-sm font-black text-slate-800 transition hover:border-[#f2c39a]"
                >
                  Back to all services
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/transactions"
                  className="flex items-center justify-between rounded-[24px] border border-[#ece2d2] bg-[#faf7f1] px-4 py-4 text-sm font-black text-slate-800 transition hover:border-[#f2c39a]"
                >
                  View activity
                  <ExternalLink size={16} />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
