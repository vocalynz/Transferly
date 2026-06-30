import { Activity, ChevronRight, FileText, Home, Plus, RotateCcw, Send, Wallet } from 'lucide-react';
import { DetailRow, StatusPill } from './PaymentsParts';
import { PAYPAL_BRAND, formatCents, formatCurrencyMajor, getTopUpOrderTone } from './paymentsUtils';

const PAYOUT_SANDBOX_ACTIVITY_LINKS = ['All Transactions', 'All Reports', 'Business Overview'];

export default function PayPalSandboxPayoutChrome({
  adminTopUpOrders,
  busyAction,
  filteredPayouts,
  onNavigate,
  onOpenPayoutDetail,
  onPayoutComposerFieldChange,
  onPayoutComposerSubmit,
  onRefreshAll,
  onResetPayoutComposer,
  paymentIssues,
  payoutComposer,
  payoutImpactPreview,
  payoutSandboxStatus,
  payoutSandboxView,
  payoutSandboxWallet,
  walletCurrency
}) {
  const payoutSandboxNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'send', label: 'Send and Request', icon: Send },
    { id: 'sales', label: 'Sales', icon: FileText },
    { id: 'finance', label: 'Finance', icon: Wallet }
  ];

  return (
    <div className="grid min-h-[calc(100vh-6rem)] bg-white lg:grid-cols-[244px_minmax(0,1fr)]">
      <aside
        className="border-b px-3 py-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r"
        style={{ borderColor: '#e6eef8', backgroundColor: '#f5f7fa' }}
      >
        <div className="px-6 text-3xl font-black tracking-[-0.05em]" style={{ color: '#001c64' }}>
          PayPal
        </div>
        <button
          type="button"
          onClick={() => onNavigate('send')}
          className="ml-6 mt-8 inline-flex h-10 items-center gap-2 rounded-full bg-black px-5 text-sm font-black text-white"
        >
          <Plus size={18} />
          Create
        </button>

        <nav className="mt-8 space-y-1">
          {payoutSandboxNavItems.map(({ id, label, icon: Icon }) => {
            const selected = payoutSandboxView === id;
            return (
              <div key={id}>
                <button
                  type="button"
                  onClick={() => onNavigate(id)}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base font-semibold"
                  style={{
                    backgroundColor: selected ? '#cfe3ff' : 'transparent',
                    color: '#001435'
                  }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon size={18} />
                    <span className="truncate">{label}</span>
                  </span>
                  {['activity', 'sales', 'finance'].includes(id) ? <ChevronRight size={17} /> : null}
                </button>
                {id === 'activity' && selected ? (
                  <div className="mt-1 space-y-1 pl-12 pr-3">
                    {PAYOUT_SANDBOX_ACTIVITY_LINKS.map((link) => (
                      <button
                        key={link}
                        type="button"
                        onClick={() => onNavigate('activity')}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-semibold"
                        style={{ color: '#001435' }}
                      >
                        <span>{link}</span>
                        <span className="text-slate-300">*</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0 bg-white">
        <div className="sticky top-0 z-10 border-b bg-white px-6 py-4" style={{ borderColor: '#e6eef8' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold" style={{ color: PAYPAL_BRAND.ink }}>
                PayPal sandbox account
              </span>
              <span
                className="rounded-full px-3 py-1 text-[11px] font-black uppercase"
                style={{ backgroundColor: '#eaf3ff', color: PAYPAL_BRAND.blue }}
              >
                Sandbox
              </span>
            </div>
            <button
              type="button"
              onClick={onRefreshAll}
              disabled={busyAction === 'reconciliation'}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-50"
              style={{ borderColor: '#c7d7ee', color: PAYPAL_BRAND.actionBlue }}
            >
              <RotateCcw size={16} className={busyAction === 'reconciliation' ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid min-h-[540px] lg:grid-cols-[minmax(0,1fr)_300px]">
          <main className="px-6 py-8 sm:px-8">
            <h2 className="text-2xl font-black" style={{ color: PAYPAL_BRAND.ink }}>
              {payoutSandboxView === 'activity'
                ? 'Activity'
                : payoutSandboxView === 'send'
                  ? 'Send and Request'
                  : payoutSandboxView === 'sales'
                    ? 'Sales'
                    : payoutSandboxView === 'finance'
                      ? 'Finance'
                      : 'Test Store'}
            </h2>

            {payoutSandboxView === 'home' ? (
              <>
                <div className="mt-16">
                  <div className="flex flex-wrap items-end gap-3">
                    <p className="text-5xl font-black leading-none xl:text-6xl" style={{ color: '#000000' }}>
                      ${formatCurrencyMajor(payoutSandboxWallet.availableCents)}
                    </p>
                    <p className="pb-2 text-2xl font-black" style={{ color: '#000000' }}>
                      {walletCurrency}
                    </p>
                  </div>
                  <p className="mt-3 text-base font-semibold" style={{ color: PAYPAL_BRAND.muted }}>
                    Available balance
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('finance')}
                    className="mt-5 inline-flex items-center gap-3 rounded-full border px-5 py-2 text-sm font-black"
                    style={{ borderColor: '#c7d7ee', color: '#000000' }}
                  >
                    Manage money
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="mt-14 grid gap-4 md:grid-cols-3">
                  {[
                    ['Pending', payoutSandboxWallet.pendingCents],
                    ['On hold', payoutSandboxWallet.frozenCents],
                    ['Sent', payoutSandboxWallet.paidOutCents]
                  ].map(([label, cents]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onNavigate(label === 'Sent' ? 'activity' : 'finance')}
                      className="rounded-2xl border bg-white p-5 text-left shadow-sm"
                      style={{ borderColor: '#e6eef8' }}
                    >
                      <p className="text-sm font-bold" style={{ color: PAYPAL_BRAND.muted }}>{label}</p>
                      <p className="mt-3 text-xl font-black" style={{ color: PAYPAL_BRAND.ink }}>
                        {formatCents(cents, walletCurrency)}
                      </p>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {payoutSandboxView === 'send' ? (
              <div className="mt-8 max-w-3xl">
                <p className="text-4xl font-black leading-tight" style={{ color: '#000000' }}>
                  Send money from your PayPal balance.
                </p>
                <div className="mt-7 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-bold" style={{ color: PAYPAL_BRAND.ink }}>Receiver</label>
                    <input
                      value={payoutComposer.receiver}
                      onChange={(event) => onPayoutComposerFieldChange('receiver', event.target.value)}
                      className="w-full rounded-xl border border-[#c7d7ee] px-4 py-3 text-sm focus:border-[#0070e0] focus:outline-none"
                      placeholder="recipient@example.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-bold" style={{ color: PAYPAL_BRAND.ink }}>Recipient type</label>
                    <select
                      value={payoutComposer.recipientType}
                      onChange={(event) => onPayoutComposerFieldChange('recipientType', event.target.value)}
                      className="w-full rounded-xl border border-[#c7d7ee] px-4 py-3 text-sm focus:border-[#0070e0] focus:outline-none"
                    >
                      <option value="EMAIL">EMAIL</option>
                      <option value="PHONE">PHONE</option>
                      <option value="PAYPAL_ID">PAYPAL_ID</option>
                      <option value="STRIPE_ACCOUNT">STRIPE_ACCOUNT</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-bold" style={{ color: PAYPAL_BRAND.ink }}>Amount</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={payoutComposer.amount}
                      onChange={(event) => onPayoutComposerFieldChange('amount', event.target.value)}
                      className="w-full rounded-xl border border-[#c7d7ee] px-4 py-3 text-sm focus:border-[#0070e0] focus:outline-none"
                      placeholder="25.00"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-bold" style={{ color: PAYPAL_BRAND.ink }}>Currency</label>
                      <input
                        value={payoutComposer.currency}
                        onChange={(event) => onPayoutComposerFieldChange('currency', event.target.value)}
                        maxLength={3}
                        className="w-full rounded-xl border border-[#c7d7ee] px-4 py-3 text-sm uppercase focus:border-[#0070e0] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-bold" style={{ color: PAYPAL_BRAND.ink }}>Country</label>
                      <input
                        value={payoutComposer.receiverCountryCode}
                        onChange={(event) => onPayoutComposerFieldChange('receiverCountryCode', event.target.value)}
                        maxLength={2}
                        className="w-full rounded-xl border border-[#c7d7ee] px-4 py-3 text-sm uppercase focus:border-[#0070e0] focus:outline-none"
                        placeholder="US"
                      />
                    </div>
                  </div>
                </div>
                <textarea
                  value={payoutComposer.note}
                  onChange={(event) => onPayoutComposerFieldChange('note', event.target.value)}
                  rows={3}
                  className="mt-4 w-full rounded-xl border border-[#c7d7ee] px-4 py-3 text-sm focus:border-[#0070e0] focus:outline-none"
                  placeholder="Optional payout note"
                />
                <div className="mt-5 rounded-2xl border border-[#e6eef8] bg-[#f5f7fa] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: PAYPAL_BRAND.blue }}>
                    Review before you send
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <DetailRow label="Estimated fee" value={formatCents(payoutImpactPreview.feeCents, payoutImpactPreview.currency)} />
                    <DetailRow label="Total debit" value={formatCents(payoutImpactPreview.totalDebitCents, payoutImpactPreview.currency)} />
                    <DetailRow label="Review path" value={payoutImpactPreview.likelyReviewPath} />
                    <DetailRow
                      label="Balance impact"
                      value={`${formatCents(payoutImpactPreview.availableCents, payoutImpactPreview.currency)} -> ${formatCents(payoutImpactPreview.remainingAvailableCents, payoutImpactPreview.currency)}`}
                    />
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={onPayoutComposerSubmit}
                    disabled={busyAction === 'create-payout'}
                    className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-black text-white disabled:opacity-50"
                    style={{ backgroundColor: PAYPAL_BRAND.actionBlue }}
                  >
                    <Send size={16} className={busyAction === 'create-payout' ? 'animate-pulse' : ''} />
                    Send payout
                  </button>
                  <button
                    type="button"
                    onClick={onResetPayoutComposer}
                    className="rounded-full border border-[#c7d7ee] px-5 py-3 text-sm font-black"
                    style={{ color: PAYPAL_BRAND.actionBlue }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            ) : null}

            {payoutSandboxView === 'activity' ? (
              <div className="mt-8 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    ['Processing', payoutSandboxStatus.processing],
                    ['Manual review', payoutSandboxStatus.review],
                    ['Provider issues', payoutSandboxStatus.issues]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border bg-white p-5" style={{ borderColor: '#e6eef8' }}>
                      <p className="text-sm font-bold" style={{ color: PAYPAL_BRAND.muted }}>{label}</p>
                      <p className="mt-2 text-4xl font-black" style={{ color: '#000000' }}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {filteredPayouts.length === 0 ? (
                    <div className="rounded-2xl border border-[#e6eef8] bg-white p-6 text-sm font-semibold text-slate-500">
                      No payouts yet.
                    </div>
                  ) : (
                    filteredPayouts.map((payout) => (
                      <button
                        key={payout.payout_id}
                        type="button"
                        onClick={() => onOpenPayoutDetail(payout)}
                        className="w-full rounded-2xl border bg-white p-4 text-left transition hover:border-[#0070e0]"
                        style={{ borderColor: '#e6eef8' }}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-black" style={{ color: PAYPAL_BRAND.ink }}>
                              {payout.summary?.receiver || payout.payout_id}
                            </p>
                            <p className="mt-1 text-xs font-semibold" style={{ color: PAYPAL_BRAND.muted }}>
                              {payout.payout_id} · {payout.official_paypal?.provider_item_status || payout.metadata?.provider_item_status || 'Unknown'}
                            </p>
                          </div>
                          <div className="sm:text-right">
                            <p className="text-sm font-black" style={{ color: '#000000' }}>
                              {payout.summary?.amount || '--'} {payout.summary?.currency || ''}
                            </p>
                            <p className="mt-1 text-xs font-semibold" style={{ color: PAYPAL_BRAND.muted }}>
                              {payout.status}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {payoutSandboxView === 'sales' ? (
              <div className="mt-12 max-w-3xl">
                <p className="text-5xl font-black leading-tight" style={{ color: '#000000' }}>
                  Sales review
                </p>
                <p className="mt-4 text-base font-semibold leading-7" style={{ color: PAYPAL_BRAND.muted }}>
                  Funding orders appear below this sandbox Sales view when they need operator review.
                </p>
                <div className="mt-6 space-y-3">
                  {adminTopUpOrders.length === 0 ? (
                    <div className="rounded-2xl border border-[#e6eef8] bg-white p-5 text-sm font-semibold text-slate-500">
                      No funding orders need review.
                    </div>
                  ) : (
                    adminTopUpOrders.slice(0, 5).map((order) => (
                      <div key={order.order_id} className="rounded-2xl border border-[#e6eef8] bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-black" style={{ color: PAYPAL_BRAND.ink }}>{order.order_id}</p>
                            <p className="mt-1 text-xs font-semibold" style={{ color: PAYPAL_BRAND.muted }}>
                              {order.user_email || order.user_id || 'Unknown user'} · {order.method_title || 'Funding method'}
                            </p>
                          </div>
                          <StatusPill value={order.status} tone={getTopUpOrderTone(order.status)} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {payoutSandboxView === 'finance' ? (
              <div className="mt-10 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['Available', payoutSandboxWallet.availableCents],
                    ['Pending', payoutSandboxWallet.pendingCents],
                    ['Reserved', payoutSandboxWallet.frozenCents],
                    ['Paid out', payoutSandboxWallet.paidOutCents]
                  ].map(([label, cents]) => (
                    <div key={label} className="rounded-2xl border bg-white p-5" style={{ borderColor: '#e6eef8' }}>
                      <p className="text-sm font-bold" style={{ color: PAYPAL_BRAND.muted }}>{label}</p>
                      <p className="mt-3 text-3xl font-black" style={{ color: PAYPAL_BRAND.ink }}>
                        {formatCents(cents, walletCurrency)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {paymentIssues.length === 0 ? (
                    <div className="rounded-2xl border border-[#e6eef8] bg-white p-5 text-sm font-semibold text-slate-500">
                      No payment issues are open.
                    </div>
                  ) : (
                    paymentIssues.slice(0, 5).map((issue) => (
                      <div key={issue.payment_issue_id} className="rounded-2xl border border-[#e6eef8] bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-black" style={{ color: PAYPAL_BRAND.ink }}>
                              {issue.title || issue.issue_type || issue.payment_issue_id}
                            </p>
                            <p className="mt-1 text-xs font-semibold" style={{ color: PAYPAL_BRAND.muted }}>
                              {issue.description || issue.payment_issue_id}
                            </p>
                          </div>
                          <StatusPill value={issue.status || 'OPEN'} tone={issue.status === 'RESOLVED' ? 'green' : 'amber'} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </main>

          <aside className="border-t px-6 py-8 lg:border-l lg:border-t-0" style={{ borderColor: '#e6eef8' }}>
            <div className="rounded-[22px] border bg-white p-5" style={{ borderColor: '#e6eef8' }}>
              <p className="text-sm font-black" style={{ color: PAYPAL_BRAND.ink }}>
                PayPal balance
              </p>
              <p className="mt-3 text-4xl font-black" style={{ color: '#000000' }}>
                ${formatCurrencyMajor(payoutSandboxWallet.availableCents)}
              </p>
              <p className="mt-1 text-sm font-semibold" style={{ color: PAYPAL_BRAND.muted }}>
                {walletCurrency} available
              </p>
              <div className="mt-5 space-y-3">
                {[
                  ['Processing', payoutSandboxStatus.processing],
                  ['Review', payoutSandboxStatus.review],
                  ['Issues', payoutSandboxStatus.issues]
                ].map(([label, value]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onNavigate('activity')}
                    className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold"
                    style={{ color: PAYPAL_BRAND.ink }}
                  >
                    <span>{label}</span>
                    <span style={{ color: PAYPAL_BRAND.actionBlue }}>{value}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
