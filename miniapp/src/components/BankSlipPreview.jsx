import React from 'react';
import { Check, X } from 'lucide-react';

const BANK_COLORS = {
  'GTBank': '#00B4D8',
  'Access Bank': '#00A651',
  'First Bank': '#003DA5',
  'Zenith Bank': '#E4001B',
  'UBA': '#F39200',
  'Fidelity Bank': '#E31937',
  'Stanbic IBTC': '#004B93',
  'Union Bank': '#0066CC',
  'Polaris Bank': '#6B0080',
  'Wema Bank': '#FF6B00',
  'Sterling Bank': '#FF0000',
  Opay: '#16a34a',
  Kuda: '#7c3aed',
  Palmpay: '#15803d'
};

export default function BankSlipPreview({ data }) {
  const bankColor = BANK_COLORS[data.senderBank] || '#000000';
  const isSuccessful = data.status === 'Successful';

  return (
    <div className="bg-white rounded-lg overflow-hidden">
      {/* Bank Header */}
      <div
        className="px-6 py-4 text-white"
        style={{ backgroundColor: bankColor }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold opacity-80">Bank</p>
            <p className="text-lg font-bold">{data.senderBank || 'Select Bank'}</p>
          </div>
          <div className="text-3xl">🏦</div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          {isSuccessful ? (
            <>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Check size={20} className="text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-600">Transaction Successful</p>
                <p className="text-xs text-gray-500">Transfer completed</p>
              </div>
            </>
          ) : data.status === 'Pending' ? (
            <>
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
              </div>
              <div>
                <p className="font-semibold text-yellow-600">Transaction Pending</p>
                <p className="text-xs text-gray-500">Processing...</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <X size={20} className="text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-red-600">Transaction Failed</p>
                <p className="text-xs text-gray-500">Transfer declined</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Transaction Details */}
      <div className="px-6 py-4 space-y-4">
        {/* Amount */}
        <div className="border-b border-gray-200 pb-4">
          <p className="text-xs text-gray-500 font-semibold mb-1">AMOUNT TRANSFERRED</p>
          <p className="text-3xl font-bold text-gray-900">
            ₦{data.amount ? parseInt(data.amount).toLocaleString() : '0'}
          </p>
        </div>

        {/* From */}
        <div className="border-b border-gray-200 pb-4">
          <p className="text-xs text-gray-500 font-semibold mb-2">FROM</p>
          <div className="space-y-1">
            <p className="font-semibold text-gray-900">{data.senderName || 'N/A'}</p>
            <p className="text-sm text-gray-600">{data.senderBank || 'Select Bank'}</p>
            <p className="text-sm font-mono text-gray-600">{data.senderAccount || '****'}</p>
          </div>
        </div>

        {/* To */}
        <div className="border-b border-gray-200 pb-4">
          <p className="text-xs text-gray-500 font-semibold mb-2">TO</p>
          <div className="space-y-1">
            <p className="font-semibold text-gray-900">{data.receiverName || 'N/A'}</p>
            <p className="text-sm text-gray-600">{data.receiverBank || 'Select Bank'}</p>
            <p className="text-sm font-mono text-gray-600">{data.receiverAccount || '****'}</p>
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4 border-b border-gray-200 pb-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-1">DATE</p>
            <p className="font-semibold text-gray-900">
              {data.transactionDate ? new Date(data.transactionDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              }) : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-1">TIME</p>
            <p className="font-semibold text-gray-900">{data.transactionTime || 'N/A'}</p>
          </div>
        </div>

        {/* Reference Numbers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-1">REFERENCE</p>
            <p className="font-mono text-sm text-gray-900 break-all">{data.transactionRef || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-1">SESSION ID</p>
            <p className="font-mono text-sm text-gray-900">{data.sessionId || 'N/A'}</p>
          </div>
        </div>

        {/* Narration */}
        {data.narration && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 font-semibold mb-2">DESCRIPTION</p>
            <p className="text-sm text-gray-700">{data.narration}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-500">Powered by Transferly</p>
      </div>
    </div>
  );
}
