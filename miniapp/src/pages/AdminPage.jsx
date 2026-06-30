import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { ArrowLeft } from 'lucide-react';

const AdminOverviewTab = lazy(() => import('../components/AdminTabs/AdminOverviewTab'));
const AdminSettingsTab = lazy(() => import('../components/AdminTabs/AdminSettingsTab'));
const AdminTestimonialsTab = lazy(() => import('../components/AdminTabs/AdminTestimonialsTab'));
const AdminFAQTab = lazy(() => import('../components/AdminTabs/AdminFAQTab'));
const AdminContentTab = lazy(() => import('../components/AdminTabs/AdminContentTab'));
const AdminPaymentsTab = lazy(() => import('../components/AdminTabs/PaymentsTab'));
const AdminUsersTab = lazy(() => import('../components/AdminTabs/AdminUsersTab'));

function AdminTabFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, fetchAllUsers } = useAppContext();
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'settings', label: 'Platform Settings' },
    { id: 'testimonials', label: 'Testimonials' },
    { id: 'faq', label: 'FAQ' },
    { id: 'content', label: 'Content Editor' },
    { id: 'payments', label: 'PayPal Ops' },
    { id: 'users', label: 'Users' },
  ];
  const requestedTab = searchParams.get('tab');
  const resolvedTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : 'overview';
  const [activeTab, setActiveTab] = useState(resolvedTab);

  useEffect(() => {
    fetchAllUsers();
  }, []);

  useEffect(() => {
    if (resolvedTab !== activeTab) {
      setActiveTab(resolvedTab);
    }
  }, [activeTab, resolvedTab]);

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600 font-semibold">Access Denied</p>
      </div>
    );
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tabId);
    if (tabId !== 'payments') {
      nextParams.delete('section');
    }
    setSearchParams(nextParams);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-sm text-gray-600">Platform Control Center</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-4 font-medium text-sm whitespace-nowrap transition border-b-2 ${
                  activeTab === tab.id
                    ? 'border-brand text-brand'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Suspense fallback={<AdminTabFallback />}>
          {activeTab === 'overview' && <AdminOverviewTab />}
          {activeTab === 'settings' && <AdminSettingsTab />}
          {activeTab === 'testimonials' && <AdminTestimonialsTab />}
          {activeTab === 'faq' && <AdminFAQTab />}
          {activeTab === 'content' && <AdminContentTab />}
          {activeTab === 'payments' && <AdminPaymentsTab />}
          {activeTab === 'users' && <AdminUsersTab />}
        </Suspense>
      </div>
    </div>
  );
}
