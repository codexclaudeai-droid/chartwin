'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { NoticePopupRecord } from '../src/server/chart-service/repository.ts';

const NOTICE_POPUP_SNOOZE_MS = 24 * 60 * 60 * 1000;

export function NoticePopupViewer() {
  const pathname = usePathname();
  const canShowNoticePopup = !pathname?.startsWith('/admin');
  const [popups, setPopups] = useState<NoticePopupRecord[]>([]);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!canShowNoticePopup) {
      setPopups([]);
      return;
    }
    let cancelled = false;
    async function loadPopups() {
      const response = await fetch('/api/notice-popups', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (cancelled || !response.ok || !Array.isArray(payload.popups)) return;
      setPopups(payload.popups);
    }

    void loadPopups();
    return () => {
      cancelled = true;
    };
  }, [canShowNoticePopup]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const keys = popups
      .map((popup) => getNoticePopupDismissKey(popup))
      .filter((key) => (
        window.sessionStorage.getItem(key) === '1' ||
        isNoticePopupSnoozed(key)
      ));
    setDismissedKeys(new Set(keys));
  }, [popups]);

  const activePopup = useMemo(() => (
    popups.find((popup) => !dismissedKeys.has(getNoticePopupDismissKey(popup))) ?? null
  ), [dismissedKeys, popups]);

  function closePopup() {
    if (!activePopup || typeof window === 'undefined') return;
    const key = getNoticePopupDismissKey(activePopup);
    window.sessionStorage.setItem(key, '1');
    setDismissedKeys((current) => new Set([...current, key]));
  }

  function closePopupForDay() {
    if (!activePopup || typeof window === 'undefined') return;
    const key = getNoticePopupDismissKey(activePopup);
    window.localStorage.setItem(key, String(Date.now() + NOTICE_POPUP_SNOOZE_MS));
    setDismissedKeys((current) => new Set([...current, key]));
  }

  if (!canShowNoticePopup || !activePopup) return null;

  return (
    <div className="notice-popup-backdrop" role="presentation">
      <section className="notice-popup-dialog" role="dialog" aria-modal="true" aria-labelledby="notice-popup-title">
        <div className="notice-popup-header">
          <h2 id="notice-popup-title">{activePopup.title}</h2>
          <button type="button" aria-label="공지팝업 닫기" onClick={closePopup}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div
          className="notice-popup-content"
          dangerouslySetInnerHTML={{ __html: activePopup.bodyHtml }}
        />
        <div className="notice-popup-footer">
          <button type="button" className="button secondary" onClick={closePopupForDay}>24시간 동안 닫기</button>
          <button type="button" className="button" onClick={closePopup}>닫기</button>
        </div>
      </section>
    </div>
  );
}

function getNoticePopupDismissKey(popup: NoticePopupRecord): string {
  return `notice-popup-dismissed:${popup.id}:${popup.updatedAt}`;
}

function isNoticePopupSnoozed(key: string): boolean {
  if (typeof window === 'undefined') return false;
  const expiresAt = Number(window.localStorage.getItem(key));
  if (!Number.isFinite(expiresAt)) return false;
  if (expiresAt <= Date.now()) {
    window.localStorage.removeItem(key);
    return false;
  }
  return true;
}
