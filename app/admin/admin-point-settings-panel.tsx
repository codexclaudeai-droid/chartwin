'use client';

import { useEffect, useState } from 'react';
import { AdminRefreshButton } from './admin-refresh-button';

type PointProgramSettings = {
  subscriberCashbackPercent: number;
  rewardPercent: number;
  salespersonRewardPercent: number;
  updatedAt: string;
};

const defaultSettings: PointProgramSettings = {
  subscriberCashbackPercent: 3,
  rewardPercent: 10,
  salespersonRewardPercent: 30,
  updatedAt: '',
};

export function AdminPointSettingsPanel() {
  const [settings, setSettings] = useState<PointProgramSettings>(defaultSettings);
  const [message, setMessage] = useState('포인트 정책을 불러오는 중입니다.');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/admin/point-settings', { cache: 'no-store' });
    const payload = await response.json();
    setIsBusy(false);

    if (!response.ok || !payload.settings) {
      setMessage(payload.message || '포인트 정책을 불러오지 못했습니다.');
      return;
    }

    setSettings(payload.settings);
    setMessage('정회원 캐시백, 추천, 영업자 포인트 기본 적립률을 관리합니다.');
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    const response = await fetch('/api/admin/point-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const payload = await response.json();
    setIsBusy(false);

    if (!response.ok || !payload.settings) {
      setMessage(payload.message || '포인트 정책 저장에 실패했습니다.');
      return;
    }

    setSettings(payload.settings);
    setMessage('포인트 정책을 저장했습니다. 이후 생성되는 포인트부터 적용됩니다.');
  }

  function updatePercent(field: keyof Omit<PointProgramSettings, 'updatedAt'>, value: string) {
    setSettings((current) => ({
      ...current,
      [field]: Number(value),
    }));
  }

  return (
    <section className="card wide" id="admin-point-settings">
      <div className="toolbar">
        <div>
          <h2>포인트관리</h2>
          <p className="notice compact">슈퍼관리자가 서비스 포인트 기본 적립률을 한 곳에서 설정합니다.</p>
        </div>
        <AdminRefreshButton onClick={() => void refresh()} disabled={isBusy} />
      </div>
      <form className="form admin-point-settings-form" onSubmit={saveSettings}>
        <div className="settings-grid">
          <label>
            정회원구독 캐시백포인트
            <input
              aria-label="정회원구독 캐시백포인트"
              max="100"
              min="0"
              onChange={(event) => updatePercent('subscriberCashbackPercent', event.target.value)}
              step="0.01"
              type="number"
              value={settings.subscriberCashbackPercent}
              required
            />
          </label>
          <label>
            추천포인트
            <input
              aria-label="추천포인트"
              max="100"
              min="0"
              onChange={(event) => updatePercent('rewardPercent', event.target.value)}
              step="0.01"
              type="number"
              value={settings.rewardPercent}
              required
            />
          </label>
          <label>
            영업자포인트
            <input
              aria-label="영업자포인트"
              max="100"
              min="0"
              onChange={(event) => updatePercent('salespersonRewardPercent', event.target.value)}
              step="0.01"
              type="number"
              value={settings.salespersonRewardPercent}
              required
            />
          </label>
        </div>
        <button className="button" type="submit" disabled={isBusy}>
          포인트 정책 저장
        </button>
      </form>
      <p className="notice">{message}</p>
      {settings.updatedAt && (
        <p className="notice compact">마지막 수정: {new Date(settings.updatedAt).toLocaleString('ko-KR')}</p>
      )}
    </section>
  );
}
