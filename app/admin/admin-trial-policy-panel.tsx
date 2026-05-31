'use client';

import { useEffect, useState } from 'react';
import { AdminRefreshButton } from './admin-refresh-button';

type FreeTrialPolicySettings = {
  baseDurationDays: number;
  eventEnabled: boolean;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  eventDurationDays: number | null;
  eventAllowReapply: boolean;
  updatedAt: string;
};

const defaultSettings: FreeTrialPolicySettings = {
  baseDurationDays: 7,
  eventEnabled: false,
  eventStartsAt: null,
  eventEndsAt: null,
  eventDurationDays: null,
  eventAllowReapply: false,
  updatedAt: '',
};

export function AdminTrialPolicyPanel() {
  const [settings, setSettings] = useState<FreeTrialPolicySettings>(defaultSettings);
  const [message, setMessage] = useState('무료체험 정책을 불러오는 중입니다.');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/admin/trial-policy', { cache: 'no-store' });
    const payload = await response.json();
    setIsBusy(false);

    if (!response.ok || !payload.settings) {
      setMessage(payload.message || '무료체험 정책을 불러오지 못했습니다.');
      return;
    }

    setSettings({ ...defaultSettings, ...payload.settings });
    setMessage('기본 무료체험 기간과 이벤트성 재신청 허용 정책을 관리합니다.');
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    const response = await fetch('/api/admin/trial-policy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const payload = await response.json();
    setIsBusy(false);

    if (!response.ok || !payload.settings) {
      setMessage(payload.message || '무료체험 정책 저장에 실패했습니다.');
      return;
    }

    setSettings({ ...defaultSettings, ...payload.settings });
    setMessage('무료체험 정책을 저장했습니다.');
  }

  function updateSetting<Key extends keyof FreeTrialPolicySettings>(
    key: Key,
    value: FreeTrialPolicySettings[Key],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="card wide" id="admin-trial-policy">
      <div className="toolbar">
        <div>
          <h2>무료체험 정책</h2>
          <p className="notice compact">무료체험 1회 제한은 유지하고, 이벤트 기간이나 회원별 예외만 별도로 열어둡니다.</p>
        </div>
        <AdminRefreshButton onClick={() => void refresh()} disabled={isBusy} />
      </div>
      <form className="form admin-trial-policy-form" onSubmit={saveSettings}>
        <div className="settings-grid">
          <label>
            기본 무료체험 일수
            <input
              aria-label="기본 무료체험 일수"
              min="1"
              max="365"
              onChange={(event) => updateSetting('baseDurationDays', Number(event.target.value))}
              type="number"
              value={settings.baseDurationDays}
              required
            />
          </label>
          <label>
            이벤트 무료체험 일수
            <input
              aria-label="이벤트 무료체험 일수"
              min="1"
              max="365"
              onChange={(event) => updateSetting('eventDurationDays', event.target.value ? Number(event.target.value) : null)}
              placeholder="기본 일수 사용"
              type="number"
              value={settings.eventDurationDays ?? ''}
            />
          </label>
          <label>
            이벤트 시작
            <input
              aria-label="이벤트 시작"
              onChange={(event) => updateSetting('eventStartsAt', event.target.value || null)}
              type="datetime-local"
              value={toDatetimeLocalValue(settings.eventStartsAt)}
            />
          </label>
          <label>
            이벤트 종료
            <input
              aria-label="이벤트 종료"
              onChange={(event) => updateSetting('eventEndsAt', event.target.value || null)}
              type="datetime-local"
              value={toDatetimeLocalValue(settings.eventEndsAt)}
            />
          </label>
        </div>
        <div className="checkbox-grid">
          <label className="checkbox-row">
            <input
              checked={settings.eventEnabled}
              onChange={(event) => updateSetting('eventEnabled', event.target.checked)}
              type="checkbox"
            />
            <span>이벤트 정책 사용</span>
          </label>
          <label className="checkbox-row">
            <input
              checked={settings.eventAllowReapply}
              onChange={(event) => updateSetting('eventAllowReapply', event.target.checked)}
              type="checkbox"
            />
            <span>이벤트 기간 동안 만료 회원 재신청 허용</span>
          </label>
        </div>
        <button className="button" type="submit" disabled={isBusy}>
          무료체험 정책 저장
        </button>
      </form>
      <p className="notice">{message}</p>
      {settings.updatedAt && (
        <p className="notice compact">마지막 수정: {new Date(settings.updatedAt).toLocaleString('ko-KR')}</p>
      )}
    </section>
  );
}

function toDatetimeLocalValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
