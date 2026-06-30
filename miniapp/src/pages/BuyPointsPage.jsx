import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Bitcoin, Building2, Clock3, ShieldCheck, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/DashboardLayout';
import { useAppContext } from '../context/AppContext';
import ServiceLogo from '../components/ServiceLogo';
import { getRecommendedPointPacks, getServiceBySlug, getServiceEstimatedCost } from '../lib/servicesCatalog';

const methods = [
  {
    id: 'bank-transfer',
    title: 'Bank Transfer (P2P)',
    subtitle: 'Best for NGN deposits',
    description: 'Fund through direct bank transfer to verified vendors and track release support from Telegram.',
    metrics: ['5-30 min', 'P2P', 'NGN only'],
    href: 'https://t.me/+DhQqLRVqOHpmMmQ0',
    icon: Building2,
    instructions: 'Create the order, send the transfer proof to Telegram, and wait for balance confirmation.'
  },
  {
    id: 'crypto-payment',
    title: 'Crypto Payment',
    subtitle: 'Automatic and instant',
    description: 'Use crypto-friendly settlement with a faster crediting flow once the transfer confirms.',
    metrics: ['Instant', 'Secure', 'Global'],
    href: 'https://t.me/+DhQqLRVqOHpmMmQ0',
    icon: Bitcoin,
    instructions: 'Create the order, confirm the wallet/amount with support, then submit the transaction hash.'
  }
];

