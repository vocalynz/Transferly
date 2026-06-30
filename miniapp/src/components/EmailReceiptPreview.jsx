import React from 'react';

const PROVIDER_COLORS = {
  Gmail: '#EA4335',
  Yahoo: '#7630BE',
  Outlook: '#0078D4',
  iCloud: '#555',
  PayPal: '#003087',
  Binance: '#f59e0b',
  Coinbase: '#2563eb',
  Bybit: '#111827',
  'Crypto.com': '#1d4ed8',
  Wise: '#14b8a6',
  'Cash App': '#16a34a',
  Zelle: '#6d28d9',
  Venmo: '#1d4ed8',
  'Trust Wallet': '#2563eb',
  GCash: '#0ea5e9'
};

export default function EmailReceiptPreview({ data }) {
  const providerColor = PROVIDER_COLORS[data.provider] || '#0078D4';

  return (
    <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
      {/* Email Header */}
      <div className="border-b border-gray-200" style={{ backgroundColor: `${providerColor}10` }}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold" style={{ color: providerColor }}>{data.provider}</div>
            <div className="text-xs text-gray-500">
              {data.date ? new Date(data.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }) : 'N/A'} {data.time || '00:00'}
            </div>
          </div>

          {/* Subject */}
          <div className="mb-3">
            <p className="text-sm font-semibold text-gray-900 break-words">
              {data.subject || '(No subject)'}
            </p>
          </div>

          {/* From/To Info */}
          <div className="border-t border-gray-200 pt-3 space-y-2 text-xs">
            <div>
              <p className="text-gray-500">From:</p>
              <p className="font-medium text-gray-900">
                {data.fromName || 'Sender'} &lt;{data.fromEmail || 'sender@example.com'}&gt;
              </p>
            </div>
            <div>
              <p className="text-gray-500">To:</p>
              <p className="font-medium text-gray-900">
                {data.toName || 'Recipient'} &lt;{data.toEmail || 'recipient@example.com'}&gt;
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Email Body */}
      <div className="px-4 py-4">
        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
          {data.body || '(No message content)'}
        </div>
      </div>

      {/* Signature/Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-500">Powered by Transferly</p>
      </div>
    </div>
  );
}
