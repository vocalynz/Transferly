import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Search, Wallet, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/DashboardLayout';
import { useAppContext } from '../context/AppContext';
import { getServiceBySlug } from '../lib/servicesCatalog';

const statusMeta = {
  pending: { label: 'Pending', icon: Clock3, color: '#f59e0b' },
  awaiting_confirmation: { label: 'Awaiting confirmation', icon: Clock3, color: '#0ea5e9' },
  completed: { label: 'Completed', icon: CheckCircle2, color: '#10b981' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: '#ef4444' }
};

export default function OrdersPage() {
  const { config, topUpOrders, updateTopUpOrderStatus } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const brand = config?.brand_color || '#f8812d';

  const filteredOrders = useMemo(() => topUpOrders
    .filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }

      const query = searchTerm.trim().toLowerCase();
      if (!query) {
        return true;
      }

      return (
        order.amount_label?.toLowerCase().includes(query) ||
        order.method_title?.toLowerCase().includes(query) ||
        order.service_intent?.toLowerCase().includes(query) ||
        order.status?.toLowerCase().includes(query)
      );
    })
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at)), [searchTerm, statusFilter, topUpOrders]);

  const counts = useMemo(() => ({
    total: topUpOrders.length,
    pending: topUpOrders.filter((order) => order.status === 'pending').length,
    awaiting: topUpOrders.filter((order) => order.status === 'awaiting_confirmation').length,
    completed: topUpOrders.filter((order) => order.status === 'completed').length
  }), [topUpOrders]);

  const markPaid = async (orderId) => {
    const result = await updateTopUpOrderStatus(orderId, 'awaiting_confirmation');
    if (!result.success) {
      toast.error(result.message || 'Unable to update order');
      return;
    }
    toast.success('Order marked as awaiting confirmation');
  };

  const cancelOrder = async (orderId) => {
    const result = await updateTopUpOrderStatus(orderId, 'cancelled');
    if (!result.success) {
      toast.error(result.message || 'Unable to cancel order');
      return;
    }
    toast.success('Order cancelled');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 px-4 py-5 md:px-8 md:py-8">
        <section className="rounded-[8px] bg-white p-6 shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                <Wallet size={14} />
                Funding orders
              </div>
              <h1 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">Orders</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                Track top-up requests, submit payment confirmation, and return to the funding desk when an order needs attention.
              </p>
            </div>
            <Link
              to="/buy-point"
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
              style={{ backgroundColor: brand }}
            >
              Buy Points
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              { label: 'Total', value: counts.total },
              { label: 'Pending', value: counts.pending },
              { label: 'Awaiting', value: counts.awaiting },
              { label: 'Completed', value: counts.completed }
            ].map((stat) => (
              <div key={stat.label} className="rounded-[8px] bg-[#f8f7f3] px-4 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{stat.label}</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[8px] border border-[#e9e0d2] bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.04)]">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Search orders</span>
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search method, service, status, or amount"
                  className="w-full rounded-[8px] border border-[#e6ddd0] bg-[#faf7f1] py-3 pl-11 pr-4 text-sm text-slate-950 outline-none transition focus:border-[#f2c39a]"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-[8px] border border-[#e6ddd0] bg-[#faf7f1] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#f2c39a]"
              >
                <option value="all">All orders</option>
                <option value="pending">Pending</option>
                <option value="awaiting_confirmation">Awaiting confirmation</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-[#e1d7c8] bg-white px-6 py-14 text-center">
              <Wallet size={48} className="mx-auto text-slate-300" />
              <h2 className="mt-4 text-2xl font-black text-slate-950">No orders found</h2>
              <p className="mt-2 text-sm text-slate-600">Create a funding order from the Buy Points page.</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const meta = statusMeta[order.status] || statusMeta.pending;
              const Icon = meta.icon;
              const service = getServiceBySlug(order.service_intent || '');

              return (
                <article key={order.order_id} className="rounded-[8px] border border-[#e9e0d2] bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em]"
                          style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
                        >
                          <Icon size={13} />
                          {meta.label}
                        </span>
                        {service ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                            {service.title}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-3 text-2xl font-black text-slate-950">{order.amount_label}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{order.method_title}</p>
                      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                        <div className="rounded-[8px] bg-[#f8f7f3] px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Created</p>
                          <p className="mt-1 font-bold text-slate-950">{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                        <div className="rounded-[8px] bg-[#f8f7f3] px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Points</p>
                          <p className="mt-1 font-bold text-slate-950">{Number(order.points || 0).toLocaleString()}</p>
                        </div>
                        <div className="rounded-[8px] bg-[#f8f7f3] px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Order ID</p>
                          <p className="mt-1 truncate font-bold text-slate-950">{order.order_id}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 lg:justify-end">
                      {order.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => markPaid(order.order_id)}
                            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                            style={{ backgroundColor: brand }}
                          >
                            I Have Paid
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelOrder(order.order_id)}
                            className="inline-flex items-center justify-center rounded-full border border-[#e6ddd0] bg-[#faf7f1] px-5 py-3 text-sm font-black text-slate-700 transition hover:border-[#f2c39a]"
                          >
                            Cancel
                          </button>
                        </>
                      ) : null}
                      <Link
                        to={order.service_intent ? `/buy-point?intent=${order.service_intent}` : '/buy-point'}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-[#e6ddd0] bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-[#f2c39a]"
                      >
                        Funding Desk
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
