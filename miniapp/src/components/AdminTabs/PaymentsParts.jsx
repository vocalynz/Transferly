import { Fragment, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  ExternalLink,
  MessageSquare,
  QrCode,
  RefreshCw,
  Send,
  ShieldX,
  Wallet,
  X
} from 'lucide-react';
import { PAYPAL_BRAND, formatCents, formatDateTime } from './paymentsUtils';

export function DetailRow({ label, value }) {
  return (
    <div className="border-b border-gray-100 px-1 py-2 last:border-b-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-gray-900">{value || 'Not set'}</p>
    </div>
  );
}

export function PaginationControls({ pagination, onPrevious, onNext }) {
  if (!pagination) {
    return null;
  }

  const page = Number(pagination.page || 1);
  const pageSize = Number(pagination.page_size || 0);
  const total = Number(pagination.total || 0);
  const start = total === 0 || pageSize === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = total === 0 || pageSize === 0 ? 0 : Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {start}-{end} of {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={page <= 1}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!pagination.has_next_page}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function StatusPill({ value, tone = 'gray' }) {
  const styles = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700'
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[tone] || styles.gray}`}>
      {value}
    </span>
  );
}

export function TimelinePanel({ title, loading, entries }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h4 className="text-sm font-bold text-gray-900">{title}</h4>
      {loading ? (
        <div className="py-4 text-sm text-gray-500">Loading timeline…</div>
      ) : entries.length === 0 ? (
        <div className="py-4 text-sm text-gray-500">No timeline events yet.</div>
      ) : (
        <div className="mt-3 space-y-3">
          {entries.map((entry) => (
            <div key={entry.audit_log_id} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{entry.action}</p>
                <p className="text-xs text-gray-500">{formatDateTime(entry.created_at)}</p>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Actor: {entry.actor_type}{entry.actor_id ? ` · ${entry.actor_id}` : ''}
              </div>
              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InvoiceActions({
  invoice,
  busyAction,
  onRefresh,
  onReminder,
  onCancelReminders,
  onQr,
  onCancel,
  onReviewRequired,
  onTimelineToggle,
  timelineOpen
}) {
  const isBusy = (action) => busyAction === `${action}:${invoice.internal_invoice_id}`;
  const provider = (invoice.provider || invoice.metadata?.provider || 'paypal').toLowerCase();
  const isPayPal = provider === 'paypal';
  const isStripe = provider === 'stripe';
  const isCrypto = provider === 'crypto';
  const canCancel = !isCrypto && !['PAID', 'CANCELLED', 'REFUNDED'].includes(invoice.status);
  const canSendReminder = ['SENT', 'UPDATED'].includes(invoice.status);
  const canGenerateQr = ['SENT', 'UPDATED', 'PAID'].includes(invoice.status);
  const remindersStopped = Boolean(invoice.summary.auto_reminders_cancelled_at);
  const linkLabel = isStripe ? 'Open Stripe' : isCrypto ? 'Open Charge' : 'Open PayPal';

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onRefresh(invoice)}
        disabled={Boolean(busyAction)}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        <RefreshCw size={14} className={isBusy('refresh') ? 'animate-spin' : ''} />
        Refresh
      </button>
      {isPayPal && (
        <>
          <button
            onClick={() => onReminder(invoice)}
            disabled={!canSendReminder || Boolean(busyAction)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Send size={14} />
            Remind
          </button>
          <button
            onClick={() => onCancelReminders(invoice)}
            disabled={remindersStopped || Boolean(busyAction)}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            <ShieldX size={14} />
            Stop Reminders
          </button>
          <button
            onClick={() => onQr(invoice)}
            disabled={!canGenerateQr || Boolean(busyAction)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <QrCode size={14} />
            QR
          </button>
        </>
      )}
      <button
        onClick={() => onCancel(invoice)}
        disabled={!canCancel || Boolean(busyAction)}
        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        <ShieldX size={14} />
        {isStripe ? 'Void' : 'Cancel'}
      </button>
      {isCrypto && (
        <button
          onClick={() => onReviewRequired(invoice)}
          disabled={Boolean(busyAction)}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
        >
          <AlertTriangle size={14} />
          Review
        </button>
      )}
      <button
        onClick={() => onTimelineToggle(invoice)}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <Clock3 size={14} />
        {timelineOpen ? 'Hide Timeline' : 'Timeline'}
      </button>
      {invoice.invoice_link && (
        <a
          href={invoice.invoice_link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800"
        >
          <ExternalLink size={14} />
          {linkLabel}
        </a>
      )}
    </div>
  );
}

export function PayoutActions({ payout, busyAction, onRefresh, onCancelUnclaimed, onTimelineToggle, timelineOpen }) {
  const isBusy = busyAction === `refresh:${payout.payout_id}`;
  const remediation = payout.official_paypal?.remediation;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onRefresh(payout)}
        disabled={Boolean(busyAction)}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        <RefreshCw size={14} className={isBusy ? 'animate-spin' : ''} />
        Refresh
      </button>
      {remediation?.action === 'cancel_unclaimed' && remediation.allowed && (
        <button
          onClick={() => onCancelUnclaimed(payout)}
          disabled={Boolean(busyAction)}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
        >
          <ShieldX size={14} />
          {remediation.label}
        </button>
      )}
      <button
        onClick={() => onTimelineToggle(payout)}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <Clock3 size={14} />
        {timelineOpen ? 'Hide Timeline' : 'Timeline'}
      </button>
    </div>
  );
}

export function PaymentRecordDrawer({
  record,
  type,
  busyAction,
  onClose,
  invoiceActions,
  payoutActions,
  adminActions,
  timeline
}) {
  const [note, setNote] = useState('');
  const [releaseAmount, setReleaseAmount] = useState('');
  const [releaseReason, setReleaseReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  if (!record) {
    return null;
  }

  const isInvoice = type === 'invoice';
  const title = isInvoice
    ? record.summary?.invoice_number || record.invoice_id
    : record.payout_id;
  const providerState = isInvoice
    ? record.status
    : record.official_paypal?.provider_item_status || record.metadata?.provider_item_status || 'Unknown';
  const canApprovePayout = !isInvoice && record.status === 'PENDING_APPROVAL';
  const canRejectPayout = canApprovePayout;
  const canReleaseInvoice = isInvoice && record.status === 'PAID';

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close detail drawer"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/30"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-gray-200 bg-gray-50 shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                {isInvoice ? 'Invoice Detail' : 'Payout Detail'}
              </p>
              <h3 className="mt-2 break-words text-xl font-black text-gray-950">{title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Current State</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill value={record.status} tone={record.status === 'SUCCESS' || record.status === 'PAID' ? 'green' : record.status === 'FAILED' || record.status === 'DENIED' ? 'red' : 'blue'} />
                  {!isInvoice && record.risk_decision ? (
                    <StatusPill value={record.risk_decision} tone={record.risk_decision === 'APPROVED' ? 'green' : record.risk_decision === 'BLOCKED' ? 'red' : 'amber'} />
                  ) : null}
                </div>
              </div>
              <div className="text-right text-sm font-semibold text-gray-900">
                {isInvoice
                  ? `${record.summary?.amount || '--'} ${record.summary?.currency || ''}`
                  : `${record.summary?.amount || '--'} ${record.summary?.currency || ''}`}
              </div>
            </div>
          </div>

          {isInvoice ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailRow label="Recipient" value={record.summary?.recipient_email} />
                <DetailRow label="Provider State" value={providerState} />
                <DetailRow label="PayPal Invoice ID" value={record.invoice_id} />
                <DetailRow label="Internal ID" value={record.internal_invoice_id} />
                <DetailRow label="Issue Date" value={record.summary?.issue_date || 'Immediate send'} />
                <DetailRow label="Due Date" value={record.summary?.due_date || 'Not set'} />
                <DetailRow label="Last Synced" value={formatDateTime(record.official_paypal?.last_synced_at)} />
                <DetailRow label="QR" value={record.official_paypal?.qr?.image_url_png ? 'Ready' : 'Not generated'} />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">Actions</p>
                <div className="mt-3">
                  <InvoiceActions
                    invoice={record}
                    busyAction={busyAction}
                    onRefresh={invoiceActions.onRefresh}
                    onReminder={invoiceActions.onReminder}
                    onCancelReminders={invoiceActions.onCancelReminders}
                    onQr={invoiceActions.onQr}
                    onCancel={invoiceActions.onCancel}
                    onReviewRequired={invoiceActions.onReviewRequired}
                    onTimelineToggle={invoiceActions.onTimelineToggle}
                    timelineOpen={timeline.open}
                  />
                </div>
              </div>
              {canReleaseInvoice ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">Release Funds</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={releaseAmount}
                      onChange={(event) => setReleaseAmount(event.target.value)}
                      placeholder="Full amount"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    />
                    <input
                      value={releaseReason}
                      onChange={(event) => setReleaseReason(event.target.value)}
                      placeholder="Release reason"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => adminActions.onReleaseInvoice(record, releaseAmount, releaseReason)}
                    disabled={Boolean(busyAction)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Wallet size={14} />
                    Release
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailRow label="Receiver" value={record.summary?.receiver} />
                <DetailRow label="Recipient Type" value={record.summary?.recipient_type} />
                <DetailRow label="Provider Item State" value={providerState} />
                <DetailRow label="Batch State" value={record.official_paypal?.provider_batch_status || 'Unknown'} />
                <DetailRow label="Sender Batch" value={record.tracking?.sender_batch_id} />
                <DetailRow label="PayPal Batch" value={record.tracking?.payout_batch_id} />
                <DetailRow label="PayPal Item" value={record.tracking?.payout_item_id} />
                <DetailRow label="Last Synced" value={formatDateTime(record.official_paypal?.last_synced_at || record.metadata?.last_synced_at)} />
                <DetailRow label="Estimated Fee" value={`${record.pricing?.fee || '0.00'} ${record.summary?.currency || ''}`} />
                <DetailRow label="Total Debit" value={`${record.summary?.total_debit || record.summary?.amount || '--'} ${record.summary?.currency || ''}`} />
              </div>

              {record.official_paypal?.remediation?.reason ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {record.official_paypal.remediation.reason}
                </div>
              ) : null}

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">Actions</p>
                <div className="mt-3">
                  <PayoutActions
                    payout={record}
                    busyAction={busyAction}
                    onRefresh={payoutActions.onRefresh}
                    onCancelUnclaimed={payoutActions.onCancelUnclaimed}
                    onTimelineToggle={payoutActions.onTimelineToggle}
                    timelineOpen={timeline.open}
                  />
                </div>
              </div>
              {canApprovePayout || canRejectPayout ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">Review Decision</p>
                  <textarea
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    rows={2}
                    placeholder="Rejection reason, if rejecting"
                    className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => adminActions.onApprovePayout(record)}
                      disabled={Boolean(busyAction)}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      Approve
                    </button>
                    <button
                      onClick={() => adminActions.onRejectPayout(record, rejectReason)}
                      disabled={Boolean(busyAction)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <ShieldX size={14} />
                      Reject
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">Operator Note</p>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Add an audit note to this record"
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            />
            <button
              onClick={() => adminActions.onAddNote(record, type, note, () => setNote(''))}
              disabled={!note.trim() || Boolean(busyAction)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <MessageSquare size={14} />
              Save Note
            </button>
          </div>

          {timeline.open ? (
            <TimelinePanel
              title={`${isInvoice ? 'Invoice' : 'Payout'} Timeline`}
              loading={timeline.loading}
              entries={timeline.entries}
            />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function PayoutComposerSection({
  busyAction,
  isStripePayoutWorkspace,
  lastCreatedPayout,
  onPayoutComposerFieldChange,
  onPayoutComposerSubmit,
  onResetPayoutComposer,
  onStripeConnectedAccountSelect,
  payoutComposer,
  payoutImpactPreview,
  payoutSandboxWallet,
  selectedStripeConnectedAccountId,
  stripeConnectedAccountsState,
  walletCurrency
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div
        className="rounded-2xl border bg-white p-6 shadow-sm"
        style={{ borderColor: PAYPAL_BRAND.border, boxShadow: '0 20px 44px rgba(0,48,135,0.06)' }}
      >
        <div
          className="mb-6 rounded-2xl border p-4"
          style={{ borderColor: '#e6eef8', backgroundColor: PAYPAL_BRAND.shell }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <img src={PAYPAL_BRAND.logoUrl} alt="PayPal" className="h-7 w-auto" />
              <div>
                <p className="text-sm font-black" style={{ color: PAYPAL_BRAND.ink }}>
                  PayPal Sandbox Payouts
                </p>
                <p className="text-xs font-semibold" style={{ color: PAYPAL_BRAND.muted }}>
                  Balance-funded send money request
                </p>
              </div>
            </div>
            <div className="rounded-full bg-white px-4 py-2 text-sm font-black" style={{ color: PAYPAL_BRAND.ink }}>
              Balance {formatCents(payoutSandboxWallet.availableCents, walletCurrency)}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-bold" style={{ color: PAYPAL_BRAND.ink }}>
              Send money
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Request a PayPal sandbox payout and review fee, debit, and provider path before submission.
            </p>
          </div>
          <button
            onClick={onResetPayoutComposer}
            className="rounded-full border px-4 py-2 text-xs font-bold hover:bg-gray-50"
            style={{ borderColor: PAYPAL_BRAND.border, color: PAYPAL_BRAND.actionBlue }}
          >
            Reset
          </button>
        </div>

        {isStripePayoutWorkspace ? (
          <div className="mt-5 rounded-2xl border border-[#d7d2ff] bg-[#f1efff] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#635bff]">Stripe Connected Account</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Pick a tracked account to fill receiver and recipient type automatically.
                </p>
              </div>
              <div className="rounded-full border border-[#d7d2ff] bg-white px-3 py-1 text-xs font-black text-[#635bff]">
                {stripeConnectedAccountsState.loading
                  ? 'Loading'
                  : `${stripeConnectedAccountsState.accounts.length} accounts`}
              </div>
            </div>
            {stripeConnectedAccountsState.error ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
                {stripeConnectedAccountsState.error}
              </p>
            ) : null}
            <select
              value={selectedStripeConnectedAccountId}
              onChange={(event) => onStripeConnectedAccountSelect(event.target.value)}
              className="mt-4 w-full rounded-xl border border-[#d7d2ff] bg-white px-3 py-3 text-sm font-bold text-slate-900 outline-none focus:border-[#635bff]"
            >
              <option value="">Select connected account</option>
              {stripeConnectedAccountsState.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.stripe_account_id} · {account.status} · {account.email || 'no email'}
                </option>
              ))}
            </select>
            {selectedStripeConnectedAccountId ? (
              <p className="mt-3 text-xs font-bold text-slate-500">
                Receiver will submit as a Stripe connected account transfer destination.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Receiver</label>
            <input
              value={payoutComposer.receiver}
              onChange={(event) => onPayoutComposerFieldChange('receiver', event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="recipient@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Recipient Type</label>
            <select
              value={payoutComposer.recipientType}
              onChange={(event) => onPayoutComposerFieldChange('recipientType', event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="EMAIL">EMAIL</option>
              <option value="PHONE">PHONE</option>
              <option value="PAYPAL_ID">PAYPAL_ID</option>
              <option value="STRIPE_ACCOUNT">STRIPE_ACCOUNT</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Amount</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={payoutComposer.amount}
              onChange={(event) => onPayoutComposerFieldChange('amount', event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="25.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
            <input
              value={payoutComposer.currency}
              onChange={(event) => onPayoutComposerFieldChange('currency', event.target.value)}
              maxLength={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Receiver Country</label>
            <input
              value={payoutComposer.receiverCountryCode}
              onChange={(event) => onPayoutComposerFieldChange('receiverCountryCode', event.target.value)}
              maxLength={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none"
              placeholder="US"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Note</label>
          <textarea
            value={payoutComposer.note}
            onChange={(event) => onPayoutComposerFieldChange('note', event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Optional payout note"
          />
        </div>

        <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: '#e6eef8', backgroundColor: PAYPAL_BRAND.shell }}>
          <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: PAYPAL_BRAND.blue }}>
            Review before you send
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold text-slate-500">Estimated fee</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {formatCents(payoutImpactPreview.feeCents, payoutImpactPreview.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total debit</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {formatCents(payoutImpactPreview.totalDebitCents, payoutImpactPreview.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Review path</p>
              <p className="mt-1 text-sm font-black text-slate-950">{payoutImpactPreview.likelyReviewPath}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Balance impact</p>
              <p
                className={`mt-1 text-sm font-black ${
                  payoutImpactPreview.remainingAvailableCents < 0 ? 'text-red-700' : 'text-slate-950'
                }`}
              >
                {formatCents(payoutImpactPreview.availableCents, payoutImpactPreview.currency)}
                {' -> '}
                {formatCents(payoutImpactPreview.remainingAvailableCents, payoutImpactPreview.currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={onPayoutComposerSubmit}
            disabled={busyAction === 'create-payout'}
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: PAYPAL_BRAND.actionBlue }}
          >
            <Send size={16} className={busyAction === 'create-payout' ? 'animate-pulse' : ''} />
            Send payout
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div
          className="rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: PAYPAL_BRAND.border }}
        >
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Sandbox Wallet</p>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <DetailRow label="Available" value={formatCents(payoutSandboxWallet.availableCents, walletCurrency)} />
            <DetailRow label="Reserved" value={formatCents(payoutSandboxWallet.frozenCents, walletCurrency)} />
            <DetailRow label="Pending" value={formatCents(payoutSandboxWallet.pendingCents, walletCurrency)} />
            <p>The pre-submit preview estimates fee, total debit, review path, and wallet impact before creation.</p>
          </div>
        </div>

        {lastCreatedPayout ? (
          <div
            className="rounded-2xl border p-5 shadow-sm"
            style={{
              borderColor: PAYPAL_BRAND.border,
              background: 'linear-gradient(180deg, rgba(0,156,222,0.08), rgba(255,255,255,1))'
            }}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: PAYPAL_BRAND.blue }}>
              Last Requested
            </p>
            <p className="mt-3 text-lg font-black tracking-[-0.03em]" style={{ color: PAYPAL_BRAND.ink }}>
              {lastCreatedPayout.payout_id}
            </p>
            <div className="mt-2 text-sm text-slate-600">
              {lastCreatedPayout.summary?.receiver || payoutComposer.receiver}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {lastCreatedPayout.summary?.amount || Number(lastCreatedPayout.amount || 0).toFixed?.(2) || '--'} {lastCreatedPayout.summary?.currency || payoutComposer.currency}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill
                value={lastCreatedPayout.status || 'REQUESTED'}
                tone={
                  lastCreatedPayout.status === 'SUCCESS'
                    ? 'green'
                    : lastCreatedPayout.status === 'FAILED' || lastCreatedPayout.status === 'DENIED'
                      ? 'red'
                      : 'blue'
                }
              />
              {lastCreatedPayout.risk_decision ? (
                <StatusPill
                  value={lastCreatedPayout.risk_decision}
                  tone={lastCreatedPayout.risk_decision === 'APPROVED' ? 'green' : 'amber'}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function InvoiceRecordsTable({
  busyAction,
  filteredInvoices,
  generateInvoiceQr,
  handleInvoiceAction,
  handleInvoiceCancel,
  handleInvoiceReminderCancellation,
  handleMarkInvoiceReviewRequired,
  invoicePagination,
  invoiceTimelineEntries,
  invoiceTimelineId,
  invoiceTimelineLoading,
  isPayPalInvoiceWorkspace,
  onNextPage,
  onOpenDetail,
  onPreviousPage,
  refreshInvoice,
  sendInvoiceReminder,
  toggleInvoiceTimeline
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={isPayPalInvoiceWorkspace ? { borderColor: PAYPAL_BRAND.border, boxShadow: '0 18px 40px rgba(0,48,135,0.06)' } : undefined}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead
            className="border-b bg-gray-50"
            style={
              isPayPalInvoiceWorkspace
                ? {
                    borderColor: PAYPAL_BRAND.border,
                    background: 'linear-gradient(180deg, rgba(0,48,135,0.06), rgba(244,248,255,1))'
                  }
                : undefined
            }
          >
            <tr>
              {['Invoice', 'Recipient', 'Amount', 'Status', 'Official PayPal', 'Actions'].map((heading) => (
                <th key={heading} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((invoice) => (
              <Fragment key={invoice.internal_invoice_id}>
                <tr
                  className="border-b align-top hover:bg-gray-50"
                  style={isPayPalInvoiceWorkspace ? { borderColor: PAYPAL_BRAND.border } : undefined}
                >
                  <td className="px-6 py-4">
                    <div
                      className="font-semibold text-gray-900"
                      style={isPayPalInvoiceWorkspace ? { color: PAYPAL_BRAND.ink } : undefined}
                    >
                      {invoice.summary.invoice_number}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{invoice.invoice_id}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{invoice.summary.recipient_email}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {invoice.summary.amount} {invoice.summary.currency}
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill
                      value={invoice.status}
                      tone={invoice.status === 'PAID' ? 'green' : invoice.status === 'FAILED' ? 'red' : 'blue'}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div>Issue Date: {invoice.summary.issue_date || 'Immediate send'}</div>
                    <div className="mt-1">Due: {invoice.summary.due_date || 'Not set'}</div>
                    <div className="mt-1">Synced: {formatDateTime(invoice.official_paypal?.last_synced_at)}</div>
                    <div className="mt-1">
                      QR: {invoice.official_paypal?.qr?.image_url_png ? 'Ready' : 'Not generated'}
                    </div>
                    <div className="mt-1">
                      Auto reminders: {invoice.summary.auto_reminders_cancelled_at ? 'Stopped' : 'Active'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onOpenDetail(invoice)}
                      className="mb-2 inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                    >
                      <Eye size={14} />
                      Details
                    </button>
                    <InvoiceActions
                      invoice={invoice}
                      busyAction={busyAction}
                      onRefresh={(item) =>
                        handleInvoiceAction('refresh', item, refreshInvoice, 'Invoice refreshed')
                      }
                      onReminder={(item) =>
                        handleInvoiceAction('remind', item, sendInvoiceReminder, 'Reminder sent')
                      }
                      onCancelReminders={handleInvoiceReminderCancellation}
                      onQr={(item) =>
                        handleInvoiceAction('qr', item, generateInvoiceQr, 'Official PayPal QR generated')
                      }
                      onCancel={handleInvoiceCancel}
                      onReviewRequired={handleMarkInvoiceReviewRequired}
                      onTimelineToggle={toggleInvoiceTimeline}
                      timelineOpen={invoiceTimelineId === invoice.internal_invoice_id}
                    />
                  </td>
                </tr>
                {invoiceTimelineId === invoice.internal_invoice_id && (
                  <tr
                    className="border-b bg-white"
                    style={isPayPalInvoiceWorkspace ? { borderColor: PAYPAL_BRAND.border } : undefined}
                  >
                    <td colSpan={6} className="px-6 py-5">
                      <TimelinePanel
                        title={`Invoice Timeline · ${invoice.summary.invoice_number}`}
                        loading={invoiceTimelineLoading}
                        entries={invoiceTimelineEntries}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {filteredInvoices.length === 0 && (
        <div className="px-6 py-10 text-center text-sm text-gray-500">No invoices yet.</div>
      )}
      <PaginationControls
        pagination={invoicePagination}
        onPrevious={onPreviousPage}
        onNext={onNextPage}
      />
    </div>
  );
}

export function PayoutRecordsTable({
  busyAction,
  filteredPayouts,
  handleCancelUnclaimedPayout,
  handlePayoutRefresh,
  isPayPalPayoutWorkspace,
  onNextPage,
  onOpenDetail,
  onPreviousPage,
  payoutPagination,
  payoutTimelineEntries,
  payoutTimelineId,
  payoutTimelineLoading,
  togglePayoutTimeline
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={isPayPalPayoutWorkspace ? { borderColor: PAYPAL_BRAND.border, boxShadow: '0 18px 40px rgba(0,48,135,0.06)' } : undefined}
    >
      <div className="overflow-x-auto">
        <table className={`w-full ${isPayPalPayoutWorkspace ? 'min-w-[860px]' : 'min-w-[1040px]'}`}>
          <thead
            className="border-b bg-gray-50"
            style={
              isPayPalPayoutWorkspace
                ? {
                    borderColor: PAYPAL_BRAND.border,
                    backgroundColor: PAYPAL_BRAND.shell
                  }
                : undefined
            }
          >
            <tr>
              {['Payout', 'Receiver', 'Amount', 'Risk', 'Provider State', 'Actions'].map((heading) => (
                <th key={heading} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredPayouts.map((payout) => (
              <Fragment key={payout.payout_id}>
                <tr
                  className="border-b align-top hover:bg-gray-50"
                  style={isPayPalPayoutWorkspace ? { borderColor: PAYPAL_BRAND.border } : undefined}
                >
                  <td className="px-6 py-4">
                    <div
                      className="font-semibold text-gray-900"
                      style={isPayPalPayoutWorkspace ? { color: PAYPAL_BRAND.ink } : undefined}
                    >
                      {payout.payout_id}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Batch: {payout.tracking?.sender_batch_id || 'Pending'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{payout.summary.receiver}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {payout.summary.amount} {payout.summary.currency}
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill
                      value={payout.risk_decision}
                      tone={
                        payout.risk_decision === 'APPROVED'
                          ? 'green'
                          : payout.risk_decision === 'BLOCKED'
                            ? 'red'
                            : 'amber'
                      }
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <StatusPill
                        value={payout.status}
                        tone={
                          payout.status === 'SUCCESS'
                            ? 'green'
                            : payout.status === 'FAILED' || payout.status === 'DENIED'
                              ? 'red'
                              : 'blue'
                        }
                      />
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Provider item: {payout.official_paypal?.provider_item_status || payout.metadata?.provider_item_status || 'Unknown'}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Synced: {formatDateTime(payout.official_paypal?.last_synced_at || payout.metadata?.last_synced_at)}
                    </div>
                    {payout.official_paypal?.provider_issue_code && (
                      <div className="mt-1 text-xs text-amber-700">
                        Issue code: {payout.official_paypal.provider_issue_code}
                      </div>
                    )}
                    {payout.official_paypal?.remediation?.reason && (
                      <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {payout.official_paypal.remediation.reason}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onOpenDetail(payout)}
                      className="mb-2 inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                    >
                      <Eye size={14} />
                      Details
                    </button>
                    <PayoutActions
                      payout={payout}
                      busyAction={busyAction}
                      onRefresh={handlePayoutRefresh}
                      onCancelUnclaimed={handleCancelUnclaimedPayout}
                      onTimelineToggle={togglePayoutTimeline}
                      timelineOpen={payoutTimelineId === payout.payout_id}
                    />
                  </td>
                </tr>
                {payoutTimelineId === payout.payout_id && (
                  <tr
                    className="border-b bg-white"
                    style={isPayPalPayoutWorkspace ? { borderColor: PAYPAL_BRAND.border } : undefined}
                  >
                    <td colSpan={6} className="px-6 py-5">
                      <TimelinePanel
                        title={`Payout Timeline · ${payout.payout_id}`}
                        loading={payoutTimelineLoading}
                        entries={payoutTimelineEntries}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {filteredPayouts.length === 0 && (
        <div className="px-6 py-10 text-center text-sm text-gray-500">No payouts yet.</div>
      )}
      <PaginationControls
        pagination={payoutPagination}
        onPrevious={onPreviousPage}
        onNext={onNextPage}
      />
    </div>
  );
}
