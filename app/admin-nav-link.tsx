'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { subscribeAuthSessionChangedEvent } from './auth-events';
import { canShowAdminNavigation } from './admin-nav-model';

type AdminNavSessionPayload = {
  authenticated?: boolean;
  user?: {
    role: string;
  } | null;
};

export function AdminNavLink() {
  const [canShow, setCanShow] = useState(false);

  async function refreshAccess() {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!response.ok) {
      setCanShow(false);
      return;
    }

    const payload = await response.json() as AdminNavSessionPayload;
    setCanShow(Boolean(payload.authenticated) && canShowAdminNavigation(payload.user?.role));
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
  return <Link href="/admin">관리자</Link>;
}
