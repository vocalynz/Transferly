import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Copy,
  FileText,
  Mail,
  Receipt,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { useTelegramMiniApp } from '../context/TelegramMiniAppContext';

const filters = [
  { key: 'all', label: 'All types' },
  { key: 'bank', label: 'Wallet' },
  { key: 'email', label: 'Notification' }
];

const statusFilters = [
  { key: 'all', label: 'All' },
  { key: 'successful', label: 'Successful' },
  { key: 'pending', label: 'Pending' },
  { key: 'processing', label: 'Processing' },
  { key: 'action-needed', label: 'Action Needed' },
  { key: 'failed', label: 'Failed' }
];

function generateTransactionRef() {
  return `TRX${Math.random().toString(36).substring(2, 14).toUpperCase()}`;
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function now() {
  return new Date().toTimeString().substring(0, 5);
}

function getReceiptDetails(receipt) {
  return receipt?.data?.details || receipt?.details || receipt?.data || receipt || {};
}

function getSummaryText(receipt) {
  if (typeof receipt?.summary === 'string') {
    return receipt.summary;
  }

  return receipt?.summary?.text || receipt?.title || 'Generated receipt';
}

function getReceiptKey(receipt) {
  return receipt?.id || receipt?.receipt_id || receipt?.created_at || receipt?.title || JSON.stringify(receipt);
}

function getReceiptType(receipt) {
  return receipt?.type === 'email' ? 'email' : 'bank';
}

function describeReceipt(receipt) {
  const details = getReceiptDetails(receipt);
  const type = getReceiptType(receipt);
  const createdAt = receipt?.created_at || receipt?.createdAt || '';

  if (type === 'email') {
    return {
      type,
      title: details.subject || receipt?.title || 'Notification receipt',
      meta: details.toEmail || details.to_email || receipt?.emailTo || 'No recipient email',
      amount: details.provider || 'Notification',
      status: 'Sent',
      createdAt,
      searchText: [
        details.subject,
        details.body,
        details.fromEmail,
        details.toEmail,
        details.provider,
        receipt?.title,
        getSummaryText(receipt)
      ].filter(Boolean).join(' ')
    };
  }

  return {
    type,
    title: details.receiverName
      ? `${details.senderName || 'Sender'} to ${details.receiverName}`
      : receipt?.title || 'Wallet record receipt',
    meta: details.transactionRef || details.sessionId || receipt?.id || 'No reference',
    amount: details.amount ? `${details.amount}` : 'Amount unavailable',
    status: details.status || 'Generated',
    createdAt,
    searchText: [
      details.senderName,
      details.receiverName,
      details.transactionRef,
      details.sessionId,
      details.narration,
      details.amount,
      receipt?.title,
      getSummaryText(receipt)
    ].filter(Boolean).join(' ')
  };
}

function normalizeStatus(status) {
  const value = String(status || 'generated').toLowerCase();

  if (value.includes('fail') || value.includes('reject') || value.includes('cancel')) {
    return 'failed';
  }

  if (value.includes('pending')) {
    return 'pending';
  }

  if (value.includes('action') || value.includes('review') || value.includes('attention')) {
    return 'action-needed';
  }

  if (value.includes('process') || value.includes('generat') || value.includes('await')) {
    return 'processing';
  }

  if (value.includes('sent') || value.includes('success') || value.includes('complete') || value.includes('save')) {
    return 'successful';
  }

  return 'successful';
}

function statusLabelFromKey(key) {
  return statusFilters.find((filter) => filter.key === key)?.label || 'Successful';
}

function buildDuplicatePayload(receipt) {
  const details = getReceiptDetails(receipt);
  const type = getReceiptType(receipt);

  if (type === 'email') {
    return {
      type: 'email',
      fromName: details.fromName || 'Transferly',
      fromEmail: details.fromEmail || 'receipts@transferly.app',
      toName: details.toName || 'Recipient',
      toEmail: details.toEmail || receipt?.emailTo || 'recipient@example.com',
      subject: details.subject || receipt?.title || 'Receipt copy',
      body: details.body || getSummaryText(receipt),
      date: today(),
      time: now(),
      provider: details.provider || 'Transferly'
    };
  }

  return {
    type: 'bank',
    senderName: details.senderName || 'Transferly',
    senderAccount: details.senderAccount || '',
    senderBank: details.senderBank || 'Transferly Wallet',
    receiverName: details.receiverName || 'Recipient',
    receiverAccount: details.receiverAccount || '',
    receiverBank: details.receiverBank || 'Bank',
    amount: details.amount || '',
    transactionDate: today(),
    transactionTime: now(),
    transactionRef: generateTransactionRef(),
    narration: details.narration || getSummaryText(receipt),
    sessionId: generateSessionId(),
    status: details.status || 'Successful'
  };
}

function buildShareText(receipt) {
  const details = describeReceipt(receipt);
  return [
    details.title,
    `Type: ${details.type === 'bank' ? 'Wallet record' : 'Notification'}`,
    `Amount: ${details.amount}`,
    `Reference: ${details.meta}`,
    `Status: ${details.status}`
  ].join('\n');
}

function StatPill({ label, value, icon: Icon }) {
  return (
    <div className="rounded-[22px] bg-[var(--tg-section-bg-color)] p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">
        <Icon size={14} />
        {label}
      </div>
      <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{value}</p>
    </div>
  );
}

function ReceiptRow({ receipt, selected, onSelect }) {
  const details = describeReceipt(receipt);
  const Icon = details.type === 'email' ? Mail : Receipt;
  const statusKey = normalizeStatus(details.status);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[24px] p-4 text-left shadow-sm transition active:scale-[0.99] ${
        selected
          ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]'
          : 'bg-[var(--tg-section-bg-color)] text-[var(--tg-text-color)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          selected ? 'bg-white/[0.16]' : 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-button-color)]'
        }`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="truncate text-sm font-black">{details.title}</h3>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
              selected ? 'bg-white/[0.16] text-white' : 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-hint-color)]'
            }`}>
              {details.type === 'bank' ? 'Wallet' : 'Notification'}
            </span>
          </div>
          <p className={`mt-1 truncate text-xs font-bold ${selected ? 'text-white/[0.76]' : 'text-[var(--tg-hint-color)]'}`}>
            {details.meta}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs font-black">
            <span>{details.amount}</span>
            <span>{statusLabelFromKey(statusKey)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function ReceiptDetail({ receipt, duplicating, onCopy, onDuplicate }) {
  if (!receipt) {
    return (
      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-6 text-center shadow-sm">
        <FileText size={42} className="mx-auto text-[var(--tg-hint-color)]" />
        <h2 className="mt-4 text-xl font-black text-[var(--tg-text-color)]">No receipt selected</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">
          Choose a receipt to preview details, copy its summary, or duplicate it as a fresh template.
        </p>
      </section>
    );
  }

  const details = describeReceipt(receipt);
  const rawDetails = getReceiptDetails(receipt);
  const rows = details.type === 'email'
    ? [
        ['Subject', rawDetails.subject || receipt.title || 'Receipt'],
        ['From', rawDetails.fromEmail || 'receipts@transferly.app'],
        ['To', rawDetails.toEmail || receipt.emailTo || 'recipient@example.com'],
        ['Provider', rawDetails.provider || 'Transferly']
      ]
    : [
        ['Sender', rawDetails.senderName || 'Transferly'],
        ['Receiver', rawDetails.receiverName || 'Recipient'],
        ['Reference', rawDetails.transactionRef || details.meta],
        ['Session', rawDetails.sessionId || 'Auto generated']
      ];

  return (
    <section className="overflow-hidden rounded-[30px] bg-[var(--tg-section-bg-color)] shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
      <div className="border-b border-black/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Selected receipt</p>
            <h2 className="mt-2 truncate text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{details.title}</h2>
            <p className="mt-1 truncate text-xs font-bold text-[var(--tg-hint-color)]">{details.createdAt ? new Date(details.createdAt).toLocaleString() : 'Generated receipt'}</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]">
            <BadgeCheck size={22} />
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-4">
          <p className="text-xs font-bold text-[var(--tg-hint-color)]">Amount or label</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--tg-text-color)]">{details.amount}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
              <p className="text-xs font-bold text-[var(--tg-hint-color)]">{label}</p>
              <p className="mt-2 truncate text-sm font-black text-[var(--tg-text-color)]">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
          <p className="text-xs font-bold text-[var(--tg-hint-color)]">Summary</p>
          <p className="mt-2 line-clamp-4 text-sm font-semibold leading-6 text-[var(--tg-text-color)]">{getSummaryText(receipt)}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onDuplicate}
            disabled={duplicating}
            className="flex items-center justify-center gap-2 rounded-[18px] bg-[var(--tg-button-color)] px-4 py-3 text-sm font-black text-[var(--tg-button-text-color)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {duplicating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Duplicate as template
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center justify-center gap-2 rounded-[18px] bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-sm font-black text-[var(--tg-text-color)]"
          >
            <Copy size={16} />
            Copy summary
          </button>
        </div>
      </div>
    </section>
  );
}

