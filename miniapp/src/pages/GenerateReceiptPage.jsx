import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, AlertCircle, ArrowLeft, Sparkles, Wallet } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/DashboardLayout';
import { useAppContext } from '../context/AppContext';
import BankSlipForm from '../components/BankSlipForm';
import BankSlipPreview from '../components/BankSlipPreview';
import EmailReceiptForm from '../components/EmailReceiptForm';
import EmailReceiptPreview from '../components/EmailReceiptPreview';
import { getServiceBySlug } from '../lib/servicesCatalog';

const NIGERIAN_BANKS = [
  'GTBank', 'Access Bank', 'First Bank', 'Zenith Bank', 'UBA',
  'Fidelity Bank', 'Stanbic IBTC', 'Union Bank', 'Polaris Bank',
  'Wema Bank', 'Sterling Bank', 'Opay', 'Kuda', 'Palmpay'
];

const emailServicePresets = {
  paypal: {
    provider: 'PayPal',
    fromName: 'PayPal',
    fromEmail: 'service@paypal.com',
    custom: {
      subject: 'You have a new payment receipt',
      body: 'Hello,\n\nYour recent PayPal activity has been updated successfully. Please review the transaction details below.\n\nThanks,\nPayPal'
    },
    deposit: {
      subject: 'Deposit confirmation notice',
      body: 'Hello,\n\nA new deposit has been recorded on your PayPal account. Review the transaction summary below.\n\nRegards,\nPayPal'
    }
  },
  stripe: {
    provider: 'Stripe',
    fromName: 'Stripe',
    fromEmail: 'receipts@stripe.com',
    custom: {
      subject: 'Payment activity notice',
      body: 'Hello,\n\nA Stripe payment activity notice is ready for review. Check the payment details below.\n\nStripe'
    },
    deposit: {
      subject: 'Payment received',
      body: 'Hello,\n\nYour Stripe payment has been received successfully. Review the confirmation details below.\n\nStripe'
    }
  },
  paystack: {
    provider: 'Paystack',
    fromName: 'Paystack',
    fromEmail: 'receipts@paystack.com',
    custom: {
      subject: 'Payment request update',
      body: 'Hello,\n\nA Paystack payment request update is available. Review the payment details below.\n\nPaystack'
    },
    deposit: {
      subject: 'Payment received',
      body: 'Hello,\n\nA Paystack payment has been received successfully. Review the confirmation details below.\n\nPaystack'
    }
  },
  flutterwave: {
    provider: 'Flutterwave',
    fromName: 'Flutterwave',
    fromEmail: 'hi@flutterwavego.com',
    custom: {
      subject: 'Payment notification',
      body: 'Hello,\n\nA Flutterwave payment notification is ready for review. Check the transaction details below.\n\nFlutterwave'
    },
    deposit: {
      subject: 'Payment completed',
      body: 'Hello,\n\nYour Flutterwave payment has completed successfully. Review the confirmation details below.\n\nFlutterwave'
    }
  },
  crypto: {
    provider: 'Crypto Commerce',
    fromName: 'Crypto Commerce',
    fromEmail: 'receipts@commerce.example',
    custom: {
      subject: 'Crypto payment notice',
      body: 'Hello,\n\nA crypto payment notice is ready for review. Check the charge and settlement details below.\n\nCrypto Commerce'
    },
    deposit: {
      subject: 'Crypto payment confirmed',
      body: 'Hello,\n\nA crypto payment has been confirmed. Review the settlement details below.\n\nCrypto Commerce'
    }
  },
  binance: {
    provider: 'Binance',
    fromName: 'Binance',
    fromEmail: 'do-not-reply@binance.com',
    custom: {
      subject: 'Account transaction notice',
      body: 'Hello,\n\nA recent Binance account activity notice is ready. Review the transaction information below.\n\nBinance Team'
    },
    deposit: {
      subject: 'Deposit successful',
      body: 'Hello,\n\nYour Binance deposit has been confirmed and processed successfully. Review the details below.\n\nBinance Team'
    }
  },
  coinbase: {
    provider: 'Coinbase',
    fromName: 'Coinbase',
    fromEmail: 'no-reply@coinbase.com',
    custom: {
      subject: 'Transaction receipt available',
      body: 'Hello,\n\nA Coinbase transaction receipt is available for review below.\n\nCoinbase'
    },
    deposit: {
      subject: 'Deposit completed',
      body: 'Hello,\n\nYour Coinbase deposit is complete. Review the confirmation details below.\n\nCoinbase'
    }
  },
  bybit: {
    provider: 'Bybit',
    fromName: 'Bybit',
    fromEmail: 'noreply@bybit.com',
    custom: {
      subject: 'Bybit account activity update',
      body: 'Hello,\n\nA recent Bybit account activity update is available below. Review the transaction details carefully.\n\nBybit'
    },
    deposit: {
      subject: 'Deposit credited successfully',
      body: 'Hello,\n\nYour Bybit deposit has been credited successfully. Review the confirmation details below.\n\nBybit'
    }
  },
  'crypto-com': {
    provider: 'Crypto.com',
    fromName: 'Crypto.com',
    fromEmail: 'hello@crypto.com',
    custom: {
      subject: 'Crypto.com transaction notice',
      body: 'Hello,\n\nA Crypto.com transaction notice is ready for review. Check the transaction details below.\n\nCrypto.com'
    },
    deposit: {
      subject: 'Deposit received',
      body: 'Hello,\n\nYour Crypto.com deposit has been received successfully. Review the transaction summary below.\n\nCrypto.com'
    }
  },
  wise: {
    provider: 'Wise',
    fromName: 'Wise',
    fromEmail: 'noreply@wise.com',
    custom: {
      subject: 'Wise transfer notice',
      body: 'Hello,\n\nA new Wise transfer notice is available. Review the transfer details below.\n\nWise'
    },
    deposit: {
      subject: 'Incoming transfer confirmed',
      body: 'Hello,\n\nYour Wise incoming transfer has been confirmed. Review the confirmation details below.\n\nWise'
    }
  },
  'cash-app': {
    provider: 'Cash App',
    fromName: 'Cash App',
    fromEmail: 'account@cash.app',
    custom: {
      subject: 'Cash App activity update',
      body: 'Hello,\n\nYour Cash App account activity has been updated. Review the transaction details below.\n\nCash App'
    },
    deposit: {
      subject: 'Cash App deposit complete',
      body: 'Hello,\n\nA Cash App deposit has completed successfully. Review the deposit details below.\n\nCash App'
    }
  },
  zelle: {
    provider: 'Zelle',
    fromName: 'Zelle',
    fromEmail: 'notifications@zellepay.com',
    custom: {
      subject: 'Zelle payment notification',
      body: 'Hello,\n\nA Zelle payment notification is ready for review. See the details below.\n\nZelle'
    },
    deposit: {
      subject: 'Zelle payment received',
      body: 'Hello,\n\nA Zelle payment has been received successfully. Review the payment details below.\n\nZelle'
    }
  },
  venmo: {
    provider: 'Venmo',
    fromName: 'Venmo',
    fromEmail: 'payments@venmo.com',
    custom: {
      subject: 'Venmo payment activity',
      body: 'Hello,\n\nA Venmo payment activity notice is available. Review the payment details below.\n\nVenmo'
    },
    deposit: {
      subject: 'Venmo payment received',
      body: 'Hello,\n\nA Venmo payment has been received and processed successfully. Review the confirmation details below.\n\nVenmo'
    }
  },
  'trust-wallet': {
    provider: 'Trust Wallet',
    fromName: 'Trust Wallet',
    fromEmail: 'support@trustwallet.com',
    custom: {
      subject: 'Trust Wallet activity notice',
      body: 'Hello,\n\nA Trust Wallet activity notice is ready for review. Check the transaction details below.\n\nTrust Wallet'
    },
    deposit: {
      subject: 'Trust Wallet deposit confirmed',
      body: 'Hello,\n\nYour Trust Wallet deposit has been confirmed. Review the confirmation details below.\n\nTrust Wallet'
    }
  },
  gcash: {
    provider: 'GCash',
    fromName: 'GCash',
    fromEmail: 'noreply@gcash.com',
    custom: {
      subject: 'GCash account notification',
      body: 'Hello,\n\nA new GCash account notification is available. Review the transaction details below.\n\nGCash'
    },
    deposit: {
      subject: 'GCash payment received',
      body: 'Hello,\n\nA GCash payment has been received successfully. Review the confirmation details below.\n\nGCash'
    }
  }
};

