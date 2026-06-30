import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppContextProvider } from './context/AppContext';
import { MiniAppRuntimeProvider } from './context/MiniAppRuntimeContext';
import { TelegramMiniAppProvider } from './context/TelegramMiniAppContext';
import { AdminRoute } from './components/AdminRoute';
import { MiniAppRuntimeGate } from './components/MiniAppRuntimeGate';
import { MiniAppState } from './components/MiniAppState';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { RouteTransition } from './components/RouteTransition';
import {
  getProviderWorkspaceRoute,
  isProviderLaneSupported,
  isProviderManifestSlug
} from './lib/providerManifests';

const AdminPage = lazy(() => import('./pages/AdminPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const MiniAppPage = lazy(() => import('./pages/MiniAppPage'));

function RouteFallback() {
  return (
    <MiniAppState
      tone="loading"
      title="Loading Transferly workspace"
      description="Preparing provider tools, wallet controls, activity history, and secure Telegram-ready navigation."
    />
  );
}

function MiniAppRedirect({ to }) {
  const location = useLocation();

  return <Navigate to={`${to}${location.search}`} replace />;
}

const legacyProviderViewAliases = {
  activity: 'activity',
  balances: 'balances',
  billing: 'billing',
  collections: 'collections',
  compliance: 'compliance',
  confirmations: 'confirmations',
  connect: 'connect',
  customers: 'customers',
  developer: 'developer',
  invoice: 'invoices',
  invoices: 'invoices',
  overview: 'overview',
  payout: 'payouts',
  payouts: 'payouts',
  payments: 'payments',
  receive: 'receive',
  refunds: 'refunds',
  security: 'security',
  send: 'send',
  settlements: 'settlements',
  subscriptions: 'subscriptions',
  transfers: 'transfers',
  'virtual-accounts': 'virtual-accounts'
};

// Legacy service links used ?view=...; preserve deep links by mapping those
// values into provider workspace lanes and keeping unrelated query filters.
function buildLegacyProviderRoute(slug, lane, params) {
  params.delete('view');
  const query = params.toString();

  return `${getProviderWorkspaceRoute(slug, lane)}${query ? `?${query}` : ''}`;
}

function LegacyServiceRedirect() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const view = params.get('view') || '';
  const normalizedSlug = slug.toLowerCase();

  if (isProviderManifestSlug(normalizedSlug)) {
    const requestedLane = legacyProviderViewAliases[view] || view || 'overview';
    const lane = isProviderLaneSupported(normalizedSlug, requestedLane) ? requestedLane : 'overview';
    return <Navigate to={buildLegacyProviderRoute(normalizedSlug, lane, params)} replace />;
  }

  return <Navigate to={`/miniapp/services/${slug}${location.search}`} replace />;
}

function AppRoutes({ location }) {
  return (
    <Routes location={location}>
      {/* Public routes */}
      <Route path="/" element={<Navigate to="/miniapp" replace />} />
      <Route path="/login" element={<Navigate to="/miniapp" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/miniapp" replace />} />
      <Route path="/register" element={<Navigate to="/miniapp" replace />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/miniapp" element={<MiniAppPage />} />
      <Route path="/miniapp/:section" element={<MiniAppPage />} />
      <Route path="/miniapp/:section/:slug" element={<MiniAppPage />} />
      <Route path="/miniapp/services/:slug/:lane" element={<MiniAppPage />} />
      <Route path="/miniapp/services/:slug/:lane/*" element={<MiniAppPage />} />
      <Route path="/miniapp/:section/:slug/*" element={<MiniAppPage />} />

      {/* Legacy web-dashboard routes now land in the Telegram Mini App workspace. */}
      <Route path="/dashboard" element={<Navigate to="/miniapp" replace />} />
      <Route path="/services" element={<MiniAppRedirect to="/miniapp/services" />} />
      <Route path="/services/:slug" element={<LegacyServiceRedirect />} />
      <Route path="/buy-point" element={<MiniAppRedirect to="/miniapp/wallet" />} />
      <Route path="/buy-points" element={<MiniAppRedirect to="/miniapp/wallet" />} />
      <Route path="/transactions" element={<MiniAppRedirect to="/miniapp/vault" />} />
      <Route path="/orders" element={<MiniAppRedirect to="/miniapp/orders" />} />
      <Route path="/referral" element={<MiniAppRedirect to="/miniapp/profile" />} />
      <Route path="/profile" element={<MiniAppRedirect to="/miniapp/profile" />} />
      <Route path="/dashboard/generate" element={<MiniAppRedirect to="/miniapp/studio" />} />
      <Route path="/dashboard/history" element={<MiniAppRedirect to="/miniapp/vault" />} />
      <Route path="/dashboard/referral" element={<MiniAppRedirect to="/miniapp/profile" />} />
      <Route path="/dashboard/profile" element={<MiniAppRedirect to="/miniapp/profile" />} />

      {/* Admin route */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/miniapp" replace />} />
    </Routes>
  );
}

function AppFrame() {
  const location = useLocation();

  return (
    <RouteErrorBoundary resetKey={location.pathname}>
      <MiniAppRuntimeGate>
        <RouteTransition>
          {(transitionLocation) => (
            <Suspense fallback={<RouteFallback />}>
              <AppRoutes location={transitionLocation} />
            </Suspense>
          )}
        </RouteTransition>
      </MiniAppRuntimeGate>
      <Toaster position="top-right" />
    </RouteErrorBoundary>
  );
}

function App() {
  return (
    <AppContextProvider>
      <TelegramMiniAppProvider>
        <MiniAppRuntimeProvider>
          <Router>
            <AppFrame />
          </Router>
        </MiniAppRuntimeProvider>
      </TelegramMiniAppProvider>
    </AppContextProvider>
  );
}

export default App;