export default function MiniAppReceiptVault() {
  const navigate = useNavigate();
  const { addReceipt, receipts } = useAppContext();
  const telegram = useTelegramMiniApp();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [selectedKey, setSelectedKey] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  const filteredReceipts = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();

    return receipts
      .filter((receipt) => {
        const details = describeReceipt(receipt);
        if (typeFilter !== 'all' && details.type !== typeFilter) {
          return false;
        }

        if (statusFilter !== 'all' && normalizeStatus(details.status) !== statusFilter) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return details.searchText.toLowerCase().includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftDate = new Date(left.created_at || left.createdAt || 0).getTime();
        const rightDate = new Date(right.created_at || right.createdAt || 0).getTime();
        return sortOrder === 'oldest' ? leftDate - rightDate : rightDate - leftDate;
      });
  }, [query, receipts, sortOrder, statusFilter, typeFilter]);

  const selectedReceipt = filteredReceipts.find((receipt) => getReceiptKey(receipt) === selectedKey) || filteredReceipts[0] || null;
  const stats = {
    total: receipts.length,
    statuses: statusFilters.reduce((counts, filter) => {
      if (filter.key === 'all') {
        return { ...counts, all: receipts.length };
      }

      return {
        ...counts,
        [filter.key]: receipts.filter((receipt) => normalizeStatus(describeReceipt(receipt).status) === filter.key).length
      };
    }, {})
  };
  const needsAttentionCount = ['pending', 'action-needed', 'failed']
    .reduce((total, key) => total + Number(stats.statuses[key] || 0), 0);

  useEffect(() => {
    if (!selectedReceipt) {
      setSelectedKey('');
      return;
    }

    setSelectedKey(getReceiptKey(selectedReceipt));
  }, [selectedReceipt]);

  const selectReceipt = (receipt) => {
    setSelectedKey(getReceiptKey(receipt));
    telegram.impact('light');
  };

  const duplicateSelected = useCallback(async () => {
    if (!selectedReceipt || duplicating) {
      return;
    }

    setDuplicating(true);
    telegram.impact('medium');
    telegram.webApp?.MainButton?.showProgress?.();

    try {
      const result = await addReceipt(buildDuplicatePayload(selectedReceipt));
      if (result?.error) {
        toast.error(result.error);
        telegram.notify('error');
        return;
      }

      toast.success('Receipt duplicated');
      telegram.notify('success');
      setSelectedKey(getReceiptKey(result));
    } catch (_error) {
      toast.error('Failed to duplicate receipt');
      telegram.notify('error');
    } finally {
      setDuplicating(false);
      telegram.webApp?.MainButton?.hideProgress?.();
    }
  }, [addReceipt, duplicating, selectedReceipt, telegram]);

  const copySelected = async () => {
    if (!selectedReceipt) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildShareText(selectedReceipt));
      toast.success('Receipt summary copied');
      telegram.notify('success');
    } catch (_error) {
      toast.error('Unable to copy summary');
    }
  };

  const resetFilters = () => {
    setQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setSortOrder('newest');
  };

  const refreshTransactions = () => {
    resetFilters();
    telegram.impact('light');
    toast.success('Transactions refreshed');
  };

  useEffect(() => {
    const button = telegram.webApp?.MainButton;
    if (!button) {
      return undefined;
    }

    const handleClick = () => {
      if (selectedReceipt) {
        duplicateSelected();
        return;
      }
      navigate('/miniapp/studio');
    };

    button.setText?.(selectedReceipt ? 'Duplicate Receipt' : 'Open Studio');
    if (duplicating) {
      button.disable?.();
    } else {
      button.enable?.();
    }
    button.show?.();
    button.onClick?.(handleClick);

    return () => {
      button.offClick?.(handleClick);
      button.hideProgress?.();
      button.hide?.();
    };
  }, [duplicateSelected, duplicating, navigate, selectedReceipt, telegram.webApp]);

  return (
    <div className="space-y-4">
      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-3xl font-black tracking-[-0.05em] text-[var(--tg-text-color)]">Your transactions</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--tg-subtitle-text-color)]">
              Review your point purchases, service orders, and account activity.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshTransactions}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[18px] bg-[var(--tg-button-color)] px-5 text-sm font-black text-[var(--tg-button-text-color)] transition active:scale-[0.99]"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatPill label="All time" value={stats.total.toLocaleString()} icon={Receipt} />
        <StatPill label="Successful" value={Number(stats.statuses.successful || 0).toLocaleString()} icon={FileText} />
        <StatPill label="Needs attention" value={needsAttentionCount.toLocaleString()} icon={Mail} />
      </div>

      <section className="rounded-[26px] bg-[var(--tg-section-bg-color)] p-4 shadow-sm">
        <div>
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--tg-hint-color)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, type, or ID"
              className="w-full rounded-[20px] border border-black/5 bg-[var(--tg-secondary-bg-color)] py-3 pl-11 pr-4 text-sm font-bold text-[var(--tg-text-color)] outline-none transition placeholder:text-[var(--tg-hint-color)] focus:border-[var(--tg-button-color)]"
              aria-label="Search transactions"
            />
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="h-12 rounded-[18px] border border-black/5 bg-[var(--tg-secondary-bg-color)] px-4 text-sm font-black text-[var(--tg-text-color)] outline-none focus:border-[var(--tg-button-color)]"
            aria-label="Filter transaction type"
          >
            {filters.map((filter) => (
              <option key={filter.key} value={filter.key}>{filter.label}</option>
            ))}
          </select>
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            className="h-12 rounded-[18px] border border-black/5 bg-[var(--tg-secondary-bg-color)] px-4 text-sm font-black text-[var(--tg-text-color)] outline-none focus:border-[var(--tg-button-color)]"
            aria-label="Sort transactions"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {statusFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setStatusFilter(filter.key)}
              className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-black transition active:scale-[0.99] ${
                statusFilter === filter.key
                  ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]'
                  : 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-hint-color)]'
              }`}
            >
              {filter.label} {Number(stats.statuses[filter.key] || 0).toLocaleString()}
            </button>
          ))}
        </div>
      </section>

      {receipts.length === 0 ? (
        <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-8 text-center shadow-sm">
          <FileText size={48} className="mx-auto text-[var(--tg-hint-color)]" />
          <h2 className="mt-5 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">No transactions yet</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--tg-subtitle-text-color)]">
            Once you start using Transferly, your activity will appear here.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
          <div className="space-y-3">
            {filteredReceipts.length ? filteredReceipts.map((receipt) => (
              <ReceiptRow
                key={getReceiptKey(receipt)}
                receipt={receipt}
                selected={selectedReceipt && getReceiptKey(selectedReceipt) === getReceiptKey(receipt)}
                onSelect={() => selectReceipt(receipt)}
              />
            )) : (
              <div className="rounded-[24px] bg-[var(--tg-section-bg-color)] p-6 text-center shadow-sm">
                <Search size={34} className="mx-auto text-[var(--tg-hint-color)]" />
                <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">No matching receipts</p>
                <button type="button" onClick={resetFilters} className="mt-3 rounded-full bg-[var(--tg-secondary-bg-color)] px-4 py-2 text-xs font-black text-[var(--tg-text-color)]">
                  Reset filters
                </button>
              </div>
            )}
          </div>

          <ReceiptDetail
            receipt={selectedReceipt}
            duplicating={duplicating}
            onCopy={copySelected}
            onDuplicate={duplicateSelected}
          />
        </div>
      )}
    </div>
  );
}
