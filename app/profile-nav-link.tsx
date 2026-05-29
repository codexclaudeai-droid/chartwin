'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { subscribeAuthSessionChangedEvent } from './auth-events';
import { shouldShowProfileNavigation } from './session-nav-model';

type ProfileNavSessionPayload = {
  authenticated?: boolean;
};

export function ProfileNavLink() {
  const [canShow, setCanShow] = useState(false);

  async function refreshAccess() {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!response.ok) {
      setCanShow(false);
      return;
    }

    const payload = await response.json() as ProfileNavSessionPayload;
    setCanShow(shouldShowProfileNavigation(payload));
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
  return <Link href="/profile">마이프로필</Link>;
}
