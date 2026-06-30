import React from 'react';
import { RefreshCw } from 'lucide-react';

function generateTransactionRef() {
  return 'TRX' + Math.random().toString(36).substring(2, 14).toUpperCase();
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default function BankSlipForm({ data, onChange, banks }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sender Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Sender Name *
          </label>
          <input
            type="text"
            value={data.senderName}
            onChange={(e) => onChange('senderName', e.target.value)}
            placeholder="John Doe"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            style={{ focusRingColor: '#f8812d' }}
          />
        </div>

        {/* Sender Account */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Sender Account Number *
          </label>
          <input
            type="text"
            value={data.senderAccount}
            onChange={(e) => onChange('senderAccount', e.target.value)}
            placeholder="0123456789"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Sender Bank */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Sender Bank
          </label>
          <select
            value={data.senderBank}
            onChange={(e) => onChange('senderBank', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {banks.map((bank) => (
              <option key={bank} value={bank}>
                {bank}
              </option>
            ))}
          </select>
        </div>

        {/* Receiver Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Receiver Name *
          </label>
          <input
            type="text"
            value={data.receiverName}
            onChange={(e) => onChange('receiverName', e.target.value)}
            placeholder="Jane Smith"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Receiver Account */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Receiver Account Number *
          </label>
          <input
            type="text"
            value={data.receiverAccount}
            onChange={(e) => onChange('receiverAccount', e.target.value)}
            placeholder="9876543210"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Receiver Bank */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Receiver Bank
          </label>
          <select
            value={data.receiverBank}
            onChange={(e) => onChange('receiverBank', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {banks.map((bank) => (
              <option key={bank} value={bank}>
                {bank}
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Amount (NGN) *
          </label>
          <input
            type="number"
            value={data.amount}
            onChange={(e) => onChange('amount', e.target.value)}
            placeholder="50000"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Status
          </label>
          <select
            value={data.status}
            onChange={(e) => onChange('status', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="Successful">Successful</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Transaction Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Transaction Date
          </label>
          <input
            type="date"
            value={data.transactionDate}
            onChange={(e) => onChange('transactionDate', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Transaction Time
          </label>
          <input
            type="time"
            value={data.transactionTime}
            onChange={(e) => onChange('transactionTime', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Narration */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Narration/Description
        </label>
        <textarea
          value={data.narration}
          onChange={(e) => onChange('narration', e.target.value)}
          placeholder="Payment for invoice #123..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          rows={3}
        />
      </div>

      {/* Transaction Reference */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-gray-700">
            Transaction Reference
          </label>
          <button
            type="button"
            onClick={() => onChange('transactionRef', generateTransactionRef())}
            className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors"
            style={{ color: '#f8812d' }}
          >
            <RefreshCw size={14} />
            Regenerate
          </button>
        </div>
        <input
          type="text"
          value={data.transactionRef}
          onChange={(e) => onChange('transactionRef', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm"
        />
      </div>

      {/* Session ID */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-gray-700">
            Session ID
          </label>
          <button
            type="button"
            onClick={() => onChange('sessionId', generateSessionId())}
            className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors"
            style={{ color: '#f8812d' }}
          >
            <RefreshCw size={14} />
            Regenerate
          </button>
        </div>
        <input
          type="text"
          value={data.sessionId}
          onChange={(e) => onChange('sessionId', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm"
        />
      </div>
    </div>
  );
}