export default function BuyPointsPage() {
  const {
    config,
    profile,
    topUpOrders,
    createTopUpOrder,
    updateTopUpOrderStatus
  } = useAppContext();
  const [searchParams] = useSearchParams();
  const brand = config?.brand_color || '#f8812d';
  const intentService = getServiceBySlug(searchParams.get('intent') || '');
  const suggestedCost = intentService ? getServiceEstimatedCost(intentService, config) : null;
  const suggestedPacks = intentService ? getRecommendedPointPacks(intentService, config) : [50, 100, 250, 500];
  const [selectedMethodId, setSelectedMethodId] = useState(methods[0].id);
  const [selectedPoints, setSelectedPoints] = useState(suggestedPacks[0] || 50);
  const [customPoints, setCustomPoints] = useState('');
  const selectedMethod = methods.find((method) => method.id === selectedMethodId) || methods[0];
  const latestOrder = topUpOrders[0] || null;

  const activePoints = customPoints ? Number(customPoints) : Number(selectedPoints);
  const amountLabel = `${activePoints.toLocaleString()} pts`;

  const statusCounts = useMemo(() => ({
    pending: topUpOrders.filter((order) => order.status === 'pending').length,
    awaiting: topUpOrders.filter((order) => order.status === 'awaiting_confirmation').length,
    completed: topUpOrders.filter((order) => order.status === 'completed').length
  }), [topUpOrders]);

  const createOrder = async () => {
    if (!activePoints || activePoints < 5) {
      toast.error('Choose at least 5 points');
      return;
    }

    const result = await createTopUpOrder({
      points: activePoints,
      amountLabel,
      methodId: selectedMethod.id,
      methodTitle: selectedMethod.title,
      serviceIntent: intentService?.slug || '',
      instructions: selectedMethod.instructions,
      vendorUrl: selectedMethod.href
    });

    if (!result.success) {
      toast.error(result.message || 'Unable to create order');
      return;
    }

    toast.success('Top-up order created');
  };

  const handleStatusChange = async (orderId, status, successMessage) => {
    const result = await updateTopUpOrderStatus(orderId, status);
    if (!result.success) {
      toast.error(result.message || 'Unable to update order');
      return;
    }
    toast.success(successMessage);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 px-4 py-5 md:px-8 md:py-8">
        <section className="rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_340px]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-orange-700">
                <Wallet size={14} />
                Buy Points
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 md:text-4xl">
                  {intentService ? `Top up for ${intentService.title}.` : 'Buy points and keep your services running.'}
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                  {intentService
                    ? `${intentService.title} sent you here. Create a funding order, pay with your preferred method, then return once the balance is released.`
                    : 'Create a funding order, pay the vendor, and track the order state from the same workspace.'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Current balance', value: `${(profile?.points || 0).toLocaleString()} pts` },
                  { label: 'Pending orders', value: statusCounts.pending.toString() },
                  { label: 'Awaiting confirmation', value: statusCounts.awaiting.toString() }
                ].map((item) => (
                  <div key={item.label} className="rounded-[22px] bg-[#f8f7f3] px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                    <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[#ece7dd] bg-[#f8f7f3] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Funding notes</p>
              <div className="mt-5 grid gap-3 text-sm text-slate-600">
                <div className="flex items-center gap-3">
                  <Clock3 size={16} />
                  Points are credited after vendor confirmation
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck size={16} />
                  Each order stays visible inside your account
                </div>
              </div>
              <a
                href={selectedMethod.href}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-[#ece7dd] bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:border-[#f2c39a]"
              >
                Open Telegram Vendor Chat
              </a>
            </div>
          </div>
        </section>

        {intentService ? (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className="rounded-[26px] border border-[#ece7dd] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="flex items-start gap-4">
                <ServiceLogo service={intentService} size="lg" />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Funding intent</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">{intentService.title}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{intentService.description}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-4">
                {suggestedPacks.map((pack, index) => (
                  <button
                    key={pack}
                    type="button"
                    onClick={() => {
                      setSelectedPoints(pack);
                      setCustomPoints('');
                    }}
                    className={`rounded-[22px] border px-4 py-4 text-left transition ${
                      activePoints === pack
                        ? 'border-orange-300 bg-orange-50/80'
                        : index === 0
                          ? 'border-orange-200 bg-orange-50/40'
                          : 'border-[#ece7dd] bg-[#f8f7f3]'
                    }`}
                  >
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {index === 0 ? 'Recommended' : 'Point pack'}
                    </p>
                    <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{pack.toLocaleString()}</p>
                    <p className="mt-2 text-xs leading-6 text-slate-600">
                      {suggestedCost
                        ? `${Math.max(1, Math.floor(pack / suggestedCost))} ${intentService.category === 'Verified Wallets' ? 'wallet-record' : 'notification'} runs at current pricing.`
                        : 'A practical starting balance for utility and support tools.'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[26px] border border-[#ece7dd] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Next move</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">Fund now, then return to {intentService.title}.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {suggestedCost
                  ? `${intentService.title} currently needs about ${suggestedCost.toLocaleString()} points to launch cleanly. Create an order below, then return to the service page once support confirms funding.`
                  : 'Create an order below, then jump back into the service from the services board.'}
              </p>
              <div className="mt-6 space-y-3">
                <Link
                  to={`/services/${intentService.slug}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#ece7dd] bg-[#f8f7f3] px-5 py-3 text-sm font-black text-slate-800 transition hover:border-[#f2c39a]"
                >
                  Back to {intentService.title}
                  <ArrowRight size={16} />
                </Link>
                {intentService.launchTo ? (
                  <Link
                    to={intentService.launchTo}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: intentService.accent.bg }}
                  >
                    Launch service anyway
                    <ArrowRight size={16} />
                  </Link>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="rounded-[26px] border border-[#ece7dd] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Create order</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">Choose points and payment method.</h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Pending', value: statusCounts.pending },
                  { label: 'Awaiting', value: statusCounts.awaiting },
                  { label: 'Completed', value: statusCounts.completed }
                ].map((stat) => (
                  <div key={stat.label} className="rounded-[18px] bg-[#f8f7f3] px-3 py-3">
                    <p className="text-lg font-black tracking-[-0.03em] text-slate-950">{stat.value}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-black text-slate-950">Point amount</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                {(intentService ? suggestedPacks : [50, 100, 250, 500]).map((pack) => (
                  <button
                    key={pack}
                    type="button"
                    onClick={() => {
                      setSelectedPoints(pack);
                      setCustomPoints('');
                    }}
                    className={`rounded-[22px] border px-4 py-4 text-left transition ${
                      activePoints === pack ? 'border-orange-300 bg-orange-50/80' : 'border-[#ece7dd] bg-[#f8f7f3]'
                    }`}
                  >
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Pack</p>
                    <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{pack.toLocaleString()}</p>
                    <p className="mt-2 text-xs text-slate-500">Points</p>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <label className="block text-sm font-black text-slate-950">Custom points</label>
                <input
                  type="number"
                  min="5"
                  value={customPoints}
                  onChange={(event) => setCustomPoints(event.target.value)}
                  placeholder="Enter custom point amount"
                  className="mt-2 w-full rounded-[22px] border border-[#e6ddd0] bg-[#faf7f1] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#f2c39a]"
                />
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-black text-slate-950">Payment method</p>
              <div className="mt-3 grid gap-4 xl:grid-cols-2">
                {methods.map((method) => {
                  const Icon = method.icon;
                  const active = selectedMethodId === method.id;

                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedMethodId(method.id)}
                      className={`rounded-[26px] border p-5 text-left shadow-[0_20px_60px_rgba(15,23,42,0.04)] transition ${
                        active ? 'border-orange-300 bg-orange-50/80' : 'border-[#ece7dd] bg-white hover:border-orange-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm">
                            <Icon size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl font-black tracking-[-0.03em] text-slate-950">{method.title}</h3>
                            <p className="mt-1 text-sm font-semibold text-slate-500">{method.subtitle}</p>
                          </div>
                          <p className="text-sm leading-7 text-slate-600">{method.description}</p>
                        </div>
                        <div className={`mt-1 h-4 w-4 rounded-full border-2 ${active ? 'border-orange-500 bg-orange-500' : 'border-slate-300'}`} />
                      </div>

                      <div className="mt-6 flex flex-wrap gap-2">
                        {method.metrics.map((metric) => (
                          <span
                            key={metric}
                            className="rounded-full border border-slate-200 bg-[#f8f7f3] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600"
                          >
                            {metric}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[26px] border border-[#ece7dd] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Order summary</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">{amountLabel}</h2>
              <div className="mt-5 space-y-3 rounded-[22px] bg-[#f8f7f3] p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span>Method</span>
                  <span className="font-black text-slate-950">{selectedMethod.title}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Status after creation</span>
                  <span className="font-black text-slate-950">Pending</span>
                </div>
                {intentService ? (
                  <div className="flex items-center justify-between gap-3">
                    <span>Service intent</span>
                    <span className="font-black text-slate-950">{intentService.title}</span>
                  </div>
                ) : null}
              </div>

              <p className="mt-5 text-sm leading-7 text-slate-600">{selectedMethod.instructions}</p>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={createOrder}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                  style={{ backgroundColor: brand }}
                >
                  Create Funding Order
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {latestOrder ? (
              <div className="rounded-[26px] border border-[#ece7dd] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Latest order</p>
                <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">{latestOrder.amount_label}</h2>
                <div className="mt-5 space-y-3 rounded-[22px] bg-[#f8f7f3] p-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span>Method</span>
                    <span className="font-black text-slate-950">{latestOrder.method_title}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Status</span>
                    <span className="font-black capitalize text-slate-950">{latestOrder.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Created</span>
                    <span className="font-black text-slate-950">{new Date(latestOrder.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {latestOrder.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(latestOrder.order_id, 'awaiting_confirmation', 'Order marked as awaiting confirmation')}
                      className="inline-flex items-center justify-center rounded-full border border-[#ece7dd] bg-[#f8f7f3] px-5 py-3 text-sm font-black text-slate-800 transition hover:border-[#f2c39a]"
                    >
                      I Have Paid
                    </button>
                  ) : null}
                  {latestOrder.status === 'awaiting_confirmation' ? (
                    <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold text-amber-800">
                      Payment submitted. Vendor/admin confirmation is required before points are credited.
                    </div>
                  ) : null}
                  <Link
                    to="/transactions"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#ece7dd] bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:border-[#f2c39a]"
                  >
                    View Order History
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