const bankServicePresets = {
  opay: {
    senderBank: 'Opay',
    receiverBank: 'Opay',
    narration: 'Opay transfer receipt',
    status: 'Successful'
  },
  kuda: {
    senderBank: 'Kuda',
    receiverBank: 'Kuda',
    narration: 'Kuda transfer receipt',
    status: 'Successful'
  },
  palmpay: {
    senderBank: 'Palmpay',
    receiverBank: 'Palmpay',
    narration: 'Palmpay transfer receipt',
    status: 'Successful'
  }
};

function generateTransactionRef() {
  return `TRX${Math.random().toString(36).substring(2, 14).toUpperCase()}`;
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

const tabMeta = {
  bank: {
    title: 'Custom Wallet Record',
    subtitle: 'Build a clean transfer record preview with your own transaction details.',
    feeLabel: 'Wallet Record'
  },
  email: {
    title: 'PayPal Custom Notification',
    subtitle: 'Create a branded email-style receipt preview for service and support flows.',
    feeLabel: 'Notification'
  }
};

export default function GenerateReceiptPage() {
  const { addReceipt, config, profile } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedType = searchParams.get('type') === 'email' ? 'email' : 'bank';
  const serviceSlug = searchParams.get('service') || '';
  const mailType = searchParams.get('mailType') === 'deposit' ? 'deposit' : 'custom';
  const [activeTab, setActiveTab] = useState(requestedType);
  const [generating, setGenerating] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    senderName: '',
    senderAccount: '',
    senderBank: NIGERIAN_BANKS[0],
    receiverName: '',
    receiverAccount: '',
    receiverBank: NIGERIAN_BANKS[0],
    amount: '',
    transactionDate: new Date().toISOString().split('T')[0],
    transactionTime: new Date().toTimeString().substring(0, 5),
    transactionRef: generateTransactionRef(),
    narration: '',
    sessionId: generateSessionId(),
    status: 'Successful'
  });
  const [emailFormData, setEmailFormData] = useState({
    fromName: '',
    fromEmail: '',
    toName: '',
    toEmail: '',
    subject: '',
    body: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().substring(0, 5),
    provider: 'Gmail'
  });
  const previewRef = useRef(null);
  const lastAppliedPresetRef = useRef('');
  const brand = config?.brand_color || '#f8812d';
  const cost = activeTab === 'bank' ? (config?.bank_slip_cost || 10) : (config?.email_receipt_cost || 5);
  const points = Number(profile?.points || 0);
  const hasEnoughPoints = points >= cost;

  useEffect(() => {
    setActiveTab(requestedType);
  }, [requestedType]);

  useEffect(() => {
    const presetKey = `${serviceSlug}:${activeTab}:${mailType}`;
    if (!serviceSlug || lastAppliedPresetRef.current === presetKey) {
      return;
    }

    if (activeTab === 'email') {
      const preset = emailServicePresets[serviceSlug];
      if (preset) {
        const variant = preset[mailType] || preset.custom;
        setEmailFormData((previous) => ({
          ...previous,
          provider: preset.provider || previous.provider,
          fromName: preset.fromName || previous.fromName || '',
          fromEmail: preset.fromEmail || previous.fromEmail || '',
          subject: variant.subject,
          body: variant.body
        }));
      }
    }

    if (activeTab === 'bank') {
      const preset = bankServicePresets[serviceSlug];
      if (preset) {
        setBankFormData((previous) => ({
          ...previous,
          senderBank: preset.senderBank || previous.senderBank,
          receiverBank: preset.receiverBank || previous.receiverBank,
          narration: preset.narration || previous.narration,
          status: preset.status || previous.status
        }));
      }
    }

    lastAppliedPresetRef.current = presetKey;
  }, [activeTab, mailType, serviceSlug]);

  const requestedService = getServiceBySlug(serviceSlug);
  const activeMeta = tabMeta[activeTab];
  const emailVariantLabel = mailType === 'deposit' ? 'Deposit Mail' : 'Custom Mail';
  const serviceHeading = requestedService
    ? `${requestedService.title} ${activeTab === 'bank' ? 'Slip' : emailVariantLabel}`
    : activeMeta.title;
  const serviceSubtitle = requestedService
    ? `${requestedService.description} Use the form below to build the ${requestedService.title} ${activeTab === 'email' ? emailVariantLabel.toLowerCase() : 'version'} of this tool.`
    : activeMeta.subtitle;

  const feeNotice = useMemo(() => {
    if (hasEnoughPoints) {
      return `This tool costs ${cost} points. Your current balance is ${points} points.`;
    }

    return `You need ${cost} points to use this tool, but your balance is ${points} points.`;
  }, [cost, hasEnoughPoints, points]);

  const handleBankFormChange = (field, value) => setBankFormData((prev) => ({ ...prev, [field]: value }));
  const handleEmailFormChange = (field, value) => setEmailFormData((prev) => ({ ...prev, [field]: value }));
  const getTabTitle = (tabKey) => {
    if (tabKey === 'email' && requestedService) {
      return `${requestedService.title} ${emailVariantLabel}`;
    }

    if (tabKey === 'bank' && requestedService && requestedService.category === 'Verified Wallets') {
      return `${requestedService.title} Slip`;
    }

    return tabMeta[tabKey].title;
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    const nextParams = { type: tab };
    if (serviceSlug) {
      nextParams.service = serviceSlug;
    }
    if (tab === 'email') {
      nextParams.mailType = mailType;
    }
    setSearchParams(nextParams);
  };

  const handleGenerateReceipt = async () => {
    if (!hasEnoughPoints) {
      toast.error(`You need ${cost} points to generate this receipt. Current balance: ${points} pts`);
      return;
    }

    if (activeTab === 'bank') {
      if (!bankFormData.senderName || !bankFormData.receiverName || !bankFormData.amount) {
        toast.error('Please fill in all required fields');
        return;
      }
    } else if (!emailFormData.fromEmail || !emailFormData.toEmail || !emailFormData.subject) {
      toast.error('Please fill in all required fields');
      return;
    }

    setGenerating(true);

    try {
      const receiptData = activeTab === 'bank'
        ? { type: 'bank', ...bankFormData }
        : { type: 'email', ...emailFormData };

      const result = await addReceipt(receiptData);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success('Receipt generated and saved');
      await downloadReceipt('png');
    } catch (_error) {
      toast.error('Failed to generate receipt');
    } finally {
      setGenerating(false);
    }
  };

  const applyQuickTemplate = (variant) => {
    if (!requestedService || activeTab !== 'email') {
      return;
    }

    const preset = emailServicePresets[requestedService.slug];
    if (!preset) {
      return;
    }

    const next = preset[variant] || preset.custom;
    setEmailFormData((previous) => ({
      ...previous,
      provider: preset.provider || previous.provider,
      fromName: preset.fromName || previous.fromName,
      fromEmail: preset.fromEmail || previous.fromEmail,
      subject: next.subject,
      body: next.body
    }));
  };

  const downloadReceipt = async (format) => {
    const element = previewRef.current;
    if (!element) {
      toast.error('Preview not found');
      return;
    }

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });

      if (format === 'png') {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `transferly_receipt_${Date.now()}.png`;
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
      pdf.save(`transferly_receipt_${Date.now()}.pdf`);
      toast.success('Downloaded as PDF');
    } catch (_error) {
      toast.error('Failed to download receipt');
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <div className="rounded-[32px] bg-[#121212] px-6 py-7 text-white shadow-[0_28px_80px_rgba(15,23,42,0.18)] md:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <Link to="/services" className="inline-flex items-center gap-2 text-sm font-bold text-white/65 transition hover:text-white">
                <ArrowLeft size={16} />
                Back to Services
              </Link>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
                <Sparkles size={14} />
                {requestedService ? requestedService.category : activeMeta.feeLabel}
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] text-white md:text-5xl">
                {serviceHeading}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70 md:text-base">
                {serviceSubtitle}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[340px] lg:grid-cols-1">
              <div className="rounded-[24px] border border-white/8 bg-white/6 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">Current balance</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-3xl font-black tracking-[-0.05em]">{points.toLocaleString()}</span>
                  <span className="pb-1 text-sm font-semibold text-white/55">pts</span>
                </div>
                <Link
                  to="/buy-point"
                  className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
                  style={{ backgroundColor: brand }}
                >
                  <Wallet size={16} />
                  Buy Points
                </Link>
              </div>
              <div className={`rounded-[24px] border p-4 ${hasEnoughPoints ? 'border-[#234b3d] bg-[#152720]' : 'border-[#5a2a2f] bg-[#2b1518]'}`}>
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className={hasEnoughPoints ? 'text-emerald-300' : 'text-red-300'} />
                  <div>
                    <p className={`text-sm font-bold ${hasEnoughPoints ? 'text-emerald-100' : 'text-red-100'}`}>{feeNotice}</p>
                    <p className={`mt-2 text-xs ${hasEnoughPoints ? 'text-emerald-200/70' : 'text-red-200/70'}`}>
                      {hasEnoughPoints ? 'You can generate and export immediately.' : 'Top up your balance or use your referral link to earn more points.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {Object.entries(tabMeta).map(([key, meta]) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => switchTab(key)}
                className={`rounded-full px-5 py-3 text-sm font-black transition ${
                  active ? 'text-white shadow-[0_18px_45px_rgba(248,129,45,0.28)]' : 'border border-[#e5ddd0] bg-white text-slate-600 hover:border-[#f2c39a] hover:text-slate-950'
                }`}
                style={active ? { backgroundColor: brand } : undefined}
              >
                {getTabTitle(key)}
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-[30px] border border-[#e9e0d2] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Input details</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
                  {activeTab === 'bank' ? 'Transaction information' : `${emailVariantLabel} information`}
                </h2>
              </div>
              <div className="rounded-full border border-[#ece3d5] bg-[#faf7f1] px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Cost {cost} pts
              </div>
            </div>

            {requestedService ? (
              <div className="mb-6 rounded-[24px] border border-[#ece3d5] bg-[#faf7f1] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {requestedService.title} builder
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {activeTab === 'email'
                    ? `Use quick-fill presets for ${requestedService.title} ${emailVariantLabel.toLowerCase()} flows, then edit anything you need before generating.`
                    : `The bank fields are pre-positioned for ${requestedService.title}. Adjust the names, accounts, and amount before generating.`}
                </p>
                {activeTab === 'email' ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      { label: 'Custom Mail', value: 'custom' },
                      { label: 'Deposit Mail', value: 'deposit' }
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => applyQuickTemplate(item.value)}
                        className="rounded-full border border-[#e6ddd0] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition hover:border-[#f2c39a]"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === 'bank' ? (
              <BankSlipForm data={bankFormData} onChange={handleBankFormChange} banks={NIGERIAN_BANKS} />
            ) : (
              <EmailReceiptForm data={emailFormData} onChange={handleEmailFormChange} />
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleGenerateReceipt}
                disabled={generating || !hasEnoughPoints}
                className="inline-flex flex-1 items-center justify-center rounded-full px-6 py-3.5 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: brand }}
              >
                {generating ? 'Generating...' : `Generate & Download (${cost} pts)`}
              </button>
              <Link
                to="/transactions"
                className="inline-flex items-center justify-center rounded-full border border-[#eadfce] bg-[#faf7f1] px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:border-[#f2c39a] hover:text-slate-950"
              >
                View History
              </Link>
            </div>
          </div>

          <div className="rounded-[30px] border border-[#e9e0d2] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Preview</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Live output</h2>
              </div>
              <div className="rounded-full border border-[#ece3d5] bg-[#faf7f1] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                PNG or PDF
              </div>
            </div>

            <div ref={previewRef} className="mt-6 rounded-[24px] bg-[#f7f4ed] p-4">
              {activeTab === 'bank' ? (
                <BankSlipPreview data={bankFormData} />
              ) : (
                <EmailReceiptPreview data={emailFormData} />
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => downloadReceipt('png')}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#eadfce] px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-[#f2c39a] hover:text-slate-950"
              >
                <Download size={16} />
                PNG
              </button>
              <button
                onClick={() => downloadReceipt('pdf')}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#eadfce] px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-[#f2c39a] hover:text-slate-950"
              >
                <Download size={16} />
                PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
