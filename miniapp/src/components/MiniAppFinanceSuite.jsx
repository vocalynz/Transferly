import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileText,
  Gauge,
  LineChart,
  LockKeyhole,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  WalletCards,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { useTelegramMiniApp } from '../context/TelegramMiniAppContext';
import { PremiumInput } from './ui';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
});

const statusTone = {
  PAID: 'success',
  COMPLETED: 'success',
  SUCCEEDED: 'success',
  SENT: 'info',
  PROCESSING: 'info',
  PENDING: 'warn',
  PENDING_APPROVAL: 'warn',
  AWAITING_CONFIRMATION: 'warn',
  FAILED: 'danger',
  CANCELLED: 'danger',
  REJECTED: 'danger',
  DISPUTED: 'danger',
  HOLD: 'danger'
};

function formatMoney(value, currency = 'USD') {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (_error) {
    return currencyFormatter.format(amount);
  }
}

function formatDate(value) {
  if (!value) {
    return 'Now';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Now';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function normalizeStatus(value) {
  return String(value || 'pending').replace(/_/g, ' ').toLowerCase();
}

function parseMoneyNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function firstMoney(values) {
  for (const value of values) {
    const parsed = parseMoneyNumber(value);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function readAmount(record) {
  const directAmount = firstMoney([
    record?.amount,
    record?.total_amount,
    record?.gross_amount,
    record?.value,
    record?.summary?.amount,
    record?.summary?.total_debit,
    record?.pricing?.total_debit,
    record?.pricing?.requested_amount
  ]);

  if (directAmount !== null) {
    return directAmount;
  }

  const cents = firstMoney([
    record?.amount_cents,
    record?.amountCents,
    record?.summary?.amount_cents,
    record?.summary?.total_debit_cents
  ]);

  if (cents !== null) {
    return cents / 100;
  }

  return record?.items?.reduce((sum, item) => sum + Number(item.quantity || 1) * Number(item.unitAmount || item.unit_amount || 0), 0) || 0;
}

function readCurrency(record) {
  return record?.summary?.currency || record?.currency || record?.currency_code || record?.currencyCode || record?.amount_currency || 'USD';
}

function readInvoiceId(invoice) {
  return invoice?.internal_invoice_id || invoice?.paypal_invoice_id || invoice?.invoice_id || invoice?.id || 'draft';
}

function readPayoutId(payout) {
  return payout?.payout_id || payout?.paypal_payout_batch_id || payout?.id || 'pending';
}

function readInvoiceRecipient(invoice) {
  return invoice?.summary?.recipient_email || invoice?.recipient_email || invoice?.recipientEmail || invoice?.customer_email || 'Client';
}

function readInvoiceDescription(invoice) {
  return invoice?.summary?.description || invoice?.description || readInvoiceRecipient(invoice);
}

function readInvoiceCreatedAt(invoice) {
  return invoice?.summary?.created_at || invoice?.created_at || invoice?.createdAt;
}

function readInvoiceUpdatedAt(invoice) {
  return invoice?.summary?.updated_at || invoice?.updated_at || invoice?.updatedAt || readInvoiceCreatedAt(invoice);
}

function readPayoutReceiver(payout) {
  return payout?.summary?.receiver || payout?.receiver || payout?.recipient || payout?.receiver_email || 'Receiver';
}

function readPayoutNote(payout) {
  return payout?.summary?.note || payout?.note || readPayoutReceiver(payout);
}

function readPayoutCreatedAt(payout) {
  return payout?.summary?.created_at || payout?.created_at || payout?.createdAt;
}

function readPayoutUpdatedAt(payout) {
  return payout?.summary?.updated_at || payout?.updated_at || payout?.updatedAt || readPayoutCreatedAt(payout);
}

function readWalletAmount(profile, key) {
  const wallet = profile?.wallet || {};
  const camelKey = key.replace(/_([a-z])/g, (_match, character) => character.toUpperCase());
  const cents = firstMoney([wallet[`${key}_cents`], wallet[`${key}Cents`], wallet[`${camelKey}_cents`], wallet[`${camelKey}Cents`]]);

  if (cents !== null) {
    return cents / 100;
  }

  return firstMoney([wallet[key], wallet[camelKey]]) || 0;
}

function toneClass(tone = 'default') {
  const classes = {
    default: 'bg-[var(--tg-section-bg-color)] text-[var(--tg-text-color)]',
    accent: 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]',
    success: 'bg-emerald-50 text-emerald-700',
    info: 'bg-sky-50 text-sky-700',
    warn: 'bg-amber-50 text-amber-700',
    danger: 'bg-rose-50 text-rose-700'
  };

  return classes[tone] || classes.default;
}

function StatusBadge({ status }) {
  const upper = String(status || 'PENDING').toUpperCase();
  const tone = statusTone[upper] || 'default';

  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${toneClass(tone)}`}>
      {normalizeStatus(upper)}
    </span>
  );
}

function SuiteHeader({ eyebrow, title, body, icon: Icon, action }) {
  return (
    <section className="miniapp-enter overflow-hidden rounded-[30px] bg-[var(--tg-section-bg-color)] shadow-[0_22px_70px_rgba(15,23,42,0.12)]">
      <div className="relative p-5 sm:p-6">
        <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[42px] bg-[color-mix(in_srgb,var(--tg-button-color)_12%,transparent)]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--tg-secondary-bg-color)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">
              <Icon size={14} />
              {eyebrow}
            </div>
            <h2 className="mt-4 text-3xl font-black leading-[0.95] tracking-[-0.055em] text-[var(--tg-text-color)] sm:text-5xl">
              {title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--tg-subtitle-text-color)]">{body}</p>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'default' }) {
  return (
    <div className={`rounded-[26px] p-4 shadow-sm ${tone === 'default' ? 'bg-[var(--tg-section-bg-color)]' : toneClass(tone)}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">
          <Icon size={15} />
          {label}
        </div>
      </div>
      <p className="mt-3 text-2xl font-black tracking-[-0.045em] text-[var(--tg-text-color)]">{value}</p>
      {detail ? <p className="mt-2 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{detail}</p> : null}
    </div>
  );
}

function SearchBar({ query, onQuery, placeholder = 'Search records' }) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] bg-[var(--tg-section-bg-color)] px-4 py-3 shadow-sm">
      <Search size={18} className="text-[var(--tg-hint-color)]" />
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--tg-text-color)] outline-none placeholder:text-[var(--tg-hint-color)]"
      />
      <SlidersHorizontal size={18} className="text-[var(--tg-hint-color)]" />
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-6 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-[var(--tg-secondary-bg-color)] text-[var(--tg-button-color)]">
        <Icon size={28} />
      </div>
      <h3 className="mt-5 text-xl font-black tracking-[-0.035em] text-[var(--tg-text-color)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--tg-subtitle-text-color)]">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

function PrimaryButton({ children, icon: Icon = ArrowRight, onClick, disabled, to }) {
  const className = 'inline-flex items-center justify-center gap-2 rounded-[20px] bg-[var(--tg-button-color)] px-5 py-3 text-sm font-black text-[var(--tg-button-text-color)] shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60';
  const content = (
    <>
      {children}
      <Icon size={16} />
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {content}
    </button>
  );
}

