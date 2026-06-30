import React, { useMemo, useRef, useState } from 'react';
import { Search, Download, Eye, FileText, X, ArrowRight, CalendarRange, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/DashboardLayout';
import { useAppContext } from '../context/AppContext';
import BankSlipPreview from '../components/BankSlipPreview';
import EmailReceiptPreview from '../components/EmailReceiptPreview';

function receiptSummary(receipt) {
  const data = receipt.data || receipt;

  if (receipt.type === 'bank') {
    return {
      title: `${data.senderName || 'Sender'} to ${data.receiverName || 'Receiver'}`,
      meta: data.transactionRef || receipt.id?.slice(0, 8),
      amount: `NGN ${Number(data.amount || 0).toLocaleString()}`,
      status: data.status || 'Successful'
    };
  }

  return {
    title: data.subject || 'Notification receipt',
    meta: `${data.fromEmail || 'From'} -> ${data.toEmail || 'To'}`,
    amount: 'Notification',
    status: 'Sent'
  };
}

function topUpSummary(order) {
  return {
    title: order.amount_label || `${Number(order.points || 0).toLocaleString()} pts`,
    meta: order.method_title || 'Funding order',
    amount: `${Number(order.points || 0).toLocaleString()} pts`,
    status: order.status || 'pending'
  };
}

export default function HistoryPage() {
  const { receipts, config, topUpOrders } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const previewRef = useRef(null);
  const brand = config?.brand_color || '#f8812d';

  const filteredActivities = useMemo(() => {
    const receiptActivities = receipts.map((receipt) => ({ kind: 'receipt', created_at: receipt.created_at || receipt.createdAt, record: receipt }));
    const orderActivities = topUpOrders.map((order) => ({ kind: 'topup', created_at: order.created_at, record: order }));

    return [...receiptActivities, ...orderActivities]
      .filter((activity) => {
        if (typeFilter !== 'all') {
          if (typeFilter === 'bank' && !(activity.kind === 'receipt' && activity.record.type === 'bank')) {
            return false;
          }
          if (typeFilter === 'email' && !(activity.kind === 'receipt' && activity.record.type === 'email')) {
            return false;
          }
          if (typeFilter === 'topup' && activity.kind !== 'topup') {
            return false;
          }
        }

        const activityDate = new Date(activity.created_at);
        if (dateFrom && activityDate < new Date(dateFrom)) {
          return false;
        }

        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          if (activityDate > end) {
            return false;
          }
        }

        const query = searchTerm.toLowerCase().trim();
        if (!query) {
          return true;
        }

        if (activity.kind === 'topup') {
          return (
            activity.record.method_title?.toLowerCase().includes(query) ||
            activity.record.status?.toLowerCase().includes(query) ||
            activity.record.amount_label?.toLowerCase().includes(query)
          );
        }

        const receipt = activity.record;
        const data = receipt.data || receipt;
        if (receipt.type === 'bank') {
          return (
            data.senderName?.toLowerCase().includes(query) ||
            data.receiverName?.toLowerCase().includes(query) ||
            data.transactionRef?.toLowerCase().includes(query)
          );
        }

        return (
          data.fromName?.toLowerCase().includes(query) ||
          data.toName?.toLowerCase().includes(query) ||
          data.subject?.toLowerCase().includes(query)
        );
      })
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
  }, [receipts, topUpOrders, searchTerm, typeFilter, dateFrom, dateTo]);

  const openModal = (receipt) => {
    setSelectedReceipt(receipt);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedReceipt(null);
  };

  const downloadReceipt = async (format) => {
    if (!previewRef.current) {
      toast.error('Preview not found');
      return;
    }

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);
      const canvas = await html2canvas(previewRef.current, { scale: 2, useCORS: true });
      if (format === 'png') {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `receipt_${Date.now()}.png`;
        link.click();
        toast.success('Downloaded as PNG');
        return;
      }

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`receipt_${Date.now()}.pdf`);
      toast.success('Downloaded as PDF');
    } catch (_error) {
      toast.error('Failed to download');
    }
  };

  const stats = {
    total: receipts.length + topUpOrders.length,
    bank: receipts.filter((receipt) => receipt.type === 'bank').length,
    email: receipts.filter((receipt) => receipt.type === 'email').length,
    topup: topUpOrders.length
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="rounded-[32px] bg-[#121212] px-6 py-7 text-white shadow-[0_28px_80px_rgba(15,23,42,0.18)] md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
                <CalendarRange size={14} />
                Transactions
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] text-white md:text-5xl">
                Track every generated receipt in one place.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70 md:text-base">
                Search by sender, subject, or reference, then reopen any receipt and export it again without leaving your dashboard.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'All receipts', value: stats.total },
                { label: 'Wallet records', value: stats.bank },
                { label: 'Notifications', value: stats.email },
                { label: 'Funding orders', value: stats.topup }
              ].map((item) => (
                <div key={item.label} className="rounded-[24px] border border-white/8 bg-white/6 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">{item.label}</p>
                  <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[30px] border border-[#e9e0d2] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
          <div className="mb-5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
            <Filter size={14} />
            Filter transactions
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))]">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Search</span>
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by sender, receiver, subject, or reference"
                  className="w-full rounded-2xl border border-[#e6ddd0] bg-[#faf7f1] py-3 pl-11 pr-4 text-sm text-slate-950 outline-none transition focus:border-[#f2c39a]"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Type</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="w-full rounded-2xl border border-[#e6ddd0] bg-[#faf7f1] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#f2c39a]"
              >
                <option value="all">All activity</option>
                <option value="bank">Wallet record</option>
                <option value="email">Notification</option>
                <option value="topup">Top up order</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-2xl border border-[#e6ddd0] bg-[#faf7f1] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#f2c39a]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-2xl border border-[#e6ddd0] bg-[#faf7f1] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#f2c39a]"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {filteredActivities.length === 0 ? (
            <div className="rounded-[30px] border border-dashed border-[#e4dacb] bg-white px-6 py-14 text-center shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
              <FileText size={58} className="mx-auto text-slate-300" />
              <h2 className="mt-5 text-2xl font-black tracking-[-0.04em] text-slate-950">No transactions found</h2>
              <p className="mt-2 text-sm text-slate-600">
                Try a different filter or generate a new service output first.
              </p>
              <Link
                to="/services"
                className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white"
                style={{ backgroundColor: brand }}
              >
                Explore Services
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            filteredActivities.map((activity) => {
              const isTopUp = activity.kind === 'topup';
              const receipt = isTopUp ? null : activity.record;
              const order = isTopUp ? activity.record : null;
              const data = receipt ? (receipt.data || receipt) : null;
              const summary = isTopUp ? topUpSummary(order) : receiptSummary(receipt);
              const statusAccent = (
                summary.status === 'Successful' ||
                summary.status === 'Sent' ||
                summary.status === 'completed'
              ) ? '#10b981' : (
                summary.status === 'awaiting_confirmation' || summary.status === 'pending' ? '#f59e0b' : '#ef4444'
              );

              return (
                <div
                  key={isTopUp ? order.order_id : receipt.id}
                  className="rounded-[28px] border border-[#e9e0d2] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(15,23,42,0.08)] md:p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]"
                          style={{
                            backgroundColor: `${brand}18`,
                            color: brand
                          }}
                        >
                          {isTopUp ? 'Top up order' : receipt.type === 'bank' ? 'Wallet record' : 'Notification'}
                        </span>
                        <span
                          className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]"
                          style={{
                            backgroundColor: `${statusAccent}18`,
                            color: statusAccent
                          }}
                        >
                          {summary.status}
                        </span>
                      </div>

                      <h2 className="mt-4 truncate text-2xl font-black tracking-[-0.04em] text-slate-950">
                        {summary.title}
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">{summary.meta}</p>

                      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                        <div className="rounded-2xl bg-[#faf7f1] px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Created</p>
                          <p className="mt-1 font-bold text-slate-950">
                            {new Date(activity.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-[#faf7f1] px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                            {isTopUp ? 'Method' : receipt.type === 'bank' ? 'Amount' : 'Provider'}
                          </p>
                          <p className="mt-1 font-bold text-slate-950">
                            {isTopUp ? order.method_title : receipt.type === 'bank' ? summary.amount : data.provider || 'Gmail'}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-[#faf7f1] px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                            {isTopUp ? 'Intent' : receipt.type === 'bank' ? 'Reference' : 'Recipient'}
                          </p>
                          <p className="mt-1 truncate font-bold text-slate-950">
                            {isTopUp ? (order.service_intent || 'General balance') : receipt.type === 'bank' ? data.transactionRef : data.toEmail || data.toName || 'Recipient'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 lg:justify-end">
                      {isTopUp ? (
                        <Link
                          to={order.service_intent ? `/buy-point?intent=${order.service_intent}` : '/buy-point'}
                          className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                          style={{ backgroundColor: brand }}
                        >
                          Continue Order
                          <ArrowRight size={16} />
                        </Link>
                      ) : (
                        <>
                          <button
                            onClick={() => openModal(receipt)}
                            className="inline-flex items-center gap-2 rounded-full border border-[#e6ddd0] bg-[#faf7f1] px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-[#f2c39a] hover:text-slate-950"
                          >
                            <Eye size={16} />
                            View
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReceipt(receipt);
                              setTimeout(() => downloadReceipt('png'), 100);
                            }}
                            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                            style={{ backgroundColor: brand }}
                          >
                            <Download size={16} />
                            Download
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {modalOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[30px] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#efe5d6] bg-white px-6 py-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Transaction preview</p>
                <h3 className="mt-1 text-xl font-black tracking-[-0.04em] text-slate-950">
                  {selectedReceipt.type === 'bank' ? 'Wallet Record' : 'Notification'}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e6ddd0] bg-[#faf7f1] text-slate-500 transition hover:text-slate-950"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div ref={previewRef} className="rounded-[24px] bg-[#f7f4ed] p-4">
                {selectedReceipt.type === 'bank' ? (
                  <BankSlipPreview data={selectedReceipt.data || selectedReceipt} />
                ) : (
                  <EmailReceiptPreview data={selectedReceipt.data || selectedReceipt} />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#efe5d6] px-6 py-5 sm:flex-row">
              <button
                onClick={() => downloadReceipt('png')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[#e6ddd0] bg-[#faf7f1] px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-[#f2c39a] hover:text-slate-950"
              >
                <Download size={16} />
                PNG
              </button>
              <button
                onClick={() => downloadReceipt('pdf')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[#e6ddd0] bg-[#faf7f1] px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-[#f2c39a] hover:text-slate-950"
              >
                <Download size={16} />
                PDF
              </button>
              <button
                onClick={closeModal}
                className="inline-flex flex-1 items-center justify-center rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                style={{ backgroundColor: brand }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
