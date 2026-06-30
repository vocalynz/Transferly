import { Plus, X } from 'lucide-react';
import {
  BUILT_IN_INVOICE_SAVED_VIEWS,
  BUILT_IN_PAYOUT_SAVED_VIEWS,
  PAYPAL_BRAND
} from './paymentsUtils';

export function InvoiceFilters({
  customInvoiceSavedViews,
  filteredInvoices,
  invoiceDateFrom,
  invoiceDateTo,
  invoicePageSize,
  invoicePagination,
  invoiceProviderSearch,
  invoiceSavedViewName,
  invoiceSearch,
  invoiceSortBy,
  invoiceSortDirection,
  invoiceStatusFilter,
  invoiceStatusOptions,
  invoiceTemplateFilter,
  invoiceTemplates,
  invoices,
  isPayPalInvoiceWorkspace,
  onApplySavedView,
  onDeleteSavedView,
  onSaveSavedView,
  setInvoiceDateFrom,
  setInvoiceDateTo,
  setInvoicePageSize,
  setInvoiceProviderSearch,
  setInvoiceSavedViewName,
  setInvoiceSearch,
  setInvoiceSortBy,
  setInvoiceSortDirection,
  setInvoiceStatusFilter,
  setInvoiceTemplateFilter
}) {
  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3
            className="text-lg font-bold text-gray-900"
            style={isPayPalInvoiceWorkspace ? { color: PAYPAL_BRAND.ink } : undefined}
          >
            Invoices
          </h3>
          <p className="text-sm text-gray-500">
            {filteredInvoices.length} shown
            {invoicePagination?.total ? ` of ${invoicePagination.total}` : ` of ${invoices.length}`} official invoice records
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <input
            value={invoiceSearch}
            onChange={(event) => setInvoiceSearch(event.target.value)}
            placeholder="Recipient or number"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
          />
          <input
            value={invoiceProviderSearch}
            onChange={(event) => setInvoiceProviderSearch(event.target.value)}
            placeholder="PayPal invoice ID"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
          />
          <select
            value={invoiceStatusFilter}
            onChange={(event) => setInvoiceStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
          >
            {invoiceStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All statuses' : status}
              </option>
            ))}
          </select>
          <select
            value={invoiceTemplateFilter}
            onChange={(event) => setInvoiceTemplateFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            aria-label="Invoice template"
          >
            <option value="ALL">All templates</option>
            {invoiceTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={invoiceDateFrom}
            onChange={(event) => setInvoiceDateFrom(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            aria-label="Invoice date from"
          />
          <input
            type="date"
            value={invoiceDateTo}
            onChange={(event) => setInvoiceDateTo(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            aria-label="Invoice date to"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={invoiceSortBy}
              onChange={(event) => setInvoiceSortBy(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              aria-label="Invoice sort field"
            >
              <option value="createdAt">Created</option>
              <option value="updatedAt">Updated</option>
              <option value="amount">Amount</option>
              <option value="recipient">Recipient</option>
              <option value="status">Status</option>
              <option value="dueDate">Due</option>
            </select>
            <select
              value={invoiceSortDirection}
              onChange={(event) => setInvoiceSortDirection(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              aria-label="Invoice sort direction"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
          <select
            value={invoicePageSize}
            onChange={(event) => setInvoicePageSize(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            aria-label="Invoice page size"
          >
            <option value="25">25 rows</option>
            <option value="50">50 rows</option>
            <option value="100">100 rows</option>
            <option value="250">250 rows</option>
          </select>
        </div>
      </div>

      <SavedViewBar
        builtInViews={BUILT_IN_INVOICE_SAVED_VIEWS}
        customViews={customInvoiceSavedViews}
        inputValue={invoiceSavedViewName}
        inputPlaceholder="Save current invoice view"
        onApply={onApplySavedView}
        onDelete={onDeleteSavedView}
        onInputChange={setInvoiceSavedViewName}
        onSave={onSaveSavedView}
      />

      {isPayPalInvoiceWorkspace ? (
        <div
          className="rounded-2xl border p-4"
          style={{
            borderColor: PAYPAL_BRAND.border,
            background: 'linear-gradient(180deg, rgba(0,156,222,0.06), rgba(255,255,255,1))'
          }}
        >
          <div className="flex flex-wrap gap-2">
            {[
              'PAID: payment completed',
              'SENT: customer link active',
              'UPDATED: invoice changed after send',
              'CANCELLED: invoice voided',
              'QR Ready: official QR generated'
            ].map((item) => (
              <div
                key={item}
                className="inline-flex rounded-full border bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                style={{ borderColor: PAYPAL_BRAND.border, color: PAYPAL_BRAND.blue }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PayoutFilters({
  customPayoutSavedViews,
  filteredPayouts,
  isPayPalPayoutWorkspace,
  payoutDateFrom,
  payoutDateTo,
  payoutPageSize,
  payoutPagination,
  payoutProviderFilter,
  payoutProviderOptions,
  payoutSavedViewName,
  payoutSearch,
  payoutSortBy,
  payoutSortDirection,
  payoutStatusFilter,
  payoutStatusOptions,
  payouts,
  onApplySavedView,
  onDeleteSavedView,
  onSaveSavedView,
  setPayoutDateFrom,
  setPayoutDateTo,
  setPayoutPageSize,
  setPayoutProviderFilter,
  setPayoutSavedViewName,
  setPayoutSearch,
  setPayoutSortBy,
  setPayoutSortDirection,
  setPayoutStatusFilter
}) {
  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3
            className="text-lg font-bold text-gray-900"
            style={isPayPalPayoutWorkspace ? { color: PAYPAL_BRAND.ink } : undefined}
          >
            {isPayPalPayoutWorkspace ? 'Activity' : 'Payouts'}
          </h3>
          <p className="text-sm text-gray-500">
            {filteredPayouts.length} shown
            {payoutPagination?.total ? ` of ${payoutPagination.total}` : ` of ${payouts.length}`} tracked payout records
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input
            value={payoutSearch}
            onChange={(event) => setPayoutSearch(event.target.value)}
            placeholder="Recipient, payout, batch"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
          />
          <select
            value={payoutStatusFilter}
            onChange={(event) => setPayoutStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
          >
            {payoutStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All internal statuses' : status}
              </option>
            ))}
          </select>
          <select
            value={payoutProviderFilter}
            onChange={(event) => setPayoutProviderFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
          >
            {payoutProviderOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All provider states' : status}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={payoutDateFrom}
            onChange={(event) => setPayoutDateFrom(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            aria-label="Payout date from"
          />
          <input
            type="date"
            value={payoutDateTo}
            onChange={(event) => setPayoutDateTo(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            aria-label="Payout date to"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={payoutSortBy}
              onChange={(event) => setPayoutSortBy(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              aria-label="Payout sort field"
            >
              <option value="createdAt">Created</option>
              <option value="updatedAt">Updated</option>
              <option value="amount">Amount</option>
              <option value="receiver">Receiver</option>
              <option value="status">Status</option>
            </select>
            <select
              value={payoutSortDirection}
              onChange={(event) => setPayoutSortDirection(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              aria-label="Payout sort direction"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
          <select
            value={payoutPageSize}
            onChange={(event) => setPayoutPageSize(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            aria-label="Payout page size"
          >
            <option value="25">25 rows</option>
            <option value="50">50 rows</option>
            <option value="100">100 rows</option>
            <option value="250">250 rows</option>
          </select>
        </div>
      </div>

      <SavedViewBar
        builtInViews={BUILT_IN_PAYOUT_SAVED_VIEWS}
        customViews={customPayoutSavedViews}
        inputValue={payoutSavedViewName}
        inputPlaceholder="Save current payout view"
        onApply={onApplySavedView}
        onDelete={onDeleteSavedView}
        onInputChange={setPayoutSavedViewName}
        onSave={onSaveSavedView}
      />

      {isPayPalPayoutWorkspace ? (
        <div
          className="rounded-2xl border bg-white p-4"
          style={{
            borderColor: PAYPAL_BRAND.border,
            boxShadow: '0 14px 34px rgba(0,20,53,0.05)'
          }}
        >
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-black" style={{ color: PAYPAL_BRAND.ink }}>Provider states</p>
            <p className="text-xs font-semibold" style={{ color: PAYPAL_BRAND.muted }}>
              PayPal sandbox item statuses mapped into the payout queue
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'PENDING: provider processing',
              'UNCLAIMED: can be cancelled',
              'ONHOLD: provider review',
              'RETURNED: funds sent back',
              'SUCCESS: recipient paid'
            ].map((item) => (
              <div
                key={item}
                className="inline-flex rounded-full border bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                style={{ borderColor: PAYPAL_BRAND.border, color: PAYPAL_BRAND.actionBlue }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function SavedViewBar({
  builtInViews,
  customViews,
  inputPlaceholder,
  inputValue,
  onApply,
  onDelete,
  onInputChange,
  onSave
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {builtInViews.map((view) => (
        <button
          key={view.id}
          onClick={() => onApply(view.id)}
          className="inline-flex rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
        >
          {view.label}
        </button>
      ))}
      {customViews.map((view) => (
        <span key={view.id} className="inline-flex overflow-hidden rounded-full border border-blue-200 bg-blue-50">
          <button
            type="button"
            onClick={() => onApply(view.id)}
            className="px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100"
          >
            {view.label}
          </button>
          <button
            type="button"
            onClick={() => onDelete(view.id)}
            className="border-l border-blue-200 px-2 text-blue-700 hover:bg-blue-100"
            aria-label={`Delete ${view.label}`}
          >
            <X size={13} />
          </button>
        </span>
      ))}
      <div className="flex min-w-[240px] overflow-hidden rounded-full border border-gray-300 bg-white">
        <input
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={inputPlaceholder}
          className="min-w-0 flex-1 px-3 py-1.5 text-xs font-semibold text-gray-700 outline-none"
        />
        <button
          type="button"
          onClick={onSave}
          className="inline-flex items-center gap-1 border-l border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
        >
          <Plus size={13} />
          Save
        </button>
      </div>
    </div>
  );
}
