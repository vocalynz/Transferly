import React, { useEffect, useState } from 'react';
import { Search, Plus, Minus, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../../context/AppContext';

export default function AdminUsersTab() {
  const { allUsers, fetchAllUsers, adjustUserPoints, config } = useAppContext();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(null);
  const brand = config?.brand_color || '#f8812d';

  useEffect(() => {
    fetchAllUsers().finally(() => setLoading(false));
  }, []);

  const filtered = allUsers.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdjust = async (userId, delta) => {
    setAdjusting(userId + delta);
    const result = await adjustUserPoints(userId, delta, delta > 0 ? 'Admin credit' : 'Admin debit');
    if (result.success) {
      await fetchAllUsers();
      toast.success(`${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} points`);
    } else {
      toast.error(result.message || 'Failed to adjust points');
    }
    setAdjusting(null);
  };

  const refresh = async () => {
    setLoading(true);
    await fetchAllUsers();
    setLoading(false);
    toast.success('Users refreshed');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
          />
        </div>
        <button onClick={refresh} className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Users ({filtered.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Email', 'Points', 'Referrals', 'Admin', 'Joined', 'Adjust Points'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                  <td className="px-6 py-4 text-sm font-bold" style={{ color: brand }}>{u.points}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.referral_count}</td>
                  <td className="px-6 py-4 text-sm">
                    {u.is_admin ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">Admin</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">User</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-1">
                      {[+10, +50, +100].map(delta => (
                        <button
                          key={delta}
                          onClick={() => handleAdjust(u.id, delta)}
                          disabled={adjusting === u.id + delta}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                        >
                          <Plus size={10} />{delta}
                        </button>
                      ))}
                      {[-10, -50].map(delta => (
                        <button
                          key={delta}
                          onClick={() => handleAdjust(u.id, delta)}
                          disabled={adjusting === u.id + delta}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                          <Minus size={10} />{Math.abs(delta)}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-6 py-10 text-center text-gray-500">No users found.</div>
        )}
      </div>
    </div>
  );
}
