import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Code2,
  FileText,
  Gauge,
  RefreshCw,
  Send,
  ShieldCheck
} from 'lucide-react';
import PaymentsTab from './AdminTabs/PaymentsTab';
import ProviderWorkspaceShell from './ProviderWorkspaceShell';
import { useAppContext } from '../context/AppContext';
import {
  getProviderLaneDefinition,
  getProviderManifest,
  getProviderWorkspaceRoute,
  isProviderLaneSupported
} from '../lib/providerManifests';

const paypalLanes = ['overview', 'invoices', 'payouts', 'activity', 'developer'];

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function readProviderSlug(record) {
  return normalizeKey(
    record?.provider ||
    record?.key ||
    record?.slug ||
    record?.id ||
    record?.payment_provider ||
    record?.paymentProvider ||
    record?.metadata?.provider ||
    record?.summary?.provider
  );
}

function readHealthSlug(record) {
  return normalizeKey(record?.provider || record?.key || record?.slug || record?.id);
}

function readWebhookProvider(event) {
  const explicit = readProviderSlug(event);
  if (explicit) {
    return explicit;
  }

  const eventName = normalizeKey(event?.event_type || event?.eventType || event?.type || event?.name);
  return eventName.includes('paypal') ? 'paypal' : '';
}

function readDeadLetterProvider(job) {
  return normalizeKey(job?.provider || job?.queue_provider || job?.metadata?.provider || job?.payload?.provider);
}

function isDeadLetterRecovered(job) {
  return Boolean(job?.recovery || job?.recovered_at || job?.recoveredAt);
}

function readStatus(record) {
  return String(record?.status || record?.state || record?.provider_status || record?.providerStatus || 'unknown');
}

function readTimestamp(record) {
  return (
    record?.created_at ||
    record?.createdAt ||
    record?.updated_at ||
    record?.updatedAt ||
    record?.processed_at ||
    record?.processedAt ||
    record?.received_at ||
    record?.receivedAt ||
    record?.last_event_at ||
    record?.lastEventAt ||
    ''
  );
}

