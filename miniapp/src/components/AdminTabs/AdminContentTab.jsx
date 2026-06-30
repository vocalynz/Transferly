import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../../context/AppContext';

export default function AdminContentTab() {
  const { config, updateConfig } = useAppContext();
  const [aboutUs, setAboutUs] = useState('');
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const [termsOfService, setTermsOfService] = useState('');
  const [saving, setSaving] = useState(null);
  const brand = config?.brand_color || '#f8812d';

  useEffect(() => {
    if (config) {
      setAboutUs(config.about_us || '');
      setPrivacyPolicy(config.privacy_policy || '');
      setTermsOfService(config.terms_of_service || '');
    }
  }, [config]);

  const handleSave = async (field, value) => {
    setSaving(field);
    const result = await updateConfig({ [field]: value });
    setSaving(null);
    if (result.success) toast.success('Saved successfully!');
    else toast.error(result.message || 'Failed to save');
  };

  const Section = ({ title, field, value, onChange }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <button
          onClick={() => handleSave(field, value)}
          disabled={saving === field}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white text-sm disabled:opacity-50 transition-all hover:shadow-md"
          style={{ backgroundColor: brand }}
        >
          <Save size={14} />
          {saving === field ? 'Saving...' : 'Save'}
        </button>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={8}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 text-sm text-gray-700 resize-y"
        placeholder={`Enter ${title.toLowerCase()} content...`}
      />
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <Section title="About Us" field="about_us" value={aboutUs} onChange={setAboutUs} />
      <Section title="Privacy Policy" field="privacy_policy" value={privacyPolicy} onChange={setPrivacyPolicy} />
      <Section title="Terms of Service" field="terms_of_service" value={termsOfService} onChange={setTermsOfService} />
    </div>
  );
}
