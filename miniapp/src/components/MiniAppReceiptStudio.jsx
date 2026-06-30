import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Mail,
  Receipt,
  RefreshCw,
  Sparkles,
  WalletCards,
  Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { useTelegramMiniApp } from '../context/TelegramMiniAppContext';
import { serviceCatalog } from '../lib/servicesCatalog';

const steps = ['Service', 'Details', 'Preview'];
const bankServices = serviceCatalog.filter((service) => service.category === 'Verified Wallets' && service.status === 'available');
const emailServices = serviceCatalog.filter((service) => service.category === 'Verified Notifications' && service.status === 'available');
const flashServices = [
  'All services',
  'PayPal',
  'CashApp',
  'Venmo',
  'Zelle',
  'Wise',
  'Coinbase',
  'Trust Wallet',
  'GCash',
  'Binance',
  'Bybit',
  'Crypto.com'
];
const flashStatuses = ['All statuses', 'Pending', 'Sent', 'Delivered', 'Bounced', 'Failed', 'Refunded', 'Spam reported'];

function generateTransactionRef() {
  return `TRX${Math.random().toString(36).substring(2, 14).toUpperCase()}`;
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getNow() {
  return new Date().toTimeString().substring(0, 5);
}

function StudioField({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function fieldClass() {
  return 'w-full rounded-[18px] border border-black/5 bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-sm font-bold text-[var(--tg-text-color)] outline-none transition placeholder:text-[var(--tg-hint-color)] focus:border-[var(--tg-button-color)]';
}

function getReceiptDetails(receipt) {
  return receipt?.data?.details || receipt?.details || receipt?.data || receipt || {};
}

function getFlashStatus(receipt) {
  const details = getReceiptDetails(receipt);
  const value = String(details.status || receipt?.status || 'sent').toLowerCase();

  if (value.includes('deliver')) {
    return 'Delivered';
  }

  if (value.includes('bounce')) {
    return 'Bounced';
  }

  if (value.includes('fail')) {
    return 'Failed';
  }

  if (value.includes('refund')) {
    return 'Refunded';
  }

  if (value.includes('spam')) {
    return 'Spam reported';
  }

  if (value.includes('pending')) {
    return 'Pending';
  }

  return 'Sent';
}

function getFlashProvider(receipt) {
  const details = getReceiptDetails(receipt);
  return details.provider || receipt?.provider || receipt?.title || 'Transferly';
}

function MiniProgress({ step }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {steps.map((label, index) => (
        <div
          key={label}
          className={`rounded-full px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.14em] ${
            index <= step
              ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]'
              : 'bg-[var(--tg-section-bg-color)] text-[var(--tg-hint-color)]'
          }`}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function ServiceCard({ service, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`min-h-[116px] rounded-[24px] p-4 text-left shadow-sm transition active:scale-[0.99] ${
        active
          ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]'
          : 'bg-[var(--tg-section-bg-color)] text-[var(--tg-text-color)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black"
          style={{ backgroundColor: active ? 'rgba(255,255,255,0.18)' : service.accent?.bg, color: service.accent?.fg }}
        >
          {service.mark}
        </div>
        {active ? <CheckCircle2 size={18} /> : <ArrowRight size={17} className="text-[var(--tg-hint-color)]" />}
      </div>
      <h3 className="mt-4 text-base font-black tracking-[-0.02em]">{service.title}</h3>
      <p className={`mt-1 line-clamp-2 text-xs leading-5 ${active ? 'text-white/[0.78]' : 'text-[var(--tg-subtitle-text-color)]'}`}>
        {service.description}
      </p>
    </button>
  );
}

function FlashMailHistorySummary({ receipts }) {
  const [serviceFilter, setServiceFilter] = useState('All services');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const flashReceipts = useMemo(() => receipts.filter((receipt) => receipt?.type === 'email'), [receipts]);
  const filteredReceipts = useMemo(() => flashReceipts.filter((receipt) => {
    const provider = getFlashProvider(receipt).toLowerCase();
    const status = getFlashStatus(receipt);

    if (serviceFilter !== 'All services' && !provider.includes(serviceFilter.toLowerCase())) {
      return false;
    }

    if (statusFilter !== 'All statuses' && status !== statusFilter) {
      return false;
    }

    return true;
  }), [flashReceipts, serviceFilter, statusFilter]);
  const counts = {
    sent: flashReceipts.filter((receipt) => getFlashStatus(receipt) === 'Sent').length,
    delivered: flashReceipts.filter((receipt) => getFlashStatus(receipt) === 'Delivered').length,
    bounced: flashReceipts.filter((receipt) => getFlashStatus(receipt) === 'Bounced').length,
    pending: flashReceipts.filter((receipt) => getFlashStatus(receipt) === 'Pending').length
  };

  return (
    <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Flash mails</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--tg-text-color)]">Flash Mail History</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Sent', counts.sent],
            ['Delivered', counts.delivered],
            ['Bounced', counts.bounced],
            ['Pending', counts.pending]
          ].map(([label, value]) => (
            <div key={label} className="min-w-24 rounded-[20px] bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-center">
              <p className="text-xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{Number(value).toLocaleString()}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select
          value={serviceFilter}
          onChange={(event) => setServiceFilter(event.target.value)}
          className="h-12 rounded-[18px] border border-black/5 bg-[var(--tg-secondary-bg-color)] px-4 text-sm font-black text-[var(--tg-text-color)] outline-none focus:border-[var(--tg-button-color)]"
          aria-label="Filter flash mail service"
        >
          {flashServices.map((service) => (
            <option key={service}>{service}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-12 rounded-[18px] border border-black/5 bg-[var(--tg-secondary-bg-color)] px-4 text-sm font-black text-[var(--tg-text-color)] outline-none focus:border-[var(--tg-button-color)]"
          aria-label="Filter flash mail status"
        >
          {flashStatuses.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-2">
        {filteredReceipts.length ? filteredReceipts.slice(0, 4).map((receipt) => {
          const details = getReceiptDetails(receipt);
          return (
            <article key={receipt?.id || receipt?.receipt_id || `${details.subject}-${details.toEmail}`} className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[var(--tg-text-color)]">{details.subject || receipt?.title || 'Flash mail'}</p>
                  <p className="mt-1 truncate text-xs font-bold text-[var(--tg-hint-color)]">{details.toEmail || receipt?.emailTo || 'No recipient email'}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--tg-section-bg-color)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">
                  {getFlashStatus(receipt)}
                </span>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-6 text-center">
            <Mail className="mx-auto text-[var(--tg-hint-color)]" size={34} />
            <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">No flash mails yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function QualityScore({ checks }) {
  const complete = checks.filter((check) => check.done).length;
  const score = Math.round((complete / checks.length) * 100);

  return (
    <section className="rounded-[26px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Quality score</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--tg-text-color)]">{score}%</p>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]">
          <Sparkles size={26} />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-2 text-xs font-bold text-[var(--tg-subtitle-text-color)]">
            <CheckCircle2 size={15} className={check.done ? 'text-[var(--tg-button-color)]' : 'text-[var(--tg-hint-color)]'} />
            {check.label}
          </div>
        ))}
      </div>
    </section>
  );
}

function ReceiptPreview({ mode, service, bankForm, emailForm }) {
  const isBank = mode === 'bank';
  const amount = isBank ? bankForm.amount : emailForm.subject;
  const primary = isBank ? bankForm.receiverName || 'Recipient name' : emailForm.toEmail || 'recipient@example.com';
  const secondary = isBank ? bankForm.narration || 'Transfer narration' : emailForm.body || 'Receipt message preview';
  const date = isBank ? bankForm.transactionDate : emailForm.date;
  const time = isBank ? bankForm.transactionTime : emailForm.time;

  return (
    <section className="overflow-hidden rounded-[30px] bg-[var(--tg-section-bg-color)] shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
      <div className="border-b border-black/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">
              Live preview
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[var(--tg-text-color)]">
              {service.title}
            </h2>
          </div>
          <div
            className="flex h-12 w-12 items-center justify-center rounded-[20px] text-sm font-black"
            style={{ backgroundColor: service.accent?.bg, color: service.accent?.fg }}
          >
            {service.mark}
          </div>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-4">
          <p className="text-xs font-bold text-[var(--tg-hint-color)]">{isBank ? 'Amount' : 'Subject'}</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--tg-text-color)]">
            {amount || (isBank ? '0.00' : 'Receipt subject')}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
            <p className="text-xs font-bold text-[var(--tg-hint-color)]">{isBank ? 'Receiver' : 'To'}</p>
            <p className="mt-2 truncate text-sm font-black text-[var(--tg-text-color)]">{primary}</p>
          </div>
          <div className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
            <p className="text-xs font-bold text-[var(--tg-hint-color)]">Time</p>
            <p className="mt-2 text-sm font-black text-[var(--tg-text-color)]">{date} {time}</p>
          </div>
        </div>
        <div className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
          <p className="text-xs font-bold text-[var(--tg-hint-color)]">Details</p>
          <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-[var(--tg-text-color)]">{secondary}</p>
        </div>
      </div>
    </section>
  );
}

export default function MiniAppReceiptStudio() {
  const { addReceipt, config, profile, receipts, user } = useAppContext();
  const telegram = useTelegramMiniApp();
  const {
    configureClosingConfirmation,
    configureMainButton,
    configureVerticalSwipe,
    impact,
    notify,
    webApp
  } = telegram;
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('bank');
  const [selectedSlug, setSelectedSlug] = useState(bankServices[0]?.slug || 'opay');
  const [generating, setGenerating] = useState(false);
  const [generatedReceipt, setGeneratedReceipt] = useState(null);
  const [bankForm, setBankForm] = useState({
    senderName: '',
    senderAccount: '',
    senderBank: 'Transferly Wallet',
    receiverName: '',
    receiverAccount: '',
    receiverBank: 'Opay',
    amount: '',
    transactionDate: getToday(),
    transactionTime: getNow(),
    transactionRef: generateTransactionRef(),
    narration: '',
    sessionId: generateSessionId(),
    status: 'Successful'
  });
  const [emailForm, setEmailForm] = useState({
    fromName: 'Transferly',
    fromEmail: 'receipts@transferly.app',
    toName: '',
    toEmail: '',
    subject: '',
    body: '',
    date: getToday(),
    time: getNow(),
    provider: 'PayPal'
  });

  const services = mode === 'bank' ? bankServices : emailServices;
  const selectedService = services.find((service) => service.slug === selectedSlug) || services[0] || serviceCatalog[0];
  const cost = mode === 'bank' ? Number(config?.bank_slip_cost || 10) : Number(config?.email_receipt_cost || 5);
  const points = Number(profile?.points || 0);
  const hasEnoughPoints = points >= cost;
  const authenticated = Boolean(user?.id);
  const hasDraft = useMemo(() => {
    if (generatedReceipt) {
      return false;
    }

    if (step > 0) {
      return true;
    }

    if (mode === 'bank') {
      return Boolean(
        bankForm.senderName ||
        bankForm.receiverName ||
        bankForm.receiverAccount ||
        bankForm.amount ||
        bankForm.narration
      );
    }

    return Boolean(emailForm.toName || emailForm.toEmail || emailForm.subject || emailForm.body);
  }, [bankForm, emailForm, generatedReceipt, mode, step]);

  const qualityChecks = useMemo(() => {
    if (mode === 'bank') {
      return [
        { label: 'Sender and receiver names', done: Boolean(bankForm.senderName && bankForm.receiverName) },
        { label: 'Amount and timestamp', done: Boolean(bankForm.amount && bankForm.transactionDate && bankForm.transactionTime) },
        { label: 'Reference and session id', done: Boolean(bankForm.transactionRef && bankForm.sessionId) },
        { label: 'Narration and status', done: Boolean(bankForm.narration && bankForm.status) }
      ];
    }

    return [
      { label: 'Sender identity', done: Boolean(emailForm.fromName && emailForm.fromEmail) },
      { label: 'Recipient identity', done: Boolean(emailForm.toName && emailForm.toEmail) },
      { label: 'Subject and message', done: Boolean(emailForm.subject && emailForm.body) },
      { label: 'Provider and timestamp', done: Boolean(emailForm.provider && emailForm.date && emailForm.time) }
    ];
  }, [bankForm, emailForm, mode]);

  const canContinue = useMemo(() => {
    if (step === 0) {
      return Boolean(selectedService);
    }

    if (step === 1 && mode === 'bank') {
      return Boolean(bankForm.senderName && bankForm.receiverName && bankForm.amount);
    }

    if (step === 1) {
      return Boolean(emailForm.fromEmail && emailForm.toEmail && emailForm.subject);
    }

    return authenticated && hasEnoughPoints && qualityChecks.every((check) => check.done);
  }, [authenticated, bankForm, emailForm, hasEnoughPoints, mode, qualityChecks, selectedService, step]);

  useEffect(() => {
    const nextServices = mode === 'bank' ? bankServices : emailServices;
    setSelectedSlug(nextServices[0]?.slug || '');
    setGeneratedReceipt(null);
  }, [mode]);

  const updateBank = (field, value) => setBankForm((previous) => ({ ...previous, [field]: value }));
  const updateEmail = (field, value) => setEmailForm((previous) => ({ ...previous, [field]: value }));

  const handleGenerate = useCallback(async () => {
    if (generating) {
      return;
    }

    if (!authenticated) {
      toast.error('Open Transferly from Telegram to generate receipts');
      return;
    }

    if (!hasEnoughPoints) {
      toast.error(`You need ${cost} points. Current balance: ${points} pts`);
      return;
    }

    if (!qualityChecks.every((check) => check.done)) {
      toast.error('Complete the receipt details before generating');
      return;
    }

    setGenerating(true);
    impact('medium');
    webApp?.MainButton?.showProgress?.();

    try {
      const payload = mode === 'bank'
        ? { type: 'bank', ...bankForm }
        : { type: 'email', ...emailForm, provider: selectedService.title };
      const result = await addReceipt(payload);

      if (result?.error) {
        toast.error(result.error);
        notify('error');
        return;
      }

      setGeneratedReceipt(result);
      setStep(2);
      notify('success');
      toast.success('Receipt generated and saved');
    } catch (_error) {
      notify('error');
      toast.error('Failed to generate receipt');
    } finally {
      setGenerating(false);
      webApp?.MainButton?.hideProgress?.();
    }
  }, [addReceipt, authenticated, bankForm, cost, emailForm, generating, hasEnoughPoints, impact, mode, notify, points, qualityChecks, selectedService.title, webApp]);

  const goForward = useCallback(() => {
    if (step < 2) {
      if (!canContinue) {
        toast.error(step === 1 ? 'Fill the required fields first' : 'Choose a service first');
        return;
      }
      setStep((current) => current + 1);
      impact('light');
      return;
    }

    handleGenerate();
  }, [canContinue, handleGenerate, impact, step]);

  const createAnother = () => {
    setGeneratedReceipt(null);
    setStep(0);
    setBankForm((previous) => ({
      ...previous,
      amount: '',
      receiverName: '',
      receiverAccount: '',
      narration: '',
      transactionRef: generateTransactionRef(),
      sessionId: generateSessionId(),
      transactionDate: getToday(),
      transactionTime: getNow()
    }));
    setEmailForm((previous) => ({
      ...previous,
      toName: '',
      toEmail: '',
      subject: '',
      body: '',
      date: getToday(),
      time: getNow()
    }));
  };

  useEffect(() => {
    const button = webApp?.MainButton;
    if (!button && !configureMainButton) {
      return undefined;
    }

    const handleClick = () => {
      if (generatedReceipt) {
        createAnother();
        return;
      }
      goForward();
    };

    const text = generatedReceipt ? 'Create Another' : step < 2 ? 'Continue' : 'Generate Receipt';
    return configureMainButton?.({
      text,
      enabled: canContinue || Boolean(generatedReceipt),
      loading: generating,
      onClick: handleClick
    });
  }, [canContinue, configureMainButton, generatedReceipt, generating, goForward, step, webApp]);

  useEffect(() => {
    configureClosingConfirmation?.(hasDraft);
    configureVerticalSwipe?.(step !== 1);

    return () => {
      configureClosingConfirmation?.(false);
      configureVerticalSwipe?.(true);
    };
  }, [configureClosingConfirmation, configureVerticalSwipe, hasDraft, step]);

  return (
    <div className="space-y-4">
      <FlashMailHistorySummary receipts={receipts} />

      <MiniProgress step={step} />

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]">
            <Receipt size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Telegram-native workflow</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--tg-text-color)]">Receipt Studio</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--tg-subtitle-text-color)]">
              Build a receipt with service presets, guided quality checks, live preview, and a native Telegram final action.
            </p>
          </div>
        </div>
      </section>

      {step === 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-[24px] bg-[var(--tg-section-bg-color)] p-2 shadow-sm">
            {[
              ['bank', 'Wallet Record', Receipt],
              ['email', 'Notification', Mail]
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`flex h-14 items-center justify-center gap-2 rounded-[18px] text-sm font-black transition active:scale-[0.99] ${
                  mode === key
                    ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]'
                    : 'text-[var(--tg-hint-color)]'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <ServiceCard
                key={service.slug}
                service={service}
                active={service.slug === selectedSlug}
                onSelect={() => setSelectedSlug(service.slug)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Required details</p>
                <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{selectedService.title}</h3>
              </div>
              <FileText size={24} className="text-[var(--tg-button-color)]" />
            </div>

            {mode === 'bank' ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <StudioField label="Sender name">
                  <input className={fieldClass()} value={bankForm.senderName} onChange={(event) => updateBank('senderName', event.target.value)} placeholder="Sender name" />
                </StudioField>
                <StudioField label="Receiver name">
                  <input className={fieldClass()} value={bankForm.receiverName} onChange={(event) => updateBank('receiverName', event.target.value)} placeholder="Receiver name" />
                </StudioField>
                <StudioField label="Amount">
                  <input className={fieldClass()} value={bankForm.amount} onChange={(event) => updateBank('amount', event.target.value)} placeholder="25,000.00" />
                </StudioField>
                <StudioField label="Status">
                  <select className={fieldClass()} value={bankForm.status} onChange={(event) => updateBank('status', event.target.value)}>
                    <option>Successful</option>
                    <option>Pending</option>
                    <option>Failed</option>
                  </select>
                </StudioField>
                <StudioField label="Sender bank">
                  <input className={fieldClass()} value={bankForm.senderBank} onChange={(event) => updateBank('senderBank', event.target.value)} />
                </StudioField>
                <StudioField label="Receiver bank">
                  <input className={fieldClass()} value={bankForm.receiverBank} onChange={(event) => updateBank('receiverBank', event.target.value)} />
                </StudioField>
                <StudioField label="Receiver account">
                  <input className={fieldClass()} value={bankForm.receiverAccount} onChange={(event) => updateBank('receiverAccount', event.target.value)} placeholder="Account number" />
                </StudioField>
                <StudioField label="Reference">
                  <input className={fieldClass()} value={bankForm.transactionRef} onChange={(event) => updateBank('transactionRef', event.target.value)} />
                </StudioField>
                <StudioField label="Date">
                  <input type="date" className={fieldClass()} value={bankForm.transactionDate} onChange={(event) => updateBank('transactionDate', event.target.value)} />
                </StudioField>
                <StudioField label="Time">
                  <input type="time" className={fieldClass()} value={bankForm.transactionTime} onChange={(event) => updateBank('transactionTime', event.target.value)} />
                </StudioField>
                <div className="sm:col-span-2">
                  <StudioField label="Narration">
                    <textarea className={`${fieldClass()} min-h-[104px] resize-none`} value={bankForm.narration} onChange={(event) => updateBank('narration', event.target.value)} placeholder="Payment narration" />
                  </StudioField>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <StudioField label="From name">
                  <input className={fieldClass()} value={emailForm.fromName} onChange={(event) => updateEmail('fromName', event.target.value)} />
                </StudioField>
                <StudioField label="From email">
                  <input className={fieldClass()} value={emailForm.fromEmail} onChange={(event) => updateEmail('fromEmail', event.target.value)} />
                </StudioField>
                <StudioField label="To name">
                  <input className={fieldClass()} value={emailForm.toName} onChange={(event) => updateEmail('toName', event.target.value)} placeholder="Recipient name" />
                </StudioField>
                <StudioField label="To email">
                  <input className={fieldClass()} value={emailForm.toEmail} onChange={(event) => updateEmail('toEmail', event.target.value)} placeholder="recipient@example.com" />
                </StudioField>
                <StudioField label="Subject">
                  <input className={fieldClass()} value={emailForm.subject} onChange={(event) => updateEmail('subject', event.target.value)} placeholder="Payment received" />
                </StudioField>
                <StudioField label="Provider">
                  <input className={fieldClass()} value={emailForm.provider} onChange={(event) => updateEmail('provider', event.target.value)} />
                </StudioField>
                <StudioField label="Date">
                  <input type="date" className={fieldClass()} value={emailForm.date} onChange={(event) => updateEmail('date', event.target.value)} />
                </StudioField>
                <StudioField label="Time">
                  <input type="time" className={fieldClass()} value={emailForm.time} onChange={(event) => updateEmail('time', event.target.value)} />
                </StudioField>
                <div className="sm:col-span-2">
                  <StudioField label="Message">
                    <textarea className={`${fieldClass()} min-h-[120px] resize-none`} value={emailForm.body} onChange={(event) => updateEmail('body', event.target.value)} placeholder="Receipt message body" />
                  </StudioField>
                </div>
              </div>
            )}
          </section>

          <div className="space-y-4">
            <QualityScore checks={qualityChecks} />
            <ReceiptPreview mode={mode} service={selectedService} bankForm={bankForm} emailForm={emailForm} />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ReceiptPreview mode={mode} service={selectedService} bankForm={bankForm} emailForm={emailForm} />
          <div className="space-y-4">
            <QualityScore checks={qualityChecks} />
            <section className="rounded-[26px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]">
                  {generatedReceipt ? <BadgeCheck size={23} /> : <WalletCards size={23} />}
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">
                    {generatedReceipt ? 'Saved' : 'Generation cost'}
                  </p>
                  <p className="mt-1 text-lg font-black text-[var(--tg-text-color)]">
                    {generatedReceipt ? 'Receipt saved to vault' : `${cost} points`}
                  </p>
                </div>
              </div>
              {!authenticated ? (
                <p className="mt-4 rounded-[18px] bg-[color-mix(in_srgb,var(--tg-destructive-text-color)_10%,var(--tg-secondary-bg-color))] p-3 text-xs font-bold leading-5 text-[var(--tg-destructive-text-color)]">
                  Open Transferly from Telegram before generating.
                </p>
              ) : null}
              {authenticated && !hasEnoughPoints ? (
                <p className="mt-4 rounded-[18px] bg-[color-mix(in_srgb,#f59e0b_14%,var(--tg-secondary-bg-color))] p-3 text-xs font-bold leading-5 text-[var(--tg-text-color)]">
                  Your balance is {points.toLocaleString()} points. Top up before generating.
                </p>
              ) : null}
              {generatedReceipt ? (
                <div className="mt-4 grid gap-2">
                  <Link to="/miniapp/vault" className="flex items-center justify-center gap-2 rounded-[18px] bg-[var(--tg-button-color)] px-4 py-3 text-sm font-black text-[var(--tg-button-text-color)]">
                    Open vault
                    <ArrowRight size={16} />
                  </Link>
                  <button type="button" onClick={createAnother} className="flex items-center justify-center gap-2 rounded-[18px] bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-sm font-black text-[var(--tg-text-color)]">
                    <RefreshCw size={16} />
                    Create another
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {step > 0 && !generatedReceipt ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            className="flex items-center justify-center gap-2 rounded-[20px] bg-[var(--tg-section-bg-color)] px-5 py-3 text-sm font-black text-[var(--tg-text-color)] shadow-sm"
          >
            <ChevronLeft size={16} />
            Back
          </button>
        ) : null}
        {!generatedReceipt ? (
          <button
            type="button"
            onClick={goForward}
            disabled={generating}
            className="flex flex-1 items-center justify-center gap-2 rounded-[20px] bg-[var(--tg-button-color)] px-5 py-3 text-sm font-black text-[var(--tg-button-text-color)] shadow-sm disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
          >
            {step < 2 ? 'Continue' : generating ? 'Generating' : 'Generate receipt'}
            {step < 2 ? <ArrowRight size={16} /> : <Zap size={16} />}
          </button>
        ) : null}
        <Link to="/dashboard/generate" className="flex items-center justify-center gap-2 rounded-[20px] bg-[var(--tg-section-bg-color)] px-5 py-3 text-sm font-black text-[var(--tg-text-color)] shadow-sm">
          Advanced web generator
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