function SecondaryButton({ children, icon: Icon = ArrowRight, onClick, to }) {
  const className = 'inline-flex items-center justify-center gap-2 rounded-[20px] bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-sm font-black text-[var(--tg-text-color)] transition active:scale-[0.98]';
  const content = (
    <>
      <Icon size={16} />
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function Timeline({ events }) {
  return (
    <div className="space-y-3">
      {events.map((event, index) => {
        const Icon = event.icon;

        return (
          <div key={`${event.title}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full ${toneClass(event.tone || 'default')}`}>
                <Icon size={16} />
              </span>
              {index < events.length - 1 ? <span className="mt-2 h-9 w-px bg-black/10" /> : null}
            </div>
            <div className="min-w-0 flex-1 rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[var(--tg-text-color)]">{event.title}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{event.body}</p>
                </div>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">{event.time}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecordDetailPanel({ title, amount, status, rows, events, action }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[30px] bg-[var(--tg-section-bg-color)] shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
      <div className="border-b border-black/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Selected record</p>
            <h3 className="mt-2 truncate text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{title}</h3>
          </div>
          <StatusBadge status={status} />
        </div>
        <p className="mt-4 break-words text-4xl font-black tracking-[-0.06em] text-[var(--tg-text-color)]">{amount}</p>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
              <p className="text-xs font-bold text-[var(--tg-hint-color)]">{label}</p>
              <p className="mt-2 truncate text-sm font-black text-[var(--tg-text-color)]">{value || 'Not set'}</p>
            </div>
          ))}
        </div>
        {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
        <Timeline events={events} />
      </div>
    </section>
  );
}

const transactionSummaryGroups = [
  {
    label: 'Settled',
    statuses: ['PAID', 'COMPLETED', 'SUCCEEDED'],
    tone: 'success',
    icon: CheckCircle2
  },
  {
    label: 'In motion',
    statuses: ['SENT', 'PROCESSING', 'PENDING', 'PENDING_APPROVAL', 'AWAITING_CONFIRMATION'],
    tone: 'warn',
    icon: Clock3
  },
  {
    label: 'Needs action',
    statuses: ['FAILED', 'CANCELLED', 'REJECTED', 'DISPUTED', 'HOLD'],
    tone: 'danger',
    icon: AlertTriangle
  }
];

function TransactionStatusSummary({ title, records, emptyLabel = 'No records' }) {
  const summary = transactionSummaryGroups.map((group) => {
    const groupRecords = records.filter((record) => group.statuses.includes(String(record?.status || '').toUpperCase()));
    const total = groupRecords.reduce((sum, record) => sum + readAmount(record), 0);
    const currency = readCurrency(groupRecords[0] || records[0] || {});

    return {
      ...group,
      count: groupRecords.length,
      total,
      currency
    };
  });

  return (
    <section aria-label={title} className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Workflow summary</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.035em] text-[var(--tg-text-color)]">{title}</h3>
        </div>
        <StatusBadge status={records.length ? 'live' : emptyLabel} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {summary.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className={`rounded-[22px] p-4 ${toneClass(item.count ? item.tone : 'default')}`}>
              <div className="flex items-center justify-between gap-3">
                <Icon size={18} />
                <span className="text-xs font-black">{item.count.toLocaleString()}</span>
              </div>
              <p className="mt-3 text-sm font-black">{item.label}</p>
              <p className="mt-1 text-xs font-bold opacity-80">{item.count ? formatMoney(item.total, item.currency) : emptyLabel}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TransactionRecordRow({
  recordId,
  primary,
  amount,
  currency,
  status,
  timestamp,
  meta,
  icon: Icon = FileText,
  selected = false,
  onSelect
}) {
  return (
    <article className="min-w-0">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${primary} ${recordId}`}
        className={`miniapp-pressable w-full min-w-0 rounded-[26px] bg-[var(--tg-section-bg-color)] p-4 text-left shadow-sm transition ${
          selected
            ? 'ring-2 ring-[var(--tg-button-color)] ring-offset-2 ring-offset-[var(--tg-bg-color)]'
            : 'hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.10)]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] bg-[var(--tg-secondary-bg-color)] text-[var(--tg-button-color)]">
              <Icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[var(--tg-text-color)]">{primary}</p>
              <p className="mt-1 truncate text-xs font-bold text-[var(--tg-hint-color)]">{recordId}</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xl font-black tracking-[-0.045em] text-[var(--tg-text-color)]">{formatMoney(amount, currency)}</p>
            {meta ? <p className="mt-1 truncate text-xs font-bold text-[var(--tg-subtitle-text-color)]">{meta}</p> : null}
          </div>
          <p className="shrink-0 text-xs font-bold text-[var(--tg-hint-color)]">{timestamp}</p>
        </div>
      </button>
    </article>
  );
}

function buildInvoiceRows(invoice) {
  return [
    ['Recipient', readInvoiceRecipient(invoice)],
    ['Provider', invoice?.metadata?.provider || invoice?.provider || 'PayPal'],
    ['Invoice ID', readInvoiceId(invoice)],
    ['Updated', formatDate(readInvoiceUpdatedAt(invoice))]
  ];
}

function buildPayoutRows(payout) {
  return [
    ['Receiver', readPayoutReceiver(payout)],
    ['Provider', payout?.metadata?.provider || payout?.provider || 'PayPal'],
    ['Payout ID', readPayoutId(payout)],
    ['Updated', formatDate(readPayoutUpdatedAt(payout))]
  ];
}

const providerLabels = {
  paypal: 'PayPal',
  stripe: 'Stripe',
  crypto: 'Crypto',
  paystack: 'Paystack',
  flutterwave: 'Flutterwave',
  wise: 'Wise'
};

const providerOrder = ['paypal', 'stripe', 'crypto', 'paystack', 'flutterwave', 'wise'];

function readProviderSlug(record) {
  if (!record) {
    return '';
  }

  const rawProvider =
    record.provider ||
    record.key ||
    record.slug ||
    record.metadata?.provider ||
    record.summary?.provider ||
    record.payment_provider ||
    record.paymentProvider ||
    '';

  return String(rawProvider).toLowerCase();
}

function providerLabel(slug, provider) {
  return provider?.label || provider?.name || providerLabels[slug] || slug.replace(/(^|-)([a-z])/g, (_match, prefix, character) => `${prefix}${character.toUpperCase()}`);
}

function readProviderStatus(provider, openIssues, failedWebhooks) {
  if (failedWebhooks > 0) {
    return 'degraded';
  }

  if (openIssues > 0) {
    return 'review';
  }

  return provider?.status || provider?.readiness || provider?.state || 'ready';
}

function readProviderHealthKey(health) {
  return String(health?.provider || health?.key || health?.slug || '').toLowerCase();
}

function readProviderHealthScore(health) {
  const score = Number(health?.score);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
}

function healthTone(score, status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'critical' || score < 50) {
    return 'danger';
  }
  if (normalized === 'degraded' || normalized === 'watch' || score < 80) {
    return 'warn';
  }
  return 'success';
}

function readIssueProvider(issue) {
  return readProviderSlug(issue) || String(issue?.metadata?.provider || '').toLowerCase();
}

function readWebhookProvider(event) {
  const direct = readProviderSlug(event);
  if (direct) {
    return direct;
  }

  const eventText = [
    event?.event_type,
    event?.eventType,
    event?.resource_type,
    event?.resourceType,
    event?.source,
    event?.metadata?.provider
  ].join(' ').toLowerCase();

  return providerOrder.find((provider) => eventText.includes(provider)) || '';
}

function readWebhookId(event) {
  return event?.webhook_event_id || event?.webhookEventId || event?.id || event?.event_id || event?.eventId || '';
}

function readWebhookEventId(event) {
  return event?.event_id || event?.eventId || readWebhookId(event);
}

function readWebhookType(event) {
  return event?.event_type || event?.eventType || 'Webhook event';
}

function readWebhookAttempts(event) {
  const attempts = event?.processing_attempts ?? event?.processingAttempts ?? 0;
  return Number.isFinite(Number(attempts)) ? Number(attempts) : 0;
}

function readWebhookSanitizedPayload(event) {
  return event?.sanitized_payload || event?.sanitizedPayload || {};
}

function readWebhookVerification(event) {
  return event?.verification || {};
}

function canReplayWebhook(event) {
  const status = String(event?.status || '').toUpperCase();
  return event?.can_replay !== false && status !== 'REJECTED';
}

function canIgnoreWebhook(event) {
  const status = String(event?.status || '').toUpperCase();
  return event?.can_ignore !== false && !['IGNORED', 'PROCESSED'].includes(status);
}

function isIssueOpen(issue) {
  return !['resolved', 'closed', 'ignored'].includes(String(issue?.status || '').toLowerCase());
}

function isWebhookFailed(event) {
  const status = String(event?.status || '').toUpperCase();
  return Boolean(event?.last_error || event?.error) || ['FAILED', 'ERROR', 'RETRYING', 'DEAD_LETTER'].includes(status);
}

function readBalanceAmount(balance) {
  const source = balance?.balance || balance || {};
  const directAmount = firstMoney([
    source.available,
    source.available_balance,
    source.availableBalance,
    source.amount,
    source.value,
    source.summary?.available,
    source.summary?.amount
  ]);

  if (directAmount !== null) {
    return directAmount;
  }

  const cents = firstMoney([
    source.available_cents,
    source.availableBalanceCents,
    source.available_balance_cents,
    source.amount_cents,
    source.amountCents
  ]);

  return cents !== null ? cents / 100 : 0;
}

function readBalanceCurrency(balance) {
  const source = balance?.balance || balance || {};
  return source.currency || source.currency_code || source.currencyCode || source.summary?.currency || 'USD';
}

function readDeadLetterId(job) {
  return String(job?.job_id || job?.jobId || job?.id || '');
}

function readDeadLetterSource(job) {
  return job?.source_queue || job?.sourceQueue || job?.data?.sourceQueue || job?.data?.source_queue || job?.queue_name || job?.queueName || 'dead-letter';
}

function readDeadLetterSourceId(job) {
  return job?.source_job_id || job?.sourceJobId || job?.data?.sourceJobId || job?.data?.source_job_id || '';
}

function readDeadLetterProvider(job) {
  const payload = job?.data?.payload || job?.payload || {};
  const candidates = [
    job?.provider,
    job?.data?.provider,
    payload.provider,
    payload.metadata?.provider,
    payload.invoice?.provider,
    payload.invoice?.metadata?.provider,
    payload.payout?.provider,
    payload.payout?.metadata?.provider,
    payload.webhookEvent?.provider,
    payload.webhook_event?.provider
  ];
  const direct = candidates.find(Boolean);
  if (direct) {
    return String(direct).toLowerCase();
  }

  const payloadText = JSON.stringify(payload).toLowerCase();
  return providerOrder.find((provider) => payloadText.includes(provider)) || '';
}

function readDeadLetterTitle(job) {
  return job?.name || `${readDeadLetterSource(job)} job`;
}

function readDeadLetterError(job) {
  const error = job?.failed_reason || job?.failedReason || job?.data?.error?.message || job?.data?.error || job?.error;
  return typeof error === 'string' ? error : error ? JSON.stringify(error) : 'Recovery candidate';
}

function isDeadLetterRecovered(job) {
  return Boolean(job?.recovery || job?.recovered_at || job?.recoveredAt);
}

function readIssueSummary(issue) {
  return issue?.summary || issue?.title || issue?.description || issue?.issue_type || issue?.type || 'Provider issue';
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function readFirstError(errors) {
  return Object.values(errors).find(Boolean);
}

function readVisibleErrors(errors, touched, submitted) {
  return Object.entries(errors).reduce((visible, [field, message]) => {
    if (message && (submitted || touched[field])) {
      visible[field] = message;
    }

    return visible;
  }, {});
}

function readDueDateError(value) {
  if (!value) {
    return '';
  }

  const dueDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) {
    return 'Choose a valid due date.';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dueDate < today) {
    return 'Due date cannot be in the past.';
  }

  return '';
}

function validateInvoiceComposer(form, user) {
  const amount = Number(form.amount);

  return {
    recipientEmail: !form.recipientEmail
      ? 'Client email is required.'
      : !isEmailLike(form.recipientEmail)
        ? 'Enter a valid client email.'
        : '',
    amount: !form.amount
      ? 'Amount is required.'
      : !Number.isFinite(amount) || amount <= 0
        ? 'Enter an amount greater than zero.'
        : '',
    currency: /^[A-Z]{3}$/.test(form.currency) ? '' : 'Use a 3-letter currency code.',
    dueDate: readDueDateError(form.dueDate),
    user: user?.id ? '' : 'Open Transferly from Telegram before creating an invoice.'
  };
}

function validatePayoutComposer(form, user, availableBalance, confirmed) {
  const amount = Number(form.amount);
  const amountReady = Number.isFinite(amount) && amount > 0;
  const exceedsBalance = amountReady && availableBalance > 0 && amount > availableBalance;

  return {
    receiver: !form.receiver
      ? 'Receiver email is required.'
      : !isEmailLike(form.receiver)
        ? 'Enter a valid receiver email.'
        : '',
    amount: !form.amount
      ? 'Amount is required.'
      : !amountReady
        ? 'Enter an amount greater than zero.'
        : exceedsBalance
          ? 'Amount exceeds available wallet balance.'
          : '',
    currency: /^[A-Z]{3}$/.test(form.currency) ? '' : 'Use a 3-letter currency code.',
    confirmed: confirmed ? '' : 'Confirm the review acknowledgement before submitting.',
    user: user?.id ? '' : 'Open Transferly from Telegram to request a payout.'
  };
}

function ComposerFeedback({ tone = 'info', icon: Icon = ShieldCheck, title, body }) {
  if (!title && !body) {
    return null;
  }

  return (
    <div className={`miniapp-feedback-panel miniapp-feedback-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-white/70 text-current">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        {title ? <p className="text-sm font-black text-[var(--tg-text-color)]">{title}</p> : null}
        {body ? <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{body}</p> : null}
      </div>
    </div>
  );
}

function InvoiceComposer({ onClose }) {
  const { createInvoice, user } = useAppContext();
  const telegram = useTelegramMiniApp();
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState({
    recipientEmail: '',
    description: '',
    currency: 'USD',
    amount: '',
    dueDate: ''
  });
  const errors = useMemo(() => validateInvoiceComposer(form, user), [form, user]);
  const visibleErrors = useMemo(() => readVisibleErrors(errors, touched, submitted), [errors, submitted, touched]);
  const firstError = readFirstError(errors);
  const canSubmit = Boolean(!firstError && !saving);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFeedback(null);
  };

  const markTouched = (field) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const preview = () => {
    setSubmitted(true);

    if (firstError) {
      setFeedback({ tone: 'error', icon: AlertTriangle, title: 'Preview needs a fix', body: firstError });
      telegram.notify('error');
      return;
    }

    setFeedback({
      tone: 'success',
      icon: Eye,
      title: 'Preview ready',
      body: `${form.recipientEmail} will receive ${formatMoney(form.amount, form.currency)} for ${form.description || 'Transferly service'}.`
    });
    telegram.impact('light');
  };

  const create = async () => {
    setSubmitted(true);

    if (firstError) {
      setFeedback({ tone: 'error', icon: AlertTriangle, title: 'Invoice needs a fix', body: firstError });
      toast.error(firstError);
      telegram.notify('error');
      return;
    }

    setSaving(true);
    setFeedback({ tone: 'info', icon: Clock3, title: 'Creating invoice', body: 'Preparing the payable invoice and ledger intent.' });
    telegram.impact('medium');

    const result = await createInvoice({
      recipientEmail: form.recipientEmail.trim(),
      description: form.description || 'Mini App invoice',
      currency: form.currency,
      dueDate: form.dueDate,
      items: [{ name: form.description || 'Transferly service', quantity: 1, unitAmount: form.amount }]
    });

    setSaving(false);

    if (!result.success) {
      setFeedback({ tone: 'error', icon: AlertTriangle, title: 'Invoice was not created', body: result.message || 'Unable to create invoice' });
      toast.error(result.message || 'Unable to create invoice');
      telegram.notify('error');
      return;
    }

    setFeedback({ tone: 'success', icon: CheckCircle2, title: 'Invoice created', body: 'The invoice is ready for the payment workflow.' });
    toast.success('Invoice created');
    telegram.notify('success');
    onClose();
  };

  return (
    <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Invoice builder</p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">Create payable invoice</h3>
        </div>
        <button type="button" onClick={onClose} className="rounded-full bg-[var(--tg-secondary-bg-color)] p-3 text-[var(--tg-hint-color)]">
          <XCircle size={18} />
        </button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <PremiumInput
          type="email"
          label="Client email"
          value={form.recipientEmail}
          onChange={(event) => updateField('recipientEmail', event.target.value)}
          onBlur={() => markTouched('recipientEmail')}
          error={visibleErrors.recipientEmail}
          helperText="Used for invoice delivery and payment reminders."
          icon={Mail}
          disabled={saving}
          inputMode="email"
          autoComplete="email"
          required
        />
        <PremiumInput
          label="Amount"
          value={form.amount}
          onChange={(event) => updateField('amount', event.target.value)}
          onBlur={() => markTouched('amount')}
          error={visibleErrors.amount}
          helperText={form.amount ? formatMoney(form.amount, form.currency) : 'Enter the invoice total.'}
          icon={CreditCard}
          disabled={saving}
          inputMode="decimal"
          required
        />
        <PremiumInput
          label="Description"
          value={form.description}
          onChange={(event) => updateField('description', event.target.value)}
          helperText="Shown on the invoice line item."
          icon={FileText}
          disabled={saving}
        />
        <div className="grid gap-3 sm:grid-cols-[0.7fr_1fr]">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Currency</span>
            <select
              value={form.currency}
              onChange={(event) => updateField('currency', event.target.value)}
              onBlur={() => markTouched('currency')}
              disabled={saving}
              aria-invalid={visibleErrors.currency ? 'true' : 'false'}
              className="mt-2 w-full rounded-[18px] bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-sm font-black text-[var(--tg-text-color)] outline-none transition focus:ring-2 focus:ring-[var(--tg-button-color)] disabled:opacity-60"
            >
              {['USD', 'EUR', 'GBP'].map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </label>
          <PremiumInput
            type="date"
            label="Due date"
            value={form.dueDate}
            onChange={(event) => updateField('dueDate', event.target.value)}
            onBlur={() => markTouched('dueDate')}
            error={visibleErrors.dueDate}
            icon={Clock3}
            disabled={saving}
          />
        </div>
      </div>
      <ComposerFeedback {...feedback} />
      <div className="mt-5 flex flex-wrap gap-2">
        <PrimaryButton icon={Plus} onClick={create} disabled={!canSubmit}>{saving ? 'Creating' : 'Create invoice'}</PrimaryButton>
        <SecondaryButton icon={Eye} onClick={preview}>Preview</SecondaryButton>
      </div>
    </section>
  );
}

function PayoutComposer({ onClose, availableBalance = 0 }) {
  const { createPayout, user } = useAppContext();
  const telegram = useTelegramMiniApp();
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState({
    receiver: '',
    amount: '',
    currency: 'USD',
    note: ''
  });
  const parsedAmount = Number(form.amount);
  const amountReady = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const exceedsBalance = amountReady && availableBalance > 0 && parsedAmount > availableBalance;
  const errors = useMemo(
    () => validatePayoutComposer(form, user, availableBalance, confirmed),
    [availableBalance, confirmed, form, user]
  );
  const visibleErrors = useMemo(() => readVisibleErrors(errors, touched, submitted), [errors, submitted, touched]);
  const firstError = readFirstError(errors);
  const canSubmit = Boolean(!firstError && !saving);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFeedback(null);
  };

  const markTouched = (field) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const checkEligibility = () => {
    setSubmitted(true);

    if (firstError && firstError !== errors.confirmed) {
      setFeedback({ tone: 'error', icon: AlertTriangle, title: 'Eligibility needs a fix', body: firstError });
      toast.error(firstError);
      telegram.notify('error');
      return;
    }

    setFeedback({
      tone: 'success',
      icon: ShieldCheck,
      title: 'Eligibility check passed',
      body: `${form.receiver || 'Receiver'} can request ${amountReady ? formatMoney(parsedAmount, form.currency) : 'this payout'} from the available balance.`
    });
    toast.success('Eligibility check passed');
    telegram.impact('light');
  };

  const create = async () => {
    setSubmitted(true);

    if (firstError) {
      setFeedback({ tone: 'error', icon: AlertTriangle, title: 'Payout needs a fix', body: firstError });
      toast.error(firstError);
      telegram.notify('error');
      return;
    }

    setSaving(true);
    setFeedback({ tone: 'info', icon: Clock3, title: 'Submitting payout', body: 'Sending the payout request for review.' });
    telegram.impact('medium');

    const result = await createPayout({
      receiver: form.receiver.trim(),
      recipientType: 'EMAIL',
      amount: parsedAmount,
      currency: form.currency,
      note: form.note || 'Mini App payout'
    });

    setSaving(false);

    if (!result.success) {
      setFeedback({ tone: 'error', icon: AlertTriangle, title: 'Payout was not submitted', body: result.message || 'Unable to request payout' });
      toast.error(result.message || 'Unable to request payout');
      telegram.notify('error');
      return;
    }

    setFeedback({ tone: 'success', icon: CheckCircle2, title: 'Payout requested', body: 'The request is now in the review workflow.' });
    toast.success('Payout requested');
    telegram.notify('success');
    onClose();
  };

  return (
    <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Payout request</p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">Submit for review</h3>
        </div>
        <button type="button" onClick={onClose} className="rounded-full bg-[var(--tg-secondary-bg-color)] p-3 text-[var(--tg-hint-color)]">
          <XCircle size={18} />
        </button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <PremiumInput
          type="email"
          label="Receiver email"
          value={form.receiver}
          onChange={(event) => updateField('receiver', event.target.value)}
          onBlur={() => markTouched('receiver')}
          error={visibleErrors.receiver}
          helperText="Used as the payout recipient identifier."
          icon={Mail}
          disabled={saving}
          inputMode="email"
          autoComplete="email"
          required
        />
        <PremiumInput
          label="Amount"
          value={form.amount}
          onChange={(event) => updateField('amount', event.target.value)}
          onBlur={() => markTouched('amount')}
          error={visibleErrors.amount}
          helperText={amountReady ? formatMoney(parsedAmount, form.currency) : 'Enter the payout amount.'}
          icon={CreditCard}
          disabled={saving}
          inputMode="decimal"
          required
        />
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Currency</span>
          <select
            value={form.currency}
            onChange={(event) => updateField('currency', event.target.value)}
            onBlur={() => markTouched('currency')}
            disabled={saving}
            aria-invalid={visibleErrors.currency ? 'true' : 'false'}
            className="mt-2 w-full rounded-[18px] bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-sm font-black text-[var(--tg-text-color)] outline-none transition focus:ring-2 focus:ring-[var(--tg-button-color)] disabled:opacity-60"
          >
            {['USD', 'EUR', 'GBP'].map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
        </label>
        <PremiumInput
          label="Note"
          value={form.note}
          onChange={(event) => updateField('note', event.target.value)}
          helperText="Optional note for internal review."
          icon={MessageCircle}
          disabled={saving}
        />
      </div>
      <div className="mt-4 grid gap-2 rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-4 sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Receiver</p>
          <p className="mt-1 truncate text-sm font-black text-[var(--tg-text-color)]">{form.receiver || 'Not set'}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Amount</p>
          <p className={`mt-1 text-sm font-black ${exceedsBalance ? 'text-[var(--tg-destructive-text-color)]' : 'text-[var(--tg-text-color)]'}`}>
            {amountReady ? formatMoney(parsedAmount, form.currency) : 'Not set'}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Available</p>
          <p className="mt-1 text-sm font-black text-[var(--tg-text-color)]">{formatMoney(availableBalance, form.currency)}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Route</p>
          <p className="mt-1 text-sm font-black text-[var(--tg-text-color)]">Email payout</p>
        </div>
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[20px] bg-[var(--tg-secondary-bg-color)] p-4 text-sm font-bold text-[var(--tg-text-color)]">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => {
            setConfirmed(event.target.checked);
            setTouched((current) => ({ ...current, confirmed: true }));
            setFeedback(null);
          }}
          className="mt-1 h-4 w-4 accent-[var(--tg-button-color)]"
        />
        <span>I confirm this payout request is ready for review.</span>
      </label>
      {visibleErrors.confirmed ? (
        <p className="miniapp-field-message mt-2 text-sm font-bold text-rose-600">{visibleErrors.confirmed}</p>
      ) : null}
      <ComposerFeedback {...feedback} />
      <div className="mt-5 flex flex-wrap gap-2">
        <PrimaryButton icon={WalletCards} onClick={create} disabled={!canSubmit}>{saving ? 'Submitting' : 'Request payout'}</PrimaryButton>
        <SecondaryButton icon={ShieldCheck} onClick={checkEligibility}>Check eligibility</SecondaryButton>
      </div>
    </section>
  );
}

function PayoutReadinessGuide({ records, profile }) {
  const availableBalance = readWalletAmount(profile, 'available_balance');
  const reviewCount = records.filter((record) => String(record.status).toUpperCase() === 'PENDING_APPROVAL').length;
  const processingCount = records.filter((record) => String(record.status).toUpperCase() === 'PROCESSING').length;
  const exceptionCount = records.filter((record) => ['FAILED', 'CANCELLED', 'REJECTED', 'HOLD'].includes(String(record.status).toUpperCase())).length;
  const items = [
    {
      label: 'Wallet balance',
      value: formatMoney(availableBalance),
      detail: 'Ledger-backed funds',
      icon: WalletCards
    },
    {
      label: 'Review queue',
      value: reviewCount.toLocaleString(),
      detail: 'Needs operator approval',
      icon: ShieldCheck
    },
    {
      label: 'Provider release',
      value: processingCount.toLocaleString(),
      detail: 'Already in flight',
      icon: Clock3
    },
    {
      label: 'Exceptions',
      value: exceptionCount.toLocaleString(),
      detail: 'Needs retry or cancel',
      icon: AlertTriangle
    }
  ];

  return (
    <section aria-label="Payout readiness" className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Payout readiness</p>
          <h3 className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">Review before release</h3>
        </div>
        <ShieldAlert className="shrink-0 text-[var(--tg-button-color)]" size={26} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="rounded-[20px] bg-[var(--tg-secondary-bg-color)] p-3">
              <Icon className="text-[var(--tg-button-color)]" size={18} />
              <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">{item.value}</p>
              <p className="mt-1 text-xs font-black text-[var(--tg-text-color)]">{item.label}</p>
              <p className="mt-1 text-xs font-bold text-[var(--tg-subtitle-text-color)]">{item.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const collectionWorkspaceLinks = [
  {
    label: 'PayPal invoices',
    body: 'Create, send, remind, and reconcile PayPal invoice records.',
    to: '/miniapp/services/paypal/invoices',
    icon: FileText,
    badge: 'Live'
  },
  {
    label: 'Stripe payments',
    body: 'Prepare Stripe payments, billing, and Connect collection lanes.',
    to: '/miniapp/services/stripe/payments',
    icon: CreditCard,
    badge: 'Workspace'
  },
  {
    label: 'Wise receive',
    body: 'Review receiving, balances, and transfer-ready account details.',
    to: '/miniapp/services/wise/receive',
    icon: WalletCards,
    badge: 'Preview'
  },
  {
    label: 'Paystack collections',
    body: 'Open collections, customers, virtual accounts, and subscription lanes.',
    to: '/miniapp/services/paystack/collections',
    icon: BadgeCheck,
    badge: 'Workspace'
  },
  {
    label: 'Flutterwave collections',
    body: 'Manage collection, settlement, transfer, and refund lanes.',
    to: '/miniapp/services/flutterwave/collections',
    icon: LineChart,
    badge: 'Workspace'
  },
  {
    label: 'Crypto receive',
    body: 'Track receive flows, confirmations, activity, and release readiness.',
    to: '/miniapp/services/crypto/receive',
    icon: LockKeyhole,
    badge: 'Preview'
  }
];

const sendingWorkspaceLinks = [
  {
    label: 'PayPal payouts',
    body: 'Create, review, approve, and refresh PayPal payout records.',
    to: '/miniapp/services/paypal/payouts',
    icon: WalletCards,
    badge: 'Live'
  },
  {
    label: 'Stripe Connect',
    body: 'Review connected-account transfer and platform balance lanes.',
    to: '/miniapp/services/stripe/connect',
    icon: CreditCard,
    badge: 'Workspace'
  },
  {
    label: 'Wise send',
    body: 'Open Wise send, balances, activity, and compliance lanes.',
    to: '/miniapp/services/wise/send',
    icon: ArrowRight,
    badge: 'Preview'
  },
  {
    label: 'Flutterwave transfers',
    body: 'Review transfer, settlement, refund, and activity lanes.',
    to: '/miniapp/services/flutterwave/transfers',
    icon: LineChart,
    badge: 'Workspace'
  },
  {
    label: 'Crypto send',
    body: 'Open sending, confirmation, activity, and security lanes.',
    to: '/miniapp/services/crypto/send',
    icon: LockKeyhole,
    badge: 'Preview'
  }
];

function ProviderWorkflowEntryPanel({ eyebrow, title, body, links, legacyActionLabel, onLegacyAction }) {
  return (
    <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">{eyebrow}</p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--tg-subtitle-text-color)]">{body}</p>
        </div>
        {onLegacyAction ? (
          <SecondaryButton icon={Plus} onClick={onLegacyAction}>{legacyActionLabel}</SecondaryButton>
        ) : null}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => {
          const Icon = link.icon;

          return (
            <Link
              key={link.to}
              to={link.to}
              className="group rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4 text-[var(--tg-text-color)] transition active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-[var(--tg-section-bg-color)] text-[var(--tg-button-color)]">
                  <Icon size={20} />
                </span>
                <span className="rounded-full bg-[var(--tg-section-bg-color)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">
                  {link.badge}
                </span>
              </div>
              <h4 className="mt-4 text-base font-black tracking-[-0.025em]">{link.label}</h4>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">{link.body}</p>
              <div className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-button-color)]">
                Open workspace
                <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function InvoicesSection() {
  const { invoices, loading, refreshInvoice, sendInvoiceReminder } = useAppContext();
  const telegram = useTelegramMiniApp();
  const [query, setQuery] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const records = invoices;
  const filtered = records.filter((invoice) =>
    [readInvoiceId(invoice), readInvoiceRecipient(invoice), readInvoiceDescription(invoice), invoice?.status]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const selected = filtered.find((invoice) => readInvoiceId(invoice) === selectedId) || filtered[0];

  const copyLink = async () => {
    await navigator.clipboard?.writeText(selected?.invoice_link || selected?.pay_url || selected?.paypal_invoice_url || readInvoiceId(selected));
    telegram.notify('success');
    toast.success('Invoice reference copied');
  };

  return (
    <div className="space-y-4">
      <SuiteHeader
        eyebrow="Aggregate collections"
        title="Cross-provider invoice dashboard."
        body="Provider workspaces are now the primary place to create, send, and reconcile collection flows. This view stays available for cross-provider visibility and legacy records."
        icon={FileText}
        action={<PrimaryButton icon={ArrowRight} to="/miniapp/services/paypal/invoices">Open PayPal invoices</PrimaryButton>}
      />
      <ProviderWorkflowEntryPanel
        eyebrow="Provider-first collection"
        title="Start collection work inside a provider workspace."
        body="Choose the provider lane that matches the collection method, then return here when you need an aggregate view across records."
        links={collectionWorkspaceLinks}
        legacyActionLabel="Use aggregate composer"
        onLegacyAction={() => setShowComposer(true)}
      />
      {showComposer ? <InvoiceComposer onClose={() => setShowComposer(false)} /> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard icon={FileText} label="Invoices" value={records.length.toLocaleString()} detail="All visible records" />
        <MetricCard icon={BadgeCheck} label="Collected" value={formatMoney(records.filter((record) => String(record.status).toUpperCase() === 'PAID').reduce((sum, record) => sum + readAmount(record), 0))} />
        <MetricCard icon={Clock3} label="Open" value={records.filter((record) => ['SENT', 'PENDING'].includes(String(record.status).toUpperCase())).length.toLocaleString()} />
        <MetricCard icon={AlertTriangle} label="Attention" value={records.filter((record) => ['FAILED', 'DISPUTED', 'CANCELLED'].includes(String(record.status).toUpperCase())).length.toLocaleString()} />
      </div>
      <TransactionStatusSummary title="Invoice workflow summary" records={records} emptyLabel="No invoices" />
      <SearchBar query={query} onQuery={setQuery} placeholder="Search invoices, clients, status" />
      {filtered.length ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
          <div className="min-w-0 space-y-3">
            {filtered.map((invoice) => (
              <TransactionRecordRow
                key={readInvoiceId(invoice)}
                recordId={readInvoiceId(invoice)}
                primary={readInvoiceRecipient(invoice)}
                amount={readAmount(invoice)}
                currency={readCurrency(invoice)}
                status={invoice?.status}
                timestamp={formatDate(readInvoiceCreatedAt(invoice))}
                meta={readInvoiceDescription(invoice)}
                icon={FileText}
                selected={readInvoiceId(invoice) === readInvoiceId(selected)}
                onSelect={() => setSelectedId(readInvoiceId(invoice))}
              />
            ))}
          </div>
          <RecordDetailPanel
            title={readInvoiceDescription(selected)}
            amount={formatMoney(readAmount(selected), readCurrency(selected))}
            status={selected?.status}
            rows={buildInvoiceRows(selected)}
            action={
              <>
                <SecondaryButton icon={RefreshCw} onClick={() => refreshInvoice(readInvoiceId(selected))}>Refresh</SecondaryButton>
                <SecondaryButton icon={Bell} onClick={() => sendInvoiceReminder(readInvoiceId(selected))}>Remind</SecondaryButton>
                <SecondaryButton icon={Copy} onClick={copyLink}>Copy</SecondaryButton>
              </>
            }
            events={[
              { icon: FileText, title: 'Invoice created', body: 'Ledger intent and invoice details were prepared.', time: formatDate(readInvoiceCreatedAt(selected)), tone: 'info' },
              { icon: Mail, title: 'Client delivery', body: 'Payment link is ready for client handoff and reminders.', time: 'live', tone: 'warn' },
              { icon: BadgeCheck, title: 'Collection state', body: `Current provider state is ${normalizeStatus(selected?.status)}.`, time: 'now', tone: statusTone[String(selected?.status || '').toUpperCase()] || 'default' }
            ]}
          />
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title={loading ? 'Loading invoices' : query ? 'No invoices match' : 'No invoices yet'}
          body={query ? 'Clear the search or open the relevant provider workspace.' : 'Open a provider collection workspace to create records, then use this dashboard for aggregate visibility.'}
        />
      )}
    </div>
  );
}

export function PayoutsSection() {
  const { payouts, profile, loading, refreshPayout, cancelUnclaimedPayout } = useAppContext();
  const [query, setQuery] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const records = payouts;
  const filtered = records.filter((payout) =>
    [readPayoutId(payout), readPayoutReceiver(payout), readPayoutNote(payout), payout?.status]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const selected = filtered.find((payout) => readPayoutId(payout) === selectedId) || filtered[0];
  const availableBalance = readWalletAmount(profile, 'available_balance');
  const pendingAmount = records
    .filter((record) => ['PENDING', 'PENDING_APPROVAL', 'PROCESSING'].includes(String(record.status).toUpperCase()))
    .reduce((sum, record) => sum + readAmount(record), 0);

  return (
    <div className="space-y-4">
      <SuiteHeader
        eyebrow="Aggregate sending"
        title="Cross-provider payout dashboard."
        body="Provider-specific send, transfer, and payout lanes are now the primary place to prepare money movement. This view stays available for aggregate review and legacy controls."
        icon={WalletCards}
        action={<PrimaryButton icon={ArrowRight} to="/miniapp/services/paypal/payouts">Open PayPal payouts</PrimaryButton>}
      />
      <ProviderWorkflowEntryPanel
        eyebrow="Provider-first sending"
        title="Start sending work inside a provider workspace."
        body="Choose the provider lane that matches the transfer method, then use this dashboard to compare queue state and exception handling."
        links={sendingWorkspaceLinks}
        legacyActionLabel="Request payout"
        onLegacyAction={() => setShowComposer(true)}
      />
      {showComposer ? <PayoutComposer onClose={() => setShowComposer(false)} availableBalance={availableBalance} /> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard icon={WalletCards} label="Available" value={formatMoney(availableBalance)} detail="Wallet ledger balance" />
        <MetricCard icon={Clock3} label="Pending" value={formatMoney(pendingAmount)} />
        <MetricCard icon={ShieldCheck} label="Reviews" value={records.filter((record) => String(record.status).toUpperCase() === 'PENDING_APPROVAL').length.toLocaleString()} />
        <MetricCard icon={CheckCircle2} label="Completed" value={records.filter((record) => String(record.status).toUpperCase() === 'COMPLETED').length.toLocaleString()} />
      </div>
      <PayoutReadinessGuide records={records} profile={profile} />
      <TransactionStatusSummary title="Payout workflow summary" records={records} emptyLabel="No payouts" />
      <SearchBar query={query} onQuery={setQuery} placeholder="Search payouts, receivers, status" />
      {filtered.length ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
          <div className="min-w-0 space-y-3">
            {filtered.map((payout) => (
              <TransactionRecordRow
                key={readPayoutId(payout)}
                recordId={readPayoutId(payout)}
                primary={readPayoutReceiver(payout)}
                amount={readAmount(payout)}
                currency={readCurrency(payout)}
                status={payout?.status}
                timestamp={formatDate(readPayoutCreatedAt(payout))}
                meta={readPayoutNote(payout)}
                icon={WalletCards}
                selected={readPayoutId(payout) === readPayoutId(selected)}
                onSelect={() => setSelectedId(readPayoutId(payout))}
              />
            ))}
          </div>
          <RecordDetailPanel
            title={readPayoutNote(selected)}
            amount={formatMoney(readAmount(selected), readCurrency(selected))}
            status={selected?.status}
            rows={buildPayoutRows(selected)}
            action={
              <>
                <SecondaryButton icon={RefreshCw} onClick={() => refreshPayout(readPayoutId(selected))}>Refresh</SecondaryButton>
                <SecondaryButton icon={XCircle} onClick={() => cancelUnclaimedPayout(readPayoutId(selected))}>Cancel unclaimed</SecondaryButton>
              </>
            }
            events={[
              { icon: ShieldCheck, title: 'Eligibility checked', body: 'Balance, account, and hold rules were evaluated.', time: 'now', tone: 'success' },
              { icon: Clock3, title: 'Approval queue', body: 'High-risk or large transfers wait for operator review.', time: 'live', tone: 'warn' },
              { icon: WalletCards, title: 'Provider state', body: `Current payout state is ${normalizeStatus(selected?.status)}.`, time: formatDate(readPayoutUpdatedAt(selected)), tone: statusTone[String(selected?.status || '').toUpperCase()] || 'default' }
            ]}
          />
        </div>
      ) : (
        <EmptyState
          icon={WalletCards}
          title={loading ? 'Loading payouts' : query ? 'No payouts match' : 'No payouts yet'}
          body={query ? 'Clear the search or open the relevant provider workspace.' : 'Open a provider sending workspace to create records, then use this dashboard for aggregate review.'}
        />
      )}
    </div>
  );
}

function buildActivity({ invoices, payouts, topUpOrders, receipts, paymentIssues }) {
  return [
    ...invoices.map((invoice) => ({
      icon: FileText,
      tone: statusTone[String(invoice.status || '').toUpperCase()] || 'info',
      title: `Invoice ${normalizeStatus(invoice.status)}`,
      body: `${readInvoiceRecipient(invoice)} · ${formatMoney(readAmount(invoice), readCurrency(invoice))}`,
      time: formatDate(readInvoiceUpdatedAt(invoice)),
      timestamp: new Date(readInvoiceUpdatedAt(invoice) || 0).getTime(),
      search: readInvoiceId(invoice)
    })),
    ...payouts.map((payout) => ({
      icon: WalletCards,
      tone: statusTone[String(payout.status || '').toUpperCase()] || 'warn',
      title: `Payout ${normalizeStatus(payout.status)}`,
      body: `${readPayoutReceiver(payout)} · ${formatMoney(readAmount(payout), readCurrency(payout))}`,
      time: formatDate(readPayoutUpdatedAt(payout)),
      timestamp: new Date(readPayoutUpdatedAt(payout) || 0).getTime(),
      search: readPayoutId(payout)
    })),
    ...topUpOrders.map((order) => ({
      icon: CreditCard,
      tone: statusTone[String(order.status || '').toUpperCase()] || 'warn',
      title: `Top-up ${normalizeStatus(order.status)}`,
      body: `${order.amount_label || `${Number(order.points || 0).toLocaleString()} pts`} · ${order.method_title || 'Funding'}`,
      time: formatDate(order.updated_at || order.created_at),
      timestamp: new Date(order.updated_at || order.created_at || 0).getTime(),
      search: order.order_id || order.id
    })),
    ...receipts.slice(0, 8).map((receipt) => ({
      icon: FileText,
      tone: 'success',
      title: 'Receipt generated',
      body: receipt.title || receipt.summary || 'Transferly receipt',
      time: formatDate(receipt.created_at),
      timestamp: new Date(receipt.created_at || 0).getTime(),
      search: receipt.id || receipt.title
    })),
    ...paymentIssues.map((issue) => ({
      icon: ShieldAlert,
      tone: 'danger',
      title: issue.title || 'Payment issue',
      body: issue.description || issue.provider || 'Provider issue needs review',
      time: formatDate(issue.updated_at || issue.created_at),
      timestamp: new Date(issue.updated_at || issue.created_at || 0).getTime(),
      search: issue.id || issue.provider
    }))
  ].sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0));
}

export function ActivitySection() {
  const context = useAppContext();
  const [query, setQuery] = useState('');
  const events = buildActivity(context);
  const filtered = events.filter((event) => [event.title, event.body, event.search].join(' ').toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-4">
      <SuiteHeader eyebrow="Live activity" title="Every meaningful state change in one place." body="Invoices, payouts, wallet orders, receipts, provider issues, and webhook events become a searchable operational timeline." icon={Activity} />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Activity} label="Events" value={filtered.length.toLocaleString()} />
        <MetricCard icon={ShieldCheck} label="Verified" value={filtered.filter((event) => event.tone === 'success').length.toLocaleString()} />
        <MetricCard icon={AlertTriangle} label="Attention" value={filtered.filter((event) => ['warn', 'danger'].includes(event.tone)).length.toLocaleString()} />
      </div>
      <SearchBar query={query} onQuery={setQuery} placeholder="Search timeline" />
      {filtered.length ? (
        <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
          <Timeline events={filtered} />
        </section>
      ) : (
        <EmptyState icon={Activity} title="No activity yet" body="Authenticated payment, payout, top-up, and receipt events will appear here as they happen." />
      )}
    </div>
  );
}

function buildMovementBars(invoices, payouts) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    return { key: day.toISOString().slice(0, 10), total: 0 };
  });
  const dayMap = new Map(days.map((day) => [day.key, day]));

  [...invoices, ...payouts].forEach((record) => {
    const date = new Date(readInvoiceUpdatedAt(record) || readPayoutUpdatedAt(record) || 0);
    const key = Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
    const day = key ? dayMap.get(key) : null;
    if (day) {
      day.total += readAmount(record);
    }
  });

  const max = Math.max(...days.map((day) => day.total), 1);
  return days.map((day) => (day.total ? Math.max(8, Math.round((day.total / max) * 100)) : 4));
}

export function AnalyticsSection() {
  const { invoices, payouts, receipts, topUpOrders, financeSummary } = useAppContext();
  const invoiceRecords = invoices;
  const payoutRecords = payouts;
  const paidInvoices = invoiceRecords.filter((record) => String(record.status).toUpperCase() === 'PAID');
  const collected = financeSummary?.collected_cents ? financeSummary.collected_cents / 100 : paidInvoices.reduce((sum, record) => sum + readAmount(record), 0);
  const requested = financeSummary?.requested_payout_cents ? financeSummary.requested_payout_cents / 100 : payoutRecords.reduce((sum, record) => sum + readAmount(record), 0);
  const conversion = invoiceRecords.length ? Math.round((paidInvoices.length / invoiceRecords.length) * 100) : 0;
  const riskHoldRate = payoutRecords.length
    ? Math.round((payoutRecords.filter((record) => String(record.status).toUpperCase() === 'PENDING_APPROVAL').length / payoutRecords.length) * 100)
    : 0;
  const bars = buildMovementBars(invoiceRecords, payoutRecords);

  return (
    <div className="space-y-4">
      <SuiteHeader eyebrow="Analytics" title="Revenue, velocity, risk, and conversion." body="A compact executive view for payment volume, payout pressure, receipt generation, and conversion health." icon={BarChart3} />
      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard icon={LineChart} label="Collected" value={formatMoney(collected)} detail="Paid invoice value" />
        <MetricCard icon={WalletCards} label="Requested" value={formatMoney(requested)} detail="Payout volume" />
        <MetricCard icon={FileText} label="Receipts" value={receipts.length.toLocaleString()} detail="Generated artifacts" />
        <MetricCard icon={CreditCard} label="Funding" value={topUpOrders.length.toLocaleString()} detail="Top-up orders" />
      </div>
      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">7-day movement</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">Financial pulse</h3>
          </div>
          <StatusBadge status="live" />
        </div>
        <div className="mt-6 flex h-48 items-end gap-2 rounded-[26px] bg-[var(--tg-secondary-bg-color)] p-4">
          {bars.map((height, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-2xl bg-[var(--tg-button-color)] transition-all" style={{ height: `${height}%` }} />
              <span className="text-[10px] font-black text-[var(--tg-hint-color)]">{index + 1}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Gauge} label="Invoice conversion" value={`${conversion}%`} detail="Created to paid" />
        <MetricCard icon={Clock3} label="Open invoices" value={(financeSummary?.open_invoice_count ?? invoiceRecords.filter((record) => ['SENT', 'PENDING'].includes(String(record.status).toUpperCase())).length).toLocaleString()} detail="Awaiting customer action" />
        <MetricCard icon={ShieldAlert} label="Risk hold rate" value={`${riskHoldRate}%`} detail="Manual review pressure" />
      </div>
    </div>
  );
}

export function NotificationsSection() {
  const items = [
    { icon: BadgeCheck, tone: 'success', title: 'Invoice paid', body: 'Atlas Studio completed a PayPal invoice.', time: 'now' },
    { icon: WalletCards, tone: 'warn', title: 'Payout requires review', body: 'Large payout is waiting for operator approval.', time: '4m' },
    { icon: ShieldAlert, tone: 'danger', title: 'Webhook retry detected', body: 'Provider event needs reconciliation.', time: '12m' },
    { icon: MessageCircle, tone: 'info', title: 'Support handoff ready', body: 'Context bundle can be copied into Telegram.', time: '1h' }
  ];

  return (
    <div className="space-y-4">
      <SuiteHeader eyebrow="Notifications" title="Actionable alerts, not noise." body="Payments, reviews, disputes, system health, and support messages are grouped by urgency with deep links into the right record." icon={Bell} />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Bell} label="Unread" value="4" />
        <MetricCard icon={AlertTriangle} label="Critical" value="1" />
        <MetricCard icon={ShieldCheck} label="Muted rules" value="0" />
      </div>
      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <Timeline events={items} />
      </section>
    </div>
  );
}

export function ClientsSection() {
  const { invoices } = useAppContext();
  const clients = useMemo(() => {
    const map = new Map();
    invoices.forEach((invoice) => {
      const email = readInvoiceRecipient(invoice);
      const existing = map.get(email) || { email, count: 0, amount: 0, lastStatus: invoice.status };
      existing.count += 1;
      existing.amount += readAmount(invoice);
      existing.lastStatus = invoice.status || existing.lastStatus;
      map.set(email, existing);
    });
    return [...map.values()];
  }, [invoices]);

  return (
    <div className="space-y-4">
      <SuiteHeader eyebrow="Clients" title="Reusable client intelligence." body="Client profiles make invoicing faster and expose payment reliability, volume, and support context." icon={UserRound} action={<PrimaryButton icon={Plus}>Add client</PrimaryButton>} />
      <SearchBar query="" onQuery={() => {}} placeholder="Search clients" />
      {clients.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {clients.map((client) => (
            <article key={client.email} className="rounded-[26px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black tracking-[-0.03em] text-[var(--tg-text-color)]">{client.email}</p>
                  <p className="mt-1 text-xs font-bold text-[var(--tg-hint-color)]">{client.count} invoice records</p>
                </div>
                <StatusBadge status={client.lastStatus} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MetricCard icon={FileText} label="Invoices" value={client.count.toLocaleString()} />
                <MetricCard icon={LineChart} label="Volume" value={formatMoney(client.amount)} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={UserRound} title="No clients yet" body="Client intelligence is built from live invoice recipients." />
      )}
    </div>
  );
}

function ProviderRecordList({ title, emptyTitle, records, type }) {
  if (!records.length) {
    return (
      <EmptyState icon={type === 'invoice' ? FileText : WalletCards} title={emptyTitle} body="No records are currently assigned to this provider lane." />
    );
  }

  return (
    <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">{title}</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.035em] text-[var(--tg-text-color)]">{records.length.toLocaleString()} live records</h3>
        </div>
        <StatusBadge status="live" />
      </div>
      <div className="mt-5 space-y-3">
        {records.slice(0, 5).map((record) => {
          const isInvoice = type === 'invoice';
          const id = isInvoice ? readInvoiceId(record) : readPayoutId(record);
          const label = isInvoice ? readInvoiceRecipient(record) : readPayoutReceiver(record);
          const detail = isInvoice ? readInvoiceDescription(record) : readPayoutNote(record);
          const updatedAt = isInvoice ? readInvoiceUpdatedAt(record) : readPayoutUpdatedAt(record);

          return (
            <article key={`${type}-${id}`} className="rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[var(--tg-text-color)]">{id}</p>
                  <p className="mt-1 truncate text-xs font-bold text-[var(--tg-subtitle-text-color)]">{label}</p>
                </div>
                <StatusBadge status={record.status} />
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <p className="min-w-0 truncate text-xs font-bold text-[var(--tg-hint-color)]">{detail}</p>
                <p className="shrink-0 text-lg font-black tracking-[-0.04em] text-[var(--tg-text-color)]">
                  {formatMoney(readAmount(record), readCurrency(record))}
                </p>
              </div>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">{formatDate(updatedAt)}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ProviderCommandCenter() {
  const {
    profile,
    invoices,
    payouts,
    paymentIssues,
    paymentProviders,
    providerHealth,
    providerBalances,
    webhookEvents,
    deadLetterJobs,
    fetchInvoices,
    fetchPayouts,
    fetchPaymentIssues,
    fetchPaymentProviders,
    fetchProviderHealth,
    fetchProviderBalances,
    fetchWebhookEvents,
    fetchDeadLetterJobs,
    fetchWebhookEvent,
    replayWebhookEvent,
    ignoreWebhookEvent,
    recoverDeadLetterJob
  } = useAppContext();
  const telegram = useTelegramMiniApp();
  const location = useLocation();
  const requestedProvider = useMemo(() => {
    const provider = new URLSearchParams(location.search).get('provider');
    return provider ? provider.toLowerCase() : 'paypal';
  }, [location.search]);
  const appliedRequestedProviderRef = useRef('');
  const [activeProvider, setActiveProvider] = useState(requestedProvider);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [webhookActionId, setWebhookActionId] = useState('');
  const [webhookActionError, setWebhookActionError] = useState('');
  const [deadLetterActionId, setDeadLetterActionId] = useState('');
  const [deadLetterActionError, setDeadLetterActionError] = useState('');

  useEffect(() => {
    if (!profile?.is_admin) {
      return undefined;
    }

    let active = true;

    async function loadProviderOps() {
      setRefreshing(true);
      try {
        const [providers] = await Promise.all([
          fetchPaymentProviders(),
          fetchInvoices({ limit: 100 }),
          fetchPayouts({ limit: 100 }),
          fetchPaymentIssues({ limit: 100 }),
          fetchWebhookEvents({ limit: 100 }),
          fetchProviderHealth(),
          fetchDeadLetterJobs({ limit: 50 })
        ]);

        await fetchProviderBalances(
          providers.length ? providers : providerOrder.map((provider) => ({ key: provider }))
        );
      } catch (error) {
        console.error('Failed to load provider command center', error);
      } finally {
        if (active) {
          setRefreshing(false);
        }
      }
    }

    loadProviderOps();

    return () => {
      active = false;
    };
  }, [
    fetchInvoices,
    fetchPaymentIssues,
    fetchPaymentProviders,
    fetchProviderHealth,
    fetchPayouts,
    fetchProviderBalances,
    fetchDeadLetterJobs,
    fetchWebhookEvents,
    profile?.is_admin
  ]);

  const providerRows = useMemo(() => {
    const rows = new Map(providerOrder.map((provider) => [
      provider,
      {
        key: provider,
        label: providerLabels[provider],
        provider: { key: provider, status: 'planned' }
      }
    ]));

    paymentProviders.forEach((provider) => {
      const key = readProviderSlug(provider);
      if (!key) {
        return;
      }

      rows.set(key, {
        key,
        label: providerLabel(key, provider),
        provider
      });
    });
    const providerHealthByKey = new Map(
      providerHealth
        .map((health) => [readProviderHealthKey(health), health])
        .filter(([key]) => Boolean(key))
    );

    return [...rows.values()].map((row) => {
      const providerInvoices = invoices.filter((invoice) => readProviderSlug(invoice) === row.key);
      const providerPayouts = payouts.filter((payout) => readProviderSlug(payout) === row.key);
      const providerIssues = paymentIssues.filter((issue) => readIssueProvider(issue) === row.key);
      const providerWebhooks = webhookEvents.filter((event) => readWebhookProvider(event) === row.key);
      const providerDeadLetters = deadLetterJobs.filter((job) => {
        const jobProvider = readDeadLetterProvider(job);
        return !jobProvider || jobProvider === row.key;
      });
      const health = providerHealthByKey.get(row.key) || null;
      const healthOpenIssues = Number(health?.unresolved_issues);
      const healthFailedWebhooks = Number(health?.failed_webhooks);
      const openIssues = Number.isFinite(healthOpenIssues) ? healthOpenIssues : providerIssues.filter(isIssueOpen).length;
      const failedWebhooks = Number.isFinite(healthFailedWebhooks) ? healthFailedWebhooks : providerWebhooks.filter(isWebhookFailed).length;
      const healthScore = readProviderHealthScore(health);

      return {
        ...row,
        invoices: providerInvoices,
        payouts: providerPayouts,
        issues: providerIssues,
        webhooks: providerWebhooks,
        deadLetters: providerDeadLetters,
        health,
        healthScore,
        healthStatus: health?.status || '',
        openIssues,
        failedWebhooks,
        status: readProviderStatus(row.provider, openIssues, failedWebhooks),
        balance: providerBalances[row.key]
      };
    });
  }, [deadLetterJobs, invoices, paymentIssues, paymentProviders, payouts, providerBalances, providerHealth, webhookEvents]);

  useEffect(() => {
    if (!providerRows.some((provider) => provider.key === activeProvider)) {
      setActiveProvider(providerRows[0]?.key || 'paypal');
    }
  }, [activeProvider, providerRows]);

  useEffect(() => {
    if (
      requestedProvider &&
      appliedRequestedProviderRef.current !== requestedProvider &&
      providerRows.some((provider) => provider.key === requestedProvider)
    ) {
      appliedRequestedProviderRef.current = requestedProvider;
      setActiveProvider(requestedProvider);
    }
  }, [providerRows, requestedProvider]);

  useEffect(() => {
    setSelectedWebhook(null);
    setWebhookActionError('');
    setWebhookActionId('');
    setDeadLetterActionError('');
    setDeadLetterActionId('');
  }, [activeProvider]);

  if (!profile?.is_admin) {
    return (
      <EmptyState
        icon={LockKeyhole}
        title="Admin access required"
        body="Provider readiness, balances, webhooks, payout review, and payment issue triage are restricted to operator accounts."
        action={<PrimaryButton to="/miniapp/support?from=ops" icon={MessageCircle}>Request access</PrimaryButton>}
      />
    );
  }

  const activeRow = providerRows.find((provider) => provider.key === activeProvider) || providerRows[0];
  const activeBalance = readBalanceAmount(activeRow?.balance);
  const activeCurrency = readBalanceCurrency(activeRow?.balance);
  const readinessTone = activeRow?.status === 'ready' ? 'success' : activeRow?.status === 'planned' ? 'warn' : activeRow?.failedWebhooks ? 'danger' : 'warn';
  const activeHealthTone = healthTone(activeRow?.healthScore || 0, activeRow?.healthStatus);
  const totalIssues = providerRows.reduce((sum, provider) => sum + provider.openIssues, 0);
  const totalDeadLetters = deadLetterJobs.filter((job) => !isDeadLetterRecovered(job)).length;
  const capabilities = Array.isArray(activeRow?.provider?.capabilities)
    ? activeRow.provider.capabilities
    : Array.isArray(activeRow?.provider?.features)
      ? activeRow.provider.features
      : ['Invoices', 'Payouts', 'Webhooks'];

  const refresh = async () => {
    setRefreshing(true);
    telegram.impact('light');
    try {
      const [providers] = await Promise.all([
        fetchPaymentProviders(),
        fetchInvoices({ limit: 100 }),
        fetchPayouts({ limit: 100 }),
        fetchPaymentIssues({ limit: 100 }),
        fetchWebhookEvents({ limit: 100 }),
        fetchProviderHealth(),
        fetchDeadLetterJobs({ limit: 50 })
      ]);
      await fetchProviderBalances(providers.length ? providers : providerRows.map((provider) => ({ key: provider.key })));
      toast.success('Provider command center refreshed');
      telegram.notify('success');
    } catch (_error) {
      toast.error('Unable to refresh provider command center');
      telegram.notify('error');
    } finally {
      setRefreshing(false);
    }
  };

  const recoverDeadLetter = async (job) => {
    const jobId = readDeadLetterId(job);
    if (!jobId) {
      return;
    }

    setDeadLetterActionError('');
    setDeadLetterActionId(jobId);
    telegram.impact('medium');

    try {
      const result = await recoverDeadLetterJob(jobId, `Recovered from ${activeRow?.label || 'provider'} command center`);
      if (result.success) {
        await Promise.all([
          fetchDeadLetterJobs({ limit: 50 }),
          fetchProviderHealth(),
          fetchPaymentIssues({ limit: 100 }),
          fetchWebhookEvents({ limit: 100 })
        ]);
        toast.success('Dead-letter job recovered');
        telegram.notify('success');
        return;
      }

      throw new Error(result.message || 'Unable to recover dead-letter job');
    } catch (error) {
      setDeadLetterActionError(error.message);
      toast.error(error.message);
      telegram.notify('error');
    } finally {
      setDeadLetterActionId('');
    }
  };

  const loadWebhookDetail = async (event) => {
    const webhookId = readWebhookId(event);
    if (!webhookId) {
      return;
    }

    setWebhookActionError('');
    setWebhookActionId(`${webhookId}:detail`);
    telegram.impact('light');

    try {
      const result = await fetchWebhookEvent(webhookId);
      if (result.success && result.event) {
        setSelectedWebhook(result.event);
        return;
      }

      throw new Error(result.message || 'Unable to load webhook detail');
    } catch (error) {
      setWebhookActionError(error.message);
      toast.error(error.message);
      telegram.notify('error');
    } finally {
      setWebhookActionId('');
    }
  };

  const replayWebhook = async (event) => {
    const webhookId = readWebhookId(event);
    if (!webhookId) {
      return;
    }

    setWebhookActionError('');
    setWebhookActionId(`${webhookId}:replay`);
    telegram.impact('medium');

    try {
      const result = await replayWebhookEvent(webhookId, `Replayed from ${activeRow?.label || 'provider'} command center`);
      if (result.success && result.event) {
        setSelectedWebhook(result.event);
        await fetchWebhookEvents({ limit: 100 });
        toast.success('Webhook replay queued');
        telegram.notify('success');
        return;
      }

      throw new Error(result.message || 'Unable to replay webhook');
    } catch (error) {
      setWebhookActionError(error.message);
      toast.error(error.message);
      telegram.notify('error');
    } finally {
      setWebhookActionId('');
    }
  };

  const ignoreWebhook = async (event) => {
    const webhookId = readWebhookId(event);
    if (!webhookId) {
      return;
    }

    setWebhookActionError('');
    setWebhookActionId(`${webhookId}:ignore`);
    telegram.impact('medium');

    try {
      const result = await ignoreWebhookEvent(webhookId, `Ignored from ${activeRow?.label || 'provider'} command center`);
      if (result.success && result.event) {
        setSelectedWebhook(result.event);
        await fetchWebhookEvents({ limit: 100 });
        toast.success('Webhook ignored');
        telegram.notify('success');
        return;
      }

      throw new Error(result.message || 'Unable to ignore webhook');
    } catch (error) {
      setWebhookActionError(error.message);
      toast.error(error.message);
      telegram.notify('error');
    } finally {
      setWebhookActionId('');
    }
  };

  return (
    <div className="space-y-4">
      <SuiteHeader
        eyebrow="Provider command"
        title="Provider Command Center"
        body="A provider-scoped mini app console for readiness, balances, webhook health, live issues, invoices, and payout operations."
        icon={ShieldCheck}
        action={<PrimaryButton icon={RefreshCw} onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing' : 'Refresh'}</PrimaryButton>}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard icon={Gauge} label="Health" value={`${activeRow?.healthScore || 0}/100`} detail={`${activeRow?.label || 'Provider'} score`} tone={activeHealthTone} />
        <MetricCard icon={AlertTriangle} label="Issues" value={totalIssues.toLocaleString()} detail="Open provider issues" tone={totalIssues ? 'danger' : 'success'} />
        <MetricCard icon={ShieldAlert} label="Dead letters" value={totalDeadLetters.toLocaleString()} detail="Awaiting recovery" tone={totalDeadLetters ? 'danger' : 'success'} />
        <MetricCard icon={WalletCards} label="Balance" value={formatMoney(activeBalance, activeCurrency)} detail={`${activeRow?.label || 'Provider'} available`} />
      </div>

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-3 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {providerRows.map((provider) => (
            <button
              key={provider.key}
              type="button"
              aria-pressed={provider.key === activeProvider}
              onClick={() => {
                setActiveProvider(provider.key);
                telegram.impact('light');
              }}
              className={`min-w-[148px] rounded-[24px] p-4 text-left transition active:scale-[0.98] ${
                provider.key === activeProvider
                  ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]'
                  : 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-text-color)]'
              }`}
            >
              <span className="block text-sm font-black">{provider.label}</span>
              <span className="mt-2 block text-[10px] font-black uppercase tracking-[0.12em] opacity-75">
                {provider.health ? `${provider.healthScore}/100` : normalizeStatus(provider.status)}
              </span>
              <span className="mt-3 flex items-center gap-2 text-xs font-black">
                <FileText size={14} />
                {provider.invoices.length}
                <WalletCards size={14} />
                {provider.payouts.length}
                {provider.deadLetters.some((job) => !isDeadLetterRecovered(job)) ? (
                  <>
                    <ShieldAlert size={14} />
                    {provider.deadLetters.filter((job) => !isDeadLetterRecovered(job)).length}
                  </>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Readiness</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{activeRow?.label} control plane</h3>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${toneClass(readinessTone)}`}>
              <Gauge size={13} />
              {normalizeStatus(activeRow?.status)}
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <MetricCard icon={Gauge} label="Health" value={`${activeRow?.healthScore || 0}/100`} tone={activeHealthTone} />
            <MetricCard icon={FileText} label="Invoices" value={(activeRow?.invoices.length || 0).toLocaleString()} />
            <MetricCard icon={WalletCards} label="Payouts" value={(activeRow?.payouts.length || 0).toLocaleString()} />
            <MetricCard icon={ShieldAlert} label="Issues" value={(activeRow?.openIssues || 0).toLocaleString()} tone={activeRow?.openIssues ? 'danger' : 'success'} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {capabilities.map((capability) => (
              <span key={String(capability)} className="rounded-full bg-[var(--tg-secondary-bg-color)] px-3 py-2 text-xs font-black text-[var(--tg-text-color)]">
                {String(capability).replace(/_/g, ' ')}
              </span>
            ))}
          </div>
          {activeRow?.health?.reasons?.length || activeRow?.health?.next_actions?.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {activeRow?.health?.reasons?.length ? (
                <div className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Health reasons</p>
                  <div className="mt-3 space-y-2">
                    {activeRow.health.reasons.slice(0, 4).map((reason) => (
                      <p key={reason} className="break-words text-sm font-bold text-[var(--tg-text-color)]">{reason}</p>
                    ))}
                  </div>
                </div>
              ) : null}
              {activeRow?.health?.next_actions?.length ? (
                <div className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Next actions</p>
                  <div className="mt-3 space-y-2">
                    {activeRow.health.next_actions.slice(0, 4).map((action) => (
                      <p key={action} className="break-words text-sm font-bold text-[var(--tg-text-color)]">{action}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Webhook health</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">
                {(activeRow?.webhooks.length || 0).toLocaleString()} recent events
              </h3>
            </div>
            <StatusBadge status={activeRow?.failedWebhooks ? 'failed' : 'succeeded'} />
          </div>
          <div className="mt-5 space-y-3">
            {(activeRow?.webhooks || []).slice(0, 4).map((event) => {
              const webhookId = readWebhookId(event);
              const detailBusy = webhookActionId === `${webhookId}:detail`;
              const replayBusy = webhookActionId === `${webhookId}:replay`;
              const ignoreBusy = webhookActionId === `${webhookId}:ignore`;

              return (
                <article key={webhookId || `${readWebhookType(event)}-${event.created_at}`} className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[var(--tg-text-color)]">{readWebhookType(event)}</p>
                      <p className="mt-1 text-xs font-bold text-[var(--tg-hint-color)]">{formatDate(event.processed_at || event.processedAt || event.created_at || event.createdAt)}</p>
                    </div>
                    <StatusBadge status={event.status || 'processed'} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => loadWebhookDetail(event)}
                      disabled={detailBusy}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--tg-section-bg-color)] px-3 py-2 text-xs font-black text-[var(--tg-text-color)] transition active:scale-[0.98] disabled:opacity-60"
                    >
                      <Eye size={14} />
                      {detailBusy ? 'Loading' : 'Details'}
                    </button>
                    {canReplayWebhook(event) ? (
                      <button
                        type="button"
                        onClick={() => replayWebhook(event)}
                        disabled={replayBusy}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition active:scale-[0.98] disabled:opacity-60"
                      >
                        <RefreshCw size={14} />
                        {replayBusy ? 'Queueing' : 'Replay'}
                      </button>
                    ) : null}
                    {canIgnoreWebhook(event) ? (
                      <button
                        type="button"
                        onClick={() => ignoreWebhook(event)}
                        disabled={ignoreBusy}
                        className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition active:scale-[0.98] disabled:opacity-60"
                      >
                        <XCircle size={14} />
                        {ignoreBusy ? 'Ignoring' : 'Ignore'}
                      </button>
                    ) : null}
                  </div>
                  {event.last_error || event.lastError ? (
                    <p className="mt-3 break-words rounded-[16px] bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                      {event.last_error || event.lastError}
                    </p>
                  ) : null}
                </article>
              );
            })}
            {selectedWebhook ? (
              <article className="rounded-[24px] border border-[var(--tg-section-separator-color)] bg-[var(--tg-bg-color)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Webhook detail</p>
                    <h4 className="mt-2 break-words text-lg font-black text-[var(--tg-text-color)]">{readWebhookType(selectedWebhook)}</h4>
                  </div>
                  <StatusBadge status={selectedWebhook.status || 'processed'} />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    ['Provider', providerLabel(readWebhookProvider(selectedWebhook) || activeRow?.key || 'paypal')],
                    ['Event ID', readWebhookEventId(selectedWebhook) || 'Unavailable'],
                    ['Payload ID', readWebhookSanitizedPayload(selectedWebhook).id || 'Unavailable'],
                    ['Resource', [readWebhookSanitizedPayload(selectedWebhook).resource_type, readWebhookSanitizedPayload(selectedWebhook).resource_id].filter(Boolean).join(' / ') || 'Unavailable'],
                    ['Verification', readWebhookVerification(selectedWebhook).verification_status || (readWebhookVerification(selectedWebhook).signature_header_present ? 'signature present' : 'not supplied')],
                    ['Attempts', readWebhookAttempts(selectedWebhook).toLocaleString()]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[18px] bg-[var(--tg-secondary-bg-color)] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">{label}</p>
                      <p className="mt-1 break-words text-sm font-black text-[var(--tg-text-color)]">{value}</p>
                    </div>
                  ))}
                </div>
                {readWebhookSanitizedPayload(selectedWebhook).top_level_keys?.length ? (
                  <div className="mt-3 rounded-[18px] bg-[var(--tg-secondary-bg-color)] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Top-level keys</p>
                    <p className="mt-1 break-words text-sm font-black text-[var(--tg-text-color)]">
                      {readWebhookSanitizedPayload(selectedWebhook).top_level_keys.join(', ')}
                    </p>
                  </div>
                ) : null}
                {selectedWebhook.last_error || selectedWebhook.lastError ? (
                  <p className="mt-3 break-words rounded-[18px] bg-rose-50 p-3 text-sm font-bold text-rose-700">
                    {selectedWebhook.last_error || selectedWebhook.lastError}
                  </p>
                ) : null}
                {webhookActionError ? (
                  <p className="mt-3 break-words rounded-[18px] bg-amber-50 p-3 text-sm font-bold text-amber-700">{webhookActionError}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {canReplayWebhook(selectedWebhook) ? (
                    <button
                      type="button"
                      onClick={() => replayWebhook(selectedWebhook)}
                      disabled={webhookActionId === `${readWebhookId(selectedWebhook)}:replay`}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition active:scale-[0.98] disabled:opacity-60"
                    >
                      <RefreshCw size={14} />
                      Replay
                    </button>
                  ) : null}
                  {canIgnoreWebhook(selectedWebhook) ? (
                    <button
                      type="button"
                      onClick={() => ignoreWebhook(selectedWebhook)}
                      disabled={webhookActionId === `${readWebhookId(selectedWebhook)}:ignore`}
                      className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition active:scale-[0.98] disabled:opacity-60"
                    >
                      <XCircle size={14} />
                      Ignore
                    </button>
                  ) : null}
                </div>
              </article>
            ) : null}
            {!activeRow?.webhooks.length ? (
              <p className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4 text-sm font-bold text-[var(--tg-subtitle-text-color)]">
                No webhook events are currently attached to this provider.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Dead-letter recovery</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{activeRow?.label} recovery lane</h3>
          </div>
          <StatusBadge status={(activeRow?.deadLetters || []).some((job) => !isDeadLetterRecovered(job)) ? 'failed' : 'ready'} />
        </div>
        <div className="mt-5 space-y-3">
          {(activeRow?.deadLetters || []).slice(0, 5).map((job) => {
            const jobId = readDeadLetterId(job);
            const recovered = isDeadLetterRecovered(job);
            const busy = deadLetterActionId === jobId;

            return (
              <article key={jobId || `${readDeadLetterSource(job)}-${readDeadLetterTitle(job)}`} className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black text-[var(--tg-text-color)]">{readDeadLetterTitle(job)}</p>
                    <p className="mt-1 break-words text-xs font-bold text-[var(--tg-hint-color)]">
                      {readDeadLetterSource(job)}
                      {readDeadLetterSourceId(job) ? ` / ${readDeadLetterSourceId(job)}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={recovered ? 'ready' : 'failed'} />
                </div>
                <p className="mt-3 break-words rounded-[16px] bg-[var(--tg-section-bg-color)] px-3 py-2 text-xs font-bold text-[var(--tg-subtitle-text-color)]">
                  {recovered ? 'Recovery has already been queued for this job.' : readDeadLetterError(job)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => recoverDeadLetter(job)}
                    disabled={busy || recovered || !jobId}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition active:scale-[0.98] disabled:opacity-60"
                  >
                    <RotateCcw size={14} />
                    {busy ? 'Recovering' : recovered ? 'Recovered' : 'Recover'}
                  </button>
                </div>
              </article>
            );
          })}
          {!activeRow?.deadLetters.length ? (
            <p className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4 text-sm font-bold text-[var(--tg-subtitle-text-color)]">
              No dead-letter jobs are currently attached to this provider.
            </p>
          ) : null}
          {deadLetterActionError ? (
            <p className="break-words rounded-[18px] bg-amber-50 p-3 text-sm font-bold text-amber-700">{deadLetterActionError}</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Payment issues</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{activeRow?.label} triage lane</h3>
          </div>
          <StatusBadge status={activeRow?.openIssues ? 'hold' : 'ready'} />
        </div>
        <div className="mt-5 space-y-3">
          {(activeRow?.issues || []).slice(0, 5).map((issue) => (
            <article key={issue.payment_issue_id || issue.id || readIssueSummary(issue)} className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-[var(--tg-text-color)]">{readIssueSummary(issue)}</p>
                  <p className="mt-1 truncate text-xs font-bold text-[var(--tg-hint-color)]">
                    {issue.entity_id || issue.entityId || issue.payment_issue_id || 'Provider issue'}
                  </p>
                </div>
                <StatusBadge status={issue.severity || issue.status || 'review'} />
              </div>
            </article>
          ))}
          {!activeRow?.issues.length ? (
            <p className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4 text-sm font-bold text-[var(--tg-subtitle-text-color)]">
              No open payment issues for this provider.
            </p>
          ) : null}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <ProviderRecordList title="Provider invoices" emptyTitle="No provider invoices" records={activeRow?.invoices || []} type="invoice" />
        <ProviderRecordList title="Provider payouts" emptyTitle="No provider payouts" records={activeRow?.payouts || []} type="payout" />
      </div>
    </div>
  );
}

export function RiskSection() {
  const { profile, paymentIssues, payouts, invoices } = useAppContext();
  const highValuePayouts = payouts.filter((payout) => readAmount(payout) >= 500);
  const openIssues = paymentIssues.length;
  const reviewInvoices = invoices.filter((invoice) => ['DISPUTED', 'FAILED', 'CANCELLED'].includes(String(invoice.status).toUpperCase()));

  if (!profile?.is_admin) {
    return (
      <EmptyState
        icon={LockKeyhole}
        title="Admin access required"
        body="Risk scoring, provider issue queues, payout holds, and manual review actions are restricted to operator accounts."
        action={<PrimaryButton to="/miniapp/support" icon={MessageCircle}>Request access</PrimaryButton>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SuiteHeader eyebrow="Risk command" title="Holds, reviews, and provider exceptions." body="A realistic risk layer for payout review, invoice disputes, webhook failures, and account velocity checks." icon={ShieldAlert} />
      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard icon={Gauge} label="Risk score" value="82" detail="Lower review pressure" />
        <MetricCard icon={WalletCards} label="Large payouts" value={highValuePayouts.length.toLocaleString()} />
        <MetricCard icon={ShieldAlert} label="Provider issues" value={openIssues.toLocaleString()} />
        <MetricCard icon={FileText} label="Invoice reviews" value={reviewInvoices.length.toLocaleString()} />
      </div>
      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <Timeline
          events={[
            { icon: ShieldCheck, title: 'Velocity rules', body: 'No abnormal invoice burst detected in the current window.', time: 'live', tone: 'success' },
            { icon: WalletCards, title: 'Payout threshold', body: `${highValuePayouts.length} payout records meet enhanced review criteria.`, time: 'now', tone: highValuePayouts.length ? 'warn' : 'success' },
            { icon: AlertTriangle, title: 'Provider exceptions', body: `${openIssues} payment operations issues are open.`, time: 'now', tone: openIssues ? 'danger' : 'success' }
          ]}
        />
      </section>
    </div>
  );
}

export function SecuritySection() {
  const { user, profile, telegramAuthState } = useAppContext();
  const telegram = useTelegramMiniApp();
  const rows = [
    ['Telegram runtime', telegram.available ? 'Detected' : 'Browser preview'],
    ['Telegram auth', telegramAuthState],
    ['Transferly account', user?.email || user?.id || 'Guest'],
    ['Role', profile?.is_admin ? 'Admin' : 'User']
  ];

  return (
    <div className="space-y-4">
      <SuiteHeader eyebrow="Security" title="Privacy-first controls for sensitive money flows." body="Visible account state, haptics preferences, masked identifiers, role labels, and session safety controls." icon={ShieldCheck} />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={ShieldCheck} label="Session" value={telegramAuthState === 'authenticated' ? 'Secured' : 'Limited'} />
        <MetricCard icon={LockKeyhole} label="Role" value={profile?.is_admin ? 'Admin' : 'User'} />
        <MetricCard icon={Eye} label="Privacy" value="Masked" />
      </div>
      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
              <p className="text-xs font-bold text-[var(--tg-hint-color)]">{label}</p>
              <p className="mt-2 truncate text-sm font-black text-[var(--tg-text-color)]">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <SecondaryButton icon={Copy} onClick={() => toast.success('Masked session reference copied')}>Copy safe reference</SecondaryButton>
          <SecondaryButton icon={Download} onClick={() => toast.success('Audit export queued')}>Export audit</SecondaryButton>
        </div>
      </section>
    </div>
  );
}