function formatDateTime(value) {
  if (!value) {
    return 'Time unavailable';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatEnvironment(manifest, providerRecord) {
  const value = providerRecord?.environment || providerRecord?.mode || providerRecord?.env;
  return value || manifest.environmentSupport || [];
}

function readConnectionStatus(manifest, providerRecord, health) {
  return health?.status || providerRecord?.status || manifest.status || 'configured';
}

function countByStatus(records, preferredStatuses) {
  const statuses = new Set(preferredStatuses.map(normalizeKey));
  return records.filter((record) => statuses.has(normalizeKey(readStatus(record)))).length;
}

function buildTimeline({ invoices, payouts, webhookEvents, paymentIssues, deadLetterJobs }) {
  const timeline = [
    ...webhookEvents.map((event) => ({
      id: `webhook-${event.webhook_event_id || event.id || event.event_id || event.eventId}`,
      type: 'Webhook',
      title: event.event_type || event.eventType || event.type || 'PayPal webhook event',
      detail: readStatus(event),
      tone: normalizeKey(readStatus(event)).includes('fail') ? 'warning' : 'default',
      time: readTimestamp(event)
    })),
    ...paymentIssues.map((issue) => ({
      id: `issue-${issue.id || issue.issue_id || issue.issueId}`,
      type: 'Issue',
      title: issue.title || issue.code || 'Payment issue',
      detail: readStatus(issue),
      tone: 'warning',
      time: readTimestamp(issue)
    })),
    ...deadLetterJobs.map((job) => ({
      id: `dead-letter-${job.job_id || job.jobId || job.id}`,
      type: 'Recovery',
      title: job.name || job.queue || 'Dead-letter job',
      detail: isDeadLetterRecovered(job) ? 'recovered' : 'needs review',
      tone: isDeadLetterRecovered(job) ? 'default' : 'warning',
      time: readTimestamp(job)
    })),
    ...invoices.slice(0, 8).map((invoice) => ({
      id: `invoice-${invoice.id || invoice.invoice_id || invoice.invoiceId}`,
      type: 'Invoice',
      title: invoice.recipient_email || invoice.recipientEmail || invoice.customer_name || 'PayPal invoice',
      detail: readStatus(invoice),
      tone: 'default',
      time: readTimestamp(invoice)
    })),
    ...payouts.slice(0, 8).map((payout) => ({
      id: `payout-${payout.id || payout.payout_id || payout.payoutId}`,
      type: 'Payout',
      title: payout.recipient_email || payout.recipientEmail || payout.batch_id || 'PayPal payout',
      detail: readStatus(payout),
      tone: normalizeKey(readStatus(payout)).includes('fail') ? 'warning' : 'default',
      time: readTimestamp(payout)
    }))
  ];

  return timeline
    .filter((item) => item.id && item.id !== 'webhook-undefined' && item.id !== 'issue-undefined')
    .sort((left, right) => new Date(right.time || 0).getTime() - new Date(left.time || 0).getTime())
    .slice(0, 12);
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'default' }) {
  const toneClass = tone === 'warning'
    ? 'bg-amber-400/10 text-amber-100 ring-amber-300/25'
    : 'bg-[var(--provider-accent-soft)] text-[var(--tg-text-color)] ring-[var(--provider-accent-border)]';

  return (
    <article className="rounded-[22px] border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ring-1 ${toneClass}`}>
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

function ActionCard({ to, icon: Icon, label, detail }) {
  return (
    <Link
      to={to}
      className="group rounded-[22px] border border-white/10 bg-white/[0.045] p-4 transition hover:border-[var(--provider-accent-border)] hover:bg-[var(--provider-accent-soft)]"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--provider-accent-soft)] text-[var(--tg-text-color)] ring-1 ring-[var(--provider-accent-border)]">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-black text-[var(--tg-text-color)]">{label}</p>
            <ArrowRight className="opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" size={15} />
          </div>
          <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{detail}</p>
        </div>
      </div>
    </Link>
  );
}

function CapabilityList({ title, items }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-black text-[var(--tg-text-color)]">
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="rounded-[22px] border border-dashed border-white/15 bg-white/[0.03] p-5 text-center">
      <p className="font-black text-[var(--tg-text-color)]">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">{body}</p>
    </div>
  );
}

