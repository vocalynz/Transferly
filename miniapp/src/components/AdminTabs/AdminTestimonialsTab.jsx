import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Save, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../../context/AppContext';

const emptyT = { name: '', role: '', content: '', rating: 5, avatar: '', is_active: true, order_index: 0 };

export default function AdminTestimonialsTab() {
  const { testimonials, addTestimonial, updateTestimonial, deleteTestimonial, config } = useAppContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyT);
  const [saving, setSaving] = useState(false);
  const brand = config?.brand_color || '#f8812d';

  const openAdd = () => { setEditing(null); setForm(emptyT); setModalOpen(true); };
  const openEdit = (t) => { setEditing(t); setForm({ name: t.name, role: t.role, content: t.content, rating: t.rating, avatar: t.avatar, is_active: t.is_active, order_index: t.order_index }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyT); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.role.trim() || !form.content.trim()) { toast.error('Name, role, and content are required'); return; }
    setSaving(true);
    const result = editing ? await updateTestimonial(editing.id, form) : await addTestimonial(form);
    setSaving(false);
    if (result.success) { toast.success(editing ? 'Testimonial updated!' : 'Testimonial added!'); closeModal(); }
    else toast.error(result.message || 'Failed to save');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this testimonial?')) return;
    const result = await deleteTestimonial(id);
    if (result.success) toast.success('Deleted');
    else toast.error(result.message || 'Failed to delete');
  };

  const Stars = ({ rating }) => (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => <Star key={i} size={14} fill={i <= rating ? '#f59e0b' : 'none'} stroke={i <= rating ? '#f59e0b' : '#d1d5db'} />)}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Testimonials ({testimonials.length})</h3>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white" style={{ backgroundColor: brand }}>
          <Plus size={18} /> Add Testimonial
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {testimonials.length === 0 && <div className="col-span-2 text-center py-10 text-gray-500">No testimonials yet.</div>}
        {testimonials.map(t => (
          <div key={t.id} className={`bg-white rounded-xl shadow-sm border p-6 ${!t.is_active ? 'opacity-60' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center font-bold text-sm" style={{ color: brand }}>
                    {t.avatar || t.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
                <Stars rating={t.rating} />
                <p className="text-sm text-gray-600 mt-2 line-clamp-3">{t.content}</p>
                {!t.is_active && <span className="mt-2 inline-block text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Hidden</span>}
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button onClick={() => openEdit(t)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><Edit2 size={16} /></button>
                <button onClick={() => handleDelete(t.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit' : 'Add'} Testimonial</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Role *</label>
                  <input type="text" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2" placeholder="Business Owner" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Avatar (initials or emoji)</label>
                <input type="text" value={form.avatar} onChange={e => setForm(p => ({ ...p, avatar: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2" placeholder="JD or 😊" maxLength={4} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Content *</label>
                <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2" placeholder="Testimonial content..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rating (1–5)</label>
                  <input type="number" min={1} max={5} value={form.rating} onChange={e => setForm(p => ({ ...p, rating: Number(e.target.value) }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Order Index</label>
                  <input type="number" value={form.order_index} onChange={e => setForm(p => ({ ...p, order_index: Number(e.target.value) }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2" />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 rounded" style={{ accentColor: brand }} />
                <span className="text-sm font-medium text-gray-700">Active (visible on site)</span>
              </label>
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
