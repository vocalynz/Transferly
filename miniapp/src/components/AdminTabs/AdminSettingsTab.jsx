import React, { useState, useEffect } from 'react';
import { Save, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../../context/AppContext';
import { getStoredAdminToken, setStoredAdminToken } from '../../lib/api';

export default function AdminSettingsTab() {
  const { config, updateConfig } = useAppContext();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [adminTokenDraft, setAdminTokenDraft] = useState('');
  const [hasAdminToken, setHasAdminToken] = useState(false);
  const brand = config?.brand_color || '#f8812d';

  useEffect(() => {
    if (config) setForm({ ...config });
  }, [config]);

  useEffect(() => {
    setHasAdminToken(Boolean(getStoredAdminToken()));
  }, []);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    const { id, created_at, ...updates } = form;
    const result = await updateConfig(updates);
    setSaving(false);
    if (result.success) toast.success('Settings saved!');
    else toast.error(result.message || 'Failed to save settings');
  };

  const handleSaveAdminToken = () => {
    const token = adminTokenDraft.trim();
    if (!token) {
      toast.error('Enter an admin token first');
      return;
    }

    setStoredAdminToken(token);
    setAdminTokenDraft('');
    setHasAdminToken(true);
    toast.success('Admin token saved');
  };

  const handleClearAdminToken = () => {
    setStoredAdminToken('');
    setAdminTokenDraft('');
    setHasAdminToken(false);
    toast.success('Admin token cleared');
  };

  const Field = ({ label, field, type = 'text', note }) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <input
        type={type}
        value={form[field] ?? ''}
        onChange={e => set(field, type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition"
      />
      {note && <p className="text-xs text-gray-500 mt-1">{note}</p>}
    </div>
  );

  const Section = ({ title, children }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">{title}</h3>
      {children}
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <Section title="Platform Information">
        <Field label="Platform Name" field="platform_name" />
        <Field label="Tagline" field="tagline" />
        <Field label="Support Email" field="support_email" type="email" />
        <Field label="Admin Email" field="admin_email" type="email" />
      </Section>

      <Section title="Admin Session">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Static Admin API Token</label>
          <input
            type="password"
            value={adminTokenDraft}
            onChange={e => setAdminTokenDraft(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition"
            placeholder={hasAdminToken ? 'Admin token saved' : 'Paste admin token'}
          />
          <p className="text-xs text-gray-500 mt-1">
            Status: {hasAdminToken ? 'admin token stored in this browser' : 'no static admin token stored'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSaveAdminToken}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ShieldCheck size={16} />
            Save Token
          </button>
          <button
            type="button"
            onClick={handleClearAdminToken}
            disabled={!hasAdminToken && !adminTokenDraft}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={16} />
            Clear Token
          </button>
        </div>
      </Section>

      <Section title="Branding">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Brand Color</label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={form.brand_color || '#f8812d'}
              onChange={e => set('brand_color', e.target.value)}
              className="w-14 h-10 cursor-pointer border border-gray-300 rounded-lg p-1"
            />
            <input
              type="text"
              value={form.brand_color || '#f8812d'}
              onChange={e => set('brand_color', e.target.value)}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 font-mono"
              placeholder="#f8812d"
            />
          </div>
        </div>
      </Section>

      <Section title="Points & Fees">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Wallet Record Cost (pts)" field="bank_slip_cost" type="number" note="Points deducted per wallet record" />
          <Field label="Notification Cost (pts)" field="email_receipt_cost" type="number" note="Points deducted per notification receipt" />
          <Field label="New User Bonus (pts)" field="signup_bonus" type="number" note="Points given after a Telegram-started account is created" />
          <Field label="Referral Bonus (pts)" field="referral_bonus" type="number" note="Points earned per successful referral" />
        </div>
      </Section>

      <Section title="Payout Policy">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Minimum Payout (cents)"
            field="payout_minimum_cents"
            type="number"
            note="Requests below this amount are rejected before PayPal processing."
          />
          <Field
            label="Manual Review Threshold (cents)"
            field="payout_manual_review_cents"
            type="number"
            note="Requests at or above this amount are held for admin approval."
          />
          <Field
            label="Fixed Payout Fee (cents)"
            field="payout_fee_fixed_cents"
            type="number"
            note="Flat fee added to the reserved wallet debit for each payout."
          />
          <Field
            label="Variable Fee (bps)"
            field="payout_fee_percentage_bps"
            type="number"
            note="Basis points added on top of the fixed fee. 100 bps = 1%."
          />
        </div>
      </Section>

      <Section title="Platform Statistics (Display)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Total Users" field="total_users" type="number" />
          <Field label="Total Receipts" field="total_receipts" type="number" />
          <Field label="Uptime" field="uptime" note='e.g. "99.9%"' />
        </div>
      </Section>

      <Section title="About & Legal Content">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">About Us</label>
          <textarea value={form.about_us || ''} onChange={e => set('about_us', e.target.value)} rows={4} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Privacy Policy</label>
          <textarea value={form.privacy_policy || ''} onChange={e => set('privacy_policy', e.target.value)} rows={4} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Terms of Service</label>
          <textarea value={form.terms_of_service || ''} onChange={e => set('terms_of_service', e.target.value)} rows={4} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2" />
        </div>
      </Section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-8 py-3 rounded-lg font-semibold text-white transition-all hover:shadow-lg active:scale-95 disabled:opacity-50"
        style={{ backgroundColor: brand }}
      >
        <Save size={18} />
        {saving ? 'Saving...' : 'Save All Settings'}
      </button>
    </div>
  );
}
