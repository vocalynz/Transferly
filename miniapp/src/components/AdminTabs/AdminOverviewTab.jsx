import React, { useEffect, useState } from 'react';
import { Users, FileText, TrendingUp, Activity } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export default function AdminOverviewTab() {
  const { allUsers, fetchAllUsers, config } = useAppContext();
  const [loading, setLoading] = useState(true);
  const brand = config?.brand_color || '#f8812d';

  useEffect(() => {
    fetchAllUsers().finally(() => setLoading(false));
  }, []);

  const totalReceipts = allUsers.reduce((sum, u) => sum + (u.receipt_count || 0), 0);
  const totalPoints = allUsers.reduce((sum, u) => sum + (u.points || 0), 0);

  const stats = [
    { icon: Users, label: 'Total Users', value: allUsers.length, color: brand },
    { icon: FileText, label: 'DB Receipts', value: config?.total_receipts || 0, color: '#3b82f6' },
    { icon: TrendingUp, label: 'Platform Uptime', value: config?.uptime || '99.9%', color: '#10b981' },
    { icon: Activity, label: 'Total Points Held', value: totalPoints.toLocaleString(), color: '#f59e0b' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                <Icon size={24} style={{ color }} />
              </div>
            </div>
            <p className="text-gray-600 text-sm font-medium">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent Users */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Recent Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Email', 'Points', 'Referrals', 'Joined'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allUsers.slice(0, 10).map(u => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                  <td className="px-6 py-4 text-sm font-semibold" style={{ color: brand }}>{u.points}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.referral_count}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allUsers.length === 0 && (
          <div className="px-6 py-10 text-center text-gray-500">No users yet.</div>
        )}
      </div>
    </div>
  );
}
