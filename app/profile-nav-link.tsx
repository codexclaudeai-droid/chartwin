'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { subscribeAuthSessionChangedEvent } from './auth-events';
import { getAuthSession } from './auth-session-client';
import { shouldShowProfileNavigation } from './session-nav-model';

type ProfileNavSessionPayload = {
  authenticated?: boolean;
};

export function ProfileNavLink() {
  const [canShow, setCanShow] = useState(false);

  async function refreshAccess() {
    const payload = await getAuthSession() as ProfileNavSessionPayload;
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