function Timeline({ items }) {
  if (!items.length) {
    return (
      <EmptyState
        title="No PayPal activity loaded yet"
        body="Webhook events, invoice changes, payout changes, and recovery jobs will appear here when the existing operations APIs return PayPal data."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const warning = item.tone === 'warning';

        return (
          <article key={item.id} className="rounded-[22px] border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl ring-1 ${warning ? 'bg-amber-400/10 text-amber-100 ring-amber-300/25' : 'bg-[var(--provider-accent-soft)] text-[var(--tg-text-color)] ring-[var(--provider-accent-border)]'}`}>
                {warning ? <AlertTriangle size={16} /> : <Activity size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">
                    {item.type}
                  </span>
                  <span className="text-xs font-bold text-[var(--tg-subtitle-text-color)]">{formatDateTime(item.time)}</span>
                </div>
                <p className="mt-2 font-black text-[var(--tg-text-color)]">{item.title}</p>
                <p className="mt-1 text-sm font-semibold capitalize text-[var(--tg-subtitle-text-color)]">{item.detail}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function LaneHeader({ eyebrow, title, body, action }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-black text-[var(--tg-text-color)]">{title}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">{body}</p>
        </div>
        {action}
      </div>
    </section>
  );
}

function PayPalOverview({ data }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={FileText}
          label="Invoices"
          value={data.invoices.length}
          detail={`${data.openInvoices} open or pending PayPal collection records`}
        />
        <MetricCard
          icon={Send}
          label="Payouts"
          value={data.payouts.length}
          detail={`${data.pendingPayouts} queued, pending, or review-state payout records`}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Activity health"
          value={data.failedOperations ? `${data.failedOperations} needs review` : 'Clear'}
          detail="Webhook, issue, and dead-letter status from Transferly operations data"
          tone={data.failedOperations ? 'warning' : 'default'}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <ActionCard
          to={getProviderWorkspaceRoute('paypal', 'invoices')}
          icon={FileText}
          label="PayPal invoices"
          detail="Create, send, refresh, remind, cancel, and release invoice funds through the existing Transferly invoice workflow."
        />
        <ActionCard
          to={getProviderWorkspaceRoute('paypal', 'payouts')}
          icon={Send}
          label="PayPal payouts"
          detail="Create, refresh, review, approve, reject, and cancel supported unclaimed payout requests."
        />
        <ActionCard
          to={getProviderWorkspaceRoute('paypal', 'activity')}
          icon={Activity}
          label="PayPal activity"
          detail="Review provider-focused webhooks, state changes, issues, and recovery work."
        />
        <ActionCard
          to={getProviderWorkspaceRoute('paypal', 'developer')}
          icon={Code2}
          label="Developer lane"
          detail="Check webhook readiness, traceability, idempotency guidance, and existing operator tooling."
        />
      </section>
    </div>
  );
}

function PayPalInvoiceLane() {
  return (
    <div className="space-y-4">
      <LaneHeader
        eyebrow="PayPal collections"
        title="Invoice lane"
        body="PayPal invoice operations now live under the provider workspace while reusing the existing Transferly invoice workflow."
      />
      <CapabilityList
        title="Available invoice actions"
        items={['Create', 'Send', 'Preview', 'Refresh', 'Remind', 'Cancel reminders', 'Cancel invoice', 'Release funds']}
      />
      <PaymentsTab embedded mode="invoice" providerFilter="paypal" />
    </div>
  );
}

function PayPalPayoutLane() {
  return (
    <div className="space-y-4">
      <LaneHeader
        eyebrow="PayPal sending"
        title="Payout lane"
        body="PayPal payout operations now live under the provider workspace while preserving the current review, approval, and remediation flow."
      />
      <CapabilityList
        title="Available payout actions"
        items={['Create', 'Refresh', 'Review state', 'Approve', 'Reject', 'Cancel unclaimed', 'Risk decision']}
      />
      <PaymentsTab embedded mode="payout" providerFilter="paypal" />
    </div>
  );
}

function PayPalActivityLane({ data }) {
  return (
    <div className="space-y-4">
      <LaneHeader
        eyebrow="PayPal operations"
        title="Activity lane"
        body="A PayPal-focused timeline from Transferly invoice, payout, webhook, issue, and recovery data."
        action={(
          <Link
            to="/miniapp/ops?provider=paypal"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-black text-[var(--tg-text-color)] transition hover:bg-white/[0.08]"
          >
            Command center
            <ArrowRight size={15} />
          </Link>
        )}
      />
      <Timeline items={data.timeline} />
    </div>
  );
}

function PayPalDeveloperLane({ data, manifest }) {
  return (
    <div className="space-y-4">
      <LaneHeader
        eyebrow="PayPal developer"
        title="Webhook and traceability lane"
        body="Operational developer controls stay Transferly-branded and link into existing command-center tools where replay, ignore, and recovery actions are already implemented."
        action={(
          <a
            href={manifest.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-black text-[var(--tg-text-color)] transition hover:bg-white/[0.08]"
          >
            <BookOpen size={15} />
            PayPal docs
          </a>
        )}
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={Activity}
          label="Webhook events"
          value={data.webhookEvents.length}
          detail={`${data.failedWebhooks} failed or exception-state deliveries`}
          tone={data.failedWebhooks ? 'warning' : 'default'}
        />
        <MetricCard
          icon={RefreshCw}
          label="Recovery queue"
          value={data.activeDeadLetters}
          detail="Unrecovered dead-letter jobs associated with PayPal"
          tone={data.activeDeadLetters ? 'warning' : 'default'}
        />
        <MetricCard
          icon={Clock3}
          label="Traceability"
          value="Request IDs"
          detail="Use provider invoice IDs, payout batch IDs, and webhook event IDs in command-center detail views."
        />
      </section>
      <CapabilityList
        title="Developer guidance"
        items={['Webhook event IDs', 'Provider resource IDs', 'Idempotent payout submission', 'Replay and ignore through command center', 'Dead-letter recovery through command center']}
      />
      <ActionCard
        to="/miniapp/ops?provider=paypal"
        icon={Code2}
        label="Open operator tools"
        detail="Use existing replay, ignore, provider health, balance, and dead-letter recovery tools without duplicating command-center behavior."
      />
    </div>
  );
}

function usePayPalWorkspaceData(manifest) {
  const {
    profile,
    invoices = [],
    payouts = [],
    paymentIssues = [],
    paymentProviders = [],
    providerHealth = [],
    webhookEvents = [],
    deadLetterJobs = [],
    fetchInvoices,
    fetchPayouts,
    fetchPaymentIssues,
    fetchPaymentProviders,
    fetchProviderHealth,
    fetchProviderBalances,
    fetchWebhookEvents,
    fetchDeadLetterJobs
  } = useAppContext();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!profile?.is_admin) {
      return undefined;
    }

    let alive = true;
    async function load() {
      setRefreshing(true);
      try {
        const providers = await fetchPaymentProviders?.();
        await Promise.all([
          fetchInvoices?.({ provider: 'paypal', pageSize: 50 }),
          fetchPayouts?.({ provider: 'paypal', pageSize: 50 }),
          fetchPaymentIssues?.({ provider: 'paypal', limit: 50 }),
          fetchProviderHealth?.(),
          fetchWebhookEvents?.({ provider: 'paypal', limit: 100 }),
          fetchDeadLetterJobs?.({ provider: 'paypal', limit: 50 })
        ]);
        await fetchProviderBalances?.(providers?.length ? providers : [{ key: 'paypal' }]);
      } catch (error) {
        console.error('Failed to load PayPal provider workspace', error);
      } finally {
        if (alive) {
          setRefreshing(false);
        }
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [
    fetchDeadLetterJobs,
    fetchInvoices,
    fetchPaymentIssues,
    fetchPaymentProviders,
    fetchPayouts,
    fetchProviderBalances,
    fetchProviderHealth,
    fetchWebhookEvents,
    profile?.is_admin
  ]);

  return useMemo(() => {
    const providerRecord = paymentProviders.find((provider) => readProviderSlug(provider) === 'paypal') || null;
    const health = providerHealth.find((item) => readHealthSlug(item) === 'paypal') || null;
    const paypalInvoices = invoices.filter((invoice) => readProviderSlug(invoice) === 'paypal');
    const paypalPayouts = payouts.filter((payout) => readProviderSlug(payout) === 'paypal');
    const paypalIssues = paymentIssues.filter((issue) => readProviderSlug(issue) === 'paypal');
    const paypalWebhooks = webhookEvents.filter((event) => readWebhookProvider(event) === 'paypal');
    const paypalDeadLetters = deadLetterJobs.filter((job) => {
      const provider = readDeadLetterProvider(job);
      return provider === 'paypal' || normalizeKey(job?.queue || job?.name).includes('paypal');
    });
    const openInvoices = countByStatus(paypalInvoices, ['draft', 'sent', 'scheduled', 'unpaid', 'pending', 'review_required']);
    const pendingPayouts = countByStatus(paypalPayouts, ['queued', 'pending', 'review', 'review_required', 'processing']);
    const failedWebhooks = paypalWebhooks.filter((event) => {
      const status = normalizeKey(readStatus(event));
      return status.includes('fail') || status.includes('error') || status.includes('exception');
    }).length;
    const activeDeadLetters = paypalDeadLetters.filter((job) => !isDeadLetterRecovered(job)).length;
    const failedOperations = failedWebhooks + activeDeadLetters + paypalIssues.filter((issue) => normalizeKey(readStatus(issue)) !== 'resolved').length;

    return {
      refreshing,
      providerRecord,
      health,
      environment: formatEnvironment(manifest, providerRecord),
      connectionStatus: readConnectionStatus(manifest, providerRecord, health),
      invoices: paypalInvoices,
      payouts: paypalPayouts,
      paymentIssues: paypalIssues,
      webhookEvents: paypalWebhooks,
      deadLetterJobs: paypalDeadLetters,
      openInvoices,
      pendingPayouts,
      failedWebhooks,
      activeDeadLetters,
      failedOperations,
      timeline: buildTimeline({
        invoices: paypalInvoices,
        payouts: paypalPayouts,
        webhookEvents: paypalWebhooks,
        paymentIssues: paypalIssues,
        deadLetterJobs: paypalDeadLetters
      })
    };
  }, [deadLetterJobs, invoices, manifest, paymentIssues, paymentProviders, payouts, providerHealth, refreshing, webhookEvents]);
}

export default function PayPalProviderWorkspace({ lane = 'overview' }) {
  const manifest = getProviderManifest('paypal');
  const requestedLane = lane || 'overview';
  const activeLane = isProviderLaneSupported('paypal', requestedLane) && paypalLanes.includes(requestedLane)
    ? requestedLane
    : 'overview';
  const data = usePayPalWorkspaceData(manifest);
  const lanes = manifest.lanes.filter((item) => paypalLanes.includes(item.id));

  if (requestedLane !== activeLane) {
    return <Navigate to={getProviderWorkspaceRoute('paypal', activeLane)} replace />;
  }

  const quickActions = [
    { label: 'Overview', to: getProviderWorkspaceRoute('paypal', 'overview') },
    { label: 'Invoices', to: getProviderWorkspaceRoute('paypal', 'invoices') },
    { label: 'Payouts', to: getProviderWorkspaceRoute('paypal', 'payouts') },
    { label: 'Activity', to: getProviderWorkspaceRoute('paypal', 'activity') },
    { label: 'Developer', to: getProviderWorkspaceRoute('paypal', 'developer') }
  ];
  const laneDefinition = getProviderLaneDefinition(activeLane);

  return (
    <ProviderWorkspaceShell
      manifest={manifest}
      activeLane={activeLane}
      lanes={lanes}
      environment={data.environment}
      connectionStatus={data.connectionStatus}
      capabilities={manifest.capabilities}
      quickActions={quickActions}
      state="ready"
    >
      <div className="space-y-4">
        <section className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            icon={Gauge}
            label="Workspace"
            value={laneDefinition.label}
            detail={data.refreshing ? 'Refreshing PayPal operations data...' : 'Transferly provider-first PayPal route'}
          />
          <MetricCard
            icon={CheckCircle2}
            label="Connection"
            value={data.connectionStatus}
            detail={data.health ? 'Health status loaded from provider operations.' : 'Health data loads from the existing operations APIs.'}
          />
          <MetricCard
            icon={ShieldCheck}
            label="Environment"
            value={Array.isArray(data.environment) ? data.environment.join(' / ') : data.environment}
            detail="Displayed from provider configuration when available."
          />
        </section>

        {activeLane === 'overview' ? <PayPalOverview data={data} /> : null}
        {activeLane === 'invoices' ? <PayPalInvoiceLane /> : null}
        {activeLane === 'payouts' ? <PayPalPayoutLane /> : null}
        {activeLane === 'activity' ? <PayPalActivityLane data={data} /> : null}
        {activeLane === 'developer' ? <PayPalDeveloperLane data={data} manifest={manifest} /> : null}
      </div>
    </ProviderWorkspaceShell>
  );
}
