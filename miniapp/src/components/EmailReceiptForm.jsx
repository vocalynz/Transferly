import React from 'react';

const defaultProviders = ['Gmail', 'Yahoo', 'Outlook', 'iCloud'];
const brandedProviders = [
  'PayPal',
  'Stripe',
  'Paystack',
  'Flutterwave',
  'Crypto Commerce',
  'Binance',
  'Coinbase',
  'Bybit',
  'Crypto.com',
  'Wise',
  'Cash App',
  'Zelle',
  'Venmo',
  'Trust Wallet',
  'GCash'
];

export default function EmailReceiptForm({ data, onChange }) {
  const providerOptions = [...new Set([...defaultProviders, ...brandedProviders, data.provider].filter(Boolean))];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
      {/* From Section */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-4">FROM</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              From Name *
            </label>
            <input
              type="text"
              value={data.fromName}
              onChange={(e) => onChange('fromName', e.target.value)}
              placeholder="John Doe"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              From Email *
            </label>
            <input
              type="email"
              value={data.fromEmail}
              onChange={(e) => onChange('fromEmail', e.target.value)}
              placeholder="john@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email Provider
            </label>
            <select
              value={data.provider}
              onChange={(e) => onChange('provider', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* To Section */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-4">TO</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              To Name *
            </label>
            <input
              type="text"
              value={data.toName}
              onChange={(e) => onChange('toName', e.target.value)}
              placeholder="Jane Smith"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              To Email *
            </label>
            <input
              type="email"
              value={data.toEmail}
              onChange={(e) => onChange('toEmail', e.target.value)}
              placeholder="jane@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Subject *
        </label>
        <input
          type="text"
          value={data.subject}
          onChange={(e) => onChange('subject', e.target.value)}
          placeholder="Invoice #123 - Payment Receipt"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Email Body */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Email Body
        </label>
        <textarea
          value={data.body}
          onChange={(e) => onChange('body', e.target.value)}
          placeholder="Dear Customer,&#10;&#10;Thank you for your payment. Please find the receipt details below.&#10;&#10;Best regards"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          rows={6}
        />
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Date
          </label>
          <input
            type="date"
            value={data.date}
            onChange={(e) => onChange('date', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Time
          </label>
          <input
            type="time"
            value={data.time}
            onChange={(e) => onChange('time', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>
    </div>
  );
}
