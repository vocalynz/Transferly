import {
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  ShieldX
} from 'lucide-react';
import { StatusPill } from './PaymentsParts';
import { PAYPAL_BRAND, formatDateTime, getTopUpOrderTone } from './paymentsUtils';

export function WorkspaceControls({
  brand,
  busyAction,
  fetchAdminTopUpOrders,
  fetchInvoiceReminderConfigurations,
  fetchInvoiceTemplates,
  fetchInvoices,
  fetchPaymentIssues,
  fetchPayouts,
  isPayPalEmbeddedWorkspace,
  isPayPalInvoiceWorkspace,
  isPayPalPayoutWorkspace,
  isStripePayoutWorkspace,
  onRefreshAll,
  payoutQuery,
  providerFilter,
  sectionLinks,
  activeSection,
  workspaceDescription,
  workspaceTitle,
  onSectionJump,
  toast
}) {
  return (
    <div
      className="rounded-2xl border bg-white p-6 shadow-sm"
      style={isPayPalEmbeddedWorkspace ? { borderColor: PAYPAL_BRAND.border } : undefined}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3
            className="text-xl font-bold"
            style={{ color: isPayPalEmbeddedWorkspace ? PAYPAL_BRAND.ink : undefined }}
          >
            {workspaceTitle}
          </h3>
          <p className="mt-1 text-sm text-gray-500">{workspaceDescription}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() =>
              Promise.all([
                fetchInvoices(),
                fetchPayouts(payoutQuery),
                fetchAdminTopUpOrders(),
                fetchInvoiceReminderConfigurations(),
                fetchInvoiceTemplates(),
                fetchPaymentIssues()
              ]).then(() => toast.success('Payments refreshed'))
            }
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Refresh Lists
          </button>
          <button
            onClick={onRefreshAll}
            disabled={busyAction === 'reconciliation'}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: isPayPalEmbeddedWorkspace ? PAYPAL_BRAND.blue : brand }}
          >
            <RotateCcw size={16} className={busyAction === 'reconciliation' ? 'animate-spin' : ''} />
            Run Reconciliation
          </button>
        </div>
      </div>

      <div
        className="mt-5 rounded-2xl border p-4"
        style={{
          borderColor: PAYPAL_BRAND.border,
          background: isPayPalEmbeddedWorkspace
            ? `linear-gradient(135deg, rgba(0,48,135,0.10), rgba(255,255,255,1))`
            : 'linear-gradient(135deg,rgba(0,48,135,0.08),rgba(255,255,255,1))'
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: PAYPAL_BRAND.blue }}>
              Official {providerFilter === 'stripe' ? 'Stripe' : providerFilter === 'crypto' ? 'Crypto' : 'PayPal'} Workflow
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {isStripePayoutWorkspace
                ? 'Select a connected account, preview transfer readiness, request approval, and process Stripe payouts from this operational surface.'
                : isPayPalPayoutWorkspace
                  ? 'Request, review, refresh, and remediate payouts from the same PayPal-branded operational surface.'
                  : isPayPalInvoiceWorkspace
                    ? 'Create, send, remind, sync, and manage official invoices from the same PayPal-branded operational surface.'
                  : 'Deep-link into the exact operational surface you need instead of scanning the entire admin panel.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sectionLinks.map(({ id, label, icon: Icon }) => {
              const selected = activeSection === id;
              return (
                <button
                  key={id}
                  onClick={() => onSectionJump(id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${
                    selected
                      ? 'text-white'
                      : 'bg-white text-slate-700'
                  }`}
                  style={
                    selected
                      ? {
                          borderColor: PAYPAL_BRAND.blue,
                          backgroundColor: PAYPAL_BRAND.blue
                        }
                      : {
                          borderColor: PAYPAL_BRAND.border,
                          color: isPayPalEmbeddedWorkspace ? PAYPAL_BRAND.ink : undefined
                        }
                  }
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FundingOrdersPanel({
  adminTopUpOrders,
  busyAction,
  onComplete,
  onCancel,
  sectionRef
}) {
  return (
    <div ref={sectionRef} className="scroll-mt-28 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Funding Orders</h3>
          <p className="text-sm text-gray-500">
            Review user point purchases before ledger credit is released.
          </p>
        </div>
        <p className="text-sm text-gray-500">{adminTopUpOrders.length} tracked orders</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                {['Order', 'User', 'Funding Method', 'Points', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adminTopUpOrders.map((order) => {
                const closed = ['completed', 'cancelled'].includes(order.status);

                return (
                  <tr key={order.order_id} className="border-b border-gray-100 align-top hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{order.order_id}</div>
                      <div className="mt-1 text-xs text-gray-500">Created: {formatDateTime(order.created_at)}</div>
                      {order.submitted_at && (
                        <div className="mt-1 text-xs text-amber-700">
                          Submitted: {formatDateTime(order.submitted_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{order.user_id || order.userId}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="font-medium text-gray-900">{order.method_title || 'Manual funding'}</div>
                      <div className="mt-1 text-xs text-gray-500">{order.service_intent || 'General balance'}</div>
                      {order.vendor_url && (
                        <a
                          href={order.vendor_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
                        >
                          <ExternalLink size={13} />
                          Open funding link
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {Number(order.points || 0).toLocaleString()} pts
                      <div className="mt-1 text-xs font-normal text-gray-500">{order.amount_label}</div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill value={(order.status || 'pending').replaceAll('_', ' ')} tone={getTopUpOrderTone(order.status)} />
                      {order.admin_notes && (
                        <div className="mt-2 text-xs text-gray-500">{order.admin_notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => onComplete(order)}
                          disabled={closed || Boolean(busyAction)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          Complete
                        </button>
                        <button
                          onClick={() => onCancel(order)}
                          disabled={closed || Boolean(busyAction)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <ShieldX size={14} />
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {adminTopUpOrders.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-gray-500">No funding orders yet.</div>
        )}
      </div>
    </div>
  );
}

export function PaymentIssuesPanel({
  busyAction,
  isPayPalEmbeddedWorkspace,
  issueNotes,
  onIssueAction,
  paymentIssues,
  sectionRef,
  setIssueNotes
}) {
  return (
    <div ref={sectionRef} className="scroll-mt-28 space-y-4">
      <div className="flex items-center justify-between">
        <h3
          className="text-lg font-bold text-gray-900"
          style={isPayPalEmbeddedWorkspace ? { color: PAYPAL_BRAND.ink } : undefined}
        >
          Payment Issues
        </h3>
        <p className="text-sm text-gray-500">{paymentIssues.length} tracked operational issues</p>
      </div>

      <div
        className="rounded-2xl border bg-white p-6 shadow-sm"
        style={isPayPalEmbeddedWorkspace ? { borderColor: PAYPAL_BRAND.border, boxShadow: '0 16px 40px rgba(0,48,135,0.06)' } : undefined}
      >
        {paymentIssues.length === 0 ? (
          <div className="text-sm text-gray-500">No open issues from reconciliation or provider sync.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {paymentIssues.map((issue) => (
              <div
                key={issue.payment_issue_id}
                className="rounded-xl border p-4"
                style={
                  isPayPalEmbeddedWorkspace
                    ? {
                        borderColor: PAYPAL_BRAND.border,
                        background: 'linear-gradient(180deg, rgba(244,248,255,0.9), rgba(255,255,255,1))'
                      }
                    : undefined
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p
                      className="text-sm font-semibold text-gray-900"
                      style={isPayPalEmbeddedWorkspace ? { color: PAYPAL_BRAND.ink } : undefined}
                    >
                      {issue.summary}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {issue.entity_type} · {issue.entity_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill value={issue.severity} tone={issue.severity === 'HIGH' ? 'red' : 'amber'} />
                    <StatusPill value={issue.status} tone={issue.status === 'OPEN' ? 'red' : 'green'} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>Type: {issue.issue_type}</span>
                  <span>Last Seen: {formatDateTime(issue.last_seen_at)}</span>
                </div>
                {(issue.acknowledgement?.acknowledged_at || issue.resolution?.resolved_at) && (
                  <div className="mt-3 space-y-1 text-xs text-gray-500">
                    {issue.acknowledgement?.acknowledged_at && (
                      <div>
                        Acknowledged: {formatDateTime(issue.acknowledgement.acknowledged_at)}
                        {issue.acknowledgement.acknowledged_by_actor_id
                          ? ` · ${issue.acknowledgement.acknowledged_by_actor_id}`
                          : ''}
                      </div>
                    )}
                    {issue.resolution?.resolved_at && (
                      <div>
                        Resolved: {formatDateTime(issue.resolution.resolved_at)}
                        {issue.resolution.resolved_by_actor_id ? ` · ${issue.resolution.resolved_by_actor_id}` : ''}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Operator Note
                  </label>
                  <textarea
                    value={issueNotes[issue.payment_issue_id] || ''}
                    onChange={(event) =>
                      setIssueNotes((previous) => ({
                        ...previous,
                        [issue.payment_issue_id]: event.target.value
                      }))
                    }
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    placeholder="Add an acknowledgement or resolution note"
                  />
                </div>
                {issue.metadata && Object.keys(issue.metadata).length > 0 && (
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
                    {JSON.stringify(issue.metadata, null, 2)}
                  </pre>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {issue.status !== 'ACKNOWLEDGED' && issue.status !== 'RESOLVED' && (
                    <button
                      onClick={() => onIssueAction(issue, 'acknowledge')}
                      disabled={Boolean(busyAction)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <MessageSquare size={14} />
                      Acknowledge
                    </button>
                  )}
                  {issue.status !== 'RESOLVED' && (
                    <button
                      onClick={() => onIssueAction(issue, 'resolve')}
                      disabled={Boolean(busyAction)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      Resolve
                    </button>
                  )}
                  {issue.status === 'RESOLVED' && (
                    <button
                      onClick={() => onIssueAction(issue, 'reopen')}
                      disabled={Boolean(busyAction)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <RotateCcw size={14} />
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
