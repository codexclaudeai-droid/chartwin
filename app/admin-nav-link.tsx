'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { subscribeAuthSessionChangedEvent } from './auth-events';
import { getAuthSession } from './auth-session-client';
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
    const payload = await getAuthSession() as AdminNavSessionPayload;
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
