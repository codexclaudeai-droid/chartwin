'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { subscribeAuthSessionChangedEvent } from './auth-events';
import { getAuthSession } from './auth-session-client';
import { canShowAdminNavigation } from './admin-nav-model';

type AdminNavSessionPayload = {
  authenticated?: boolean;
  actor?: {
    role?: string;
  } | null;
  user?: {
    role?: string;
  } | null;
};

export function AdminNavLink() {
  const [canShow, setCanShow] = useState(false);

  async function refreshAccess() {
    const payload = await getAuthSession() as AdminNavSessionPayload;
    setCanShow(Boolean(payload.authenticated) && canShowAdminNavigation(payload.user?.role ?? payload.actor?.role));
  }

  useEffect(() => {
    let isMounted = true;
    const safeRefresh = async () => {
      if (isMounted) await refreshAccess();
    };

    void safeRefresh();
    const unsubscribe = subscribeAuthSessionChangedEvent(() => {
      void safeRefresh();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  if (!canShow) return null;
  return (
    <Link href="/admin">
      <span className="mobile-nav-link-icon" aria-hidden="true"><ShieldCheck /></span>
      <span className="mobile-nav-link-label">관리자페이지</span>
    </Link>
  );
}
