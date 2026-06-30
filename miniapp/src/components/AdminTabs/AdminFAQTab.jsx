import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../../context/AppContext';

const emptyFaq = { question: '', answer: '', order_index: 0 };

export default function AdminFAQTab() {
  const { faqs, addFaq, updateFaq, deleteFaq, config } = useAppContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyFaq);
  const [saving, setSaving] = useState(false);
  const brand = config?.brand_color || '#f8812d';

  const openAdd = () => { setEditing(null); setForm(emptyFaq); setModalOpen(true); };
  const openEdit = (faq) => { setEditing(faq); setForm({ question: faq.question, answer: faq.answer, order_index: faq.order_index }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyFaq); };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) { toast.error('Question and answer are required'); return; }
    setSaving(true);
    const result = editing ? await updateFaq(editing.id, form) : await addFaq(form);
    setSaving(false);
    if (result.success) { toast.success(editing ? 'FAQ updated!' : 'FAQ added!'); closeModal(); }
    else toast.error(result.message || 'Failed to save FAQ');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this FAQ?')) return;
    const result = await deleteFaq(id);
    if (result.success) toast.success('FAQ deleted');
    else toast.error(result.message || 'Failed to delete FAQ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">FAQs ({faqs.length})</h3>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white" style={{ backgroundColor: brand }}>
          <Plus size={18} /> Add FAQ
        </button>
      </div>

      <div className="space-y-4">
        {faqs.length === 0 && <div className="text-center py-10 text-gray-500">No FAQs yet. Add your first one!</div>}
        {faqs.map((faq) => (
          <div key={faq.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">{faq.question}</h4>
                <p className="text-sm text-gray-600">{faq.answer}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => openEdit(faq)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"><Edit2 size={16} /></button>
                <button onClick={() => handleDelete(faq.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit FAQ' : 'Add FAQ'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Question</label>
                <input type="text" value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2" placeholder="Enter question..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Answer</label>
                <textarea value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))} rows={4} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2" placeholder="Enter answer..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Order Index</label>
                <input type="number" value={form.order_index} onChange={e => setForm(p => ({ ...p, order_index: Number(e.target.value) }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2" />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50" style={{ backgroundColor: brand }}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
