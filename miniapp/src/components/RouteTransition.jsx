import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const EXIT_DURATION_MS = 150;

const routeOrder = [
  'home',
  'services',
  'studio',
  'invoices',
  'payouts',
  'activity',
  'analytics',
  'notifications',
  'clients',
  'risk',
  'security',
  'vault',
  'orders',
  'wallet',
  'ops',
  'support',
  'profile',
  'settings',
  'admin',
  'content'
];

const routeAccents = {
  home: '#2aabee',
  services: '#0ea5e9',
  studio: '#a855f7',
  invoices: '#22c55e',
  payouts: '#14b8a6',
  activity: '#f59e0b',
  analytics: '#6366f1',
  notifications: '#ef4444',
  clients: '#06b6d4',
  risk: '#f97316',
  security: '#10b981',
  vault: '#8b5cf6',
  orders: '#3b82f6',
  wallet: '#229ed9',
  ops: '#64748b',
  support: '#229ed9',
  profile: '#ec4899',
  settings: '#94a3b8',
  admin: '#111827',
  content: '#2aabee'
};

const orderMap = routeOrder.reduce((memo, route, index) => {
  memo[route] = index;
  return memo;
}, {});

function sameLocation(left, right) {
  return left.pathname === right.pathname && left.search === right.search && left.hash === right.hash;
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getRouteSegment(pathname) {
  const parts = pathname.split('/').filter(Boolean);

  if (parts[0] === 'admin') {
    return 'admin';
  }

  if (parts[0] === 'miniapp') {
    return parts[1] || 'home';
  }

  return 'content';
}

function getRouteSignal(location) {
  const segment = getRouteSegment(location.pathname);
  const depth = location.pathname.split('/').filter(Boolean).length;
  const rank = orderMap[segment] ?? orderMap.content;
  const detailOffset = depth > 2 ? 0.5 : 0;

  return {
    depth,
    rank: rank + detailOffset,
    segment
  };
}

function getTransitionMeta(fromLocation, toLocation, navigationType) {
  const from = getRouteSignal(fromLocation);
  const to = getRouteSignal(toLocation);
  const movement = to.depth === from.depth ? to.rank - from.rank : to.depth - from.depth;
  const direction = navigationType === 'POP' || movement < 0 ? 'back' : movement > 0 ? 'forward' : 'neutral';
  const phaseStyle = navigationType === 'REPLACE' ? 'replace' : direction;

  return {
    accent: routeAccents[to.segment] || routeAccents.content,
    direction,
    route: to.segment,
    phaseStyle
  };
}

export function RouteTransition({ children }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const targetLocationRef = useRef(location);
  const timerRef = useRef(null);
  const initialMeta = useMemo(() => getTransitionMeta(location, location, navigationType), []);
  const [transition, setTransition] = useState({
    displayLocation: location,
    phase: 'enter',
    meta: initialMeta
  });

  useEffect(() => {
    if (sameLocation(location, targetLocationRef.current)) {
      return undefined;
    }

    const nextMeta = getTransitionMeta(targetLocationRef.current, location, navigationType);
    targetLocationRef.current = location;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (prefersReducedMotion()) {
      setTransition({
        displayLocation: location,
        phase: 'enter',
        meta: nextMeta
      });
      return undefined;
    }

    setTransition((current) => ({
      ...current,
      phase: 'exit',
      meta: nextMeta
    }));

    timerRef.current = window.setTimeout(() => {
      setTransition({
        displayLocation: targetLocationRef.current,
        phase: 'enter',
        meta: nextMeta
      });
      timerRef.current = null;
    }, EXIT_DURATION_MS);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [location, navigationType]);

  const style = {
    '--route-accent': transition.meta.accent
  };

  return (
    <div className="route-transition-host" style={style}>
      <div
        key={`${transition.displayLocation.pathname}${transition.displayLocation.search}${transition.displayLocation.hash}`}
        className="route-transition-view"
        data-direction={transition.meta.phaseStyle}
        data-phase={transition.phase}
        data-route={transition.meta.route}
      >
        {children(transition.displayLocation)}
      </div>
    </div>
  );
}
