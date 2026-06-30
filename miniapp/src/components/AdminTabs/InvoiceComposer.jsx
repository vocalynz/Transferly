import { ExternalLink, Plus, QrCode, Send, Trash2 } from 'lucide-react';
import { DetailRow, StatusPill } from './PaymentsParts';
import {
  PAYPAL_BRAND,
  calculateLineItemSubtotalCents,
  formatCents,
  parseMoneyToCents
} from './paymentsUtils';

export default function InvoiceComposerSection({
  brand,
  busyAction,
  invoiceComposer,
  invoiceDraftCurrency,
  invoiceDraftItems,
  invoiceDraftTotalCents,
  invoicePreview,
  invoiceTemplates,
  isPayPalInvoiceWorkspace,
  lastCreatedInvoice,
  onAddLineItem,
  onFieldChange,
  onLineItemChange,
  onRemoveLineItem,
  onReset,
  onSubmit,
  onViewRecords,
  sectionRef,
  selectedInvoiceTemplate
}) {
  return (
    <div ref={sectionRef} className="grid scroll-mt-28 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div
        className="rounded-2xl border bg-white p-6 shadow-sm"
        style={isPayPalInvoiceWorkspace ? { borderColor: PAYPAL_BRAND.border, boxShadow: '0 20px 44px rgba(0,48,135,0.06)' } : undefined}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-bold" style={{ color: isPayPalInvoiceWorkspace ? PAYPAL_BRAND.ink : undefined }}>
              Quick Create Official Invoice
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Create and send a real PayPal invoice from this workspace using a saved template or manual line items.
            </p>
          </div>
          <button
            onClick={onReset}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Recipient Email</label>
            <input
              type="email"
              value={invoiceComposer.recipientEmail}
              onChange={(event) => onFieldChange('recipientEmail', event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              placeholder="buyer@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Template</label>
            <select
              value={invoiceComposer.templateId}
              onChange={(event) => onFieldChange('templateId', event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            >
              <option value="">No template</option>
              {invoiceTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} · {template.currency_code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Issue Date</label>
            <input
              type="date"
              value={invoiceComposer.issueDate}
              onChange={(event) => onFieldChange('issueDate', event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Due Date</label>
            <input
              type="date"
              value={invoiceComposer.dueDate}
              onChange={(event) => onFieldChange('dueDate', event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={invoiceComposer.description}
            onChange={(event) => onFieldChange('description', event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            placeholder="Optional note that appears on the official invoice."
          />
        </div>

        {selectedInvoiceTemplate ? (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-900">{selectedInvoiceTemplate.name}</p>
                <p className="mt-1 text-xs text-gray-600">
                  {selectedInvoiceTemplate.description || 'Template-backed PayPal invoice'}
                </p>
              </div>
              <StatusPill
                value={selectedInvoiceTemplate.is_active ? 'ACTIVE' : 'INACTIVE'}
                tone={selectedInvoiceTemplate.is_active ? 'green' : 'gray'}
              />
            </div>
            <div className="mt-3 text-xs text-gray-600">
              {selectedInvoiceTemplate.line_items?.length || 0} line items · {selectedInvoiceTemplate.currency_code} · Due in {selectedInvoiceTemplate.default_due_days ?? 'manual'} days
            </div>
            <div className="mt-3 divide-y divide-blue-100 rounded-lg bg-white">
              {(selectedInvoiceTemplate.line_items || []).map((item, index) => (
                <div key={`${selectedInvoiceTemplate.id}-preview-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <span className="font-semibold text-gray-700">{item.name || `Line item ${index + 1}`}</span>
                  <span className="text-gray-600">
                    {Number(item.quantity || 0)} x {formatCents(parseMoneyToCents(item.unitAmount), selectedInvoiceTemplate.currency_code)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 text-sm font-black text-gray-950">
                <span>Template total</span>
                <span>{formatCents(invoiceDraftTotalCents, invoiceDraftCurrency)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">Manual Line Items</p>
                <p className="mt-1 text-xs text-gray-500">
                  Use this when you do not want to rely on a stored template.
                </p>
              </div>
              <button
                onClick={onAddLineItem}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white"
              >
                <Plus size={14} />
                Item
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
                <input
                  value={invoiceComposer.currency}
                  onChange={(event) => onFieldChange('currency', event.target.value)}
                  maxLength={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-orange-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {invoiceComposer.items.map((item, index) => (
                <div key={`invoice-composer-line-${index}`} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      placeholder="Item name"
                      value={item.name}
                      onChange={(event) => onLineItemChange(index, 'name', event.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Unit amount"
                      value={item.unitAmount}
                      onChange={(event) => onLineItemChange(index, 'unitAmount', event.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Quantity"
                      value={item.quantity}
                      onChange={(event) => onLineItemChange(index, 'quantity', event.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    />
                    <input
                      placeholder="Item description"
                      value={item.description}
                      onChange={(event) => onLineItemChange(index, 'description', event.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <div className="mr-auto text-xs font-semibold text-gray-500">
                      Subtotal: {formatCents(calculateLineItemSubtotalCents(item), invoiceDraftCurrency)}
                    </div>
                    <button
                      onClick={() => onRemoveLineItem(index)}
                      disabled={invoiceComposer.items.length === 1}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={onSubmit}
            disabled={busyAction === 'create-invoice'}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: isPayPalInvoiceWorkspace ? PAYPAL_BRAND.blue : brand }}
          >
            <Send size={16} className={busyAction === 'create-invoice' ? 'animate-pulse' : ''} />
            Create Official Invoice
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div
          className="rounded-2xl border bg-white p-5 shadow-sm"
          style={isPayPalInvoiceWorkspace ? { borderColor: PAYPAL_BRAND.border } : undefined}
        >
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Draft Preview</p>
          <div className="mt-4 space-y-3">
            <DetailRow label="Recipient" value={invoiceComposer.recipientEmail || 'Add recipient email'} />
            <DetailRow
              label="Template"
              value={selectedInvoiceTemplate ? selectedInvoiceTemplate.name : 'Manual line items'}
            />
            <DetailRow label="Line Items" value={`${invoiceDraftItems.length} item${invoiceDraftItems.length === 1 ? '' : 's'}`} />
            <DetailRow
              label="Draft Total"
              value={
                invoicePreview
                  ? `${invoicePreview.total} ${invoicePreview.currency}`
                  : formatCents(invoiceDraftTotalCents, invoiceDraftCurrency)
              }
            />
            <DetailRow label="Risk Path" value={invoicePreview?.risk_decision || 'Preview pending'} />
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">
              PayPal will create the hosted invoice link after you confirm submission.
            </div>
          </div>
        </div>

        {lastCreatedInvoice ? (
          <div
            className="rounded-2xl border p-5 shadow-sm"
            style={{
              borderColor: PAYPAL_BRAND.border,
              background: isPayPalInvoiceWorkspace
                ? 'linear-gradient(180deg, rgba(0,156,222,0.08), rgba(255,255,255,1))'
                : undefined
            }}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: isPayPalInvoiceWorkspace ? PAYPAL_BRAND.blue : undefined }}>
              Last Created
            </p>
            <p className="mt-3 text-lg font-black tracking-[-0.03em]" style={{ color: isPayPalInvoiceWorkspace ? PAYPAL_BRAND.ink : undefined }}>
              {lastCreatedInvoice.summary?.invoice_number || lastCreatedInvoice.invoice_id}
            </p>
            <div className="mt-2 text-sm text-slate-600">
              {lastCreatedInvoice.summary?.recipient_email}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {lastCreatedInvoice.summary?.amount} {lastCreatedInvoice.summary?.currency}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {lastCreatedInvoice.invoice_link ? (
                <a
                  href={lastCreatedInvoice.invoice_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <ExternalLink size={14} />
                  Open PayPal
                </a>
              ) : null}
              <button
                onClick={onViewRecords}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-white"
              >
                <QrCode size={14} />
                View In Records
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
