'use client';

import { useEffect, useState } from 'react';

type WebInfoSettings = {
  termsContent: string;
  privacyContent: string;
  updatedAt: string;
};

const emptySettings: WebInfoSettings = {
  termsContent: '',
  privacyContent: '',
  updatedAt: '',
};

export function AdminWebInfoPanel({ mode }: Readonly<{ mode: 'terms' | 'privacy' }>) {
  const [settings, setSettings] = useState<WebInfoSettings>(emptySettings);
  const [message, setMessage] = useState('웹정보 설정을 불러오는 중입니다.');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/admin/web-info');
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '웹정보 설정을 불러오지 못했습니다.');
      return;
    }
    setSettings(payload.settings);
    setMessage('회원가입에 표시되는 가입약관과 개인정보보호정책을 관리합니다.');
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    const response = await fetch('/api/admin/web-info', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '웹정보 설정 저장에 실패했습니다.');
      return;
    }
    setSettings(payload.settings);
    setMessage('웹정보 설정을 저장했습니다. 회원가입 화면에 바로 반영됩니다.');
  }

  function updateField(field: keyof WebInfoSettings, value: string) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  const title = mode === 'terms' ? '가입약관' : '개인정보보호정책';
  const description = mode === 'terms'
    ? '회원가입 화면에 표시되는 가입약관 내용을 수정합니다.'
    : '회원가입 화면에 표시되는 개인정보보호정책 내용을 수정합니다.';
  const fieldName = mode === 'terms' ? 'termsContent' : 'privacyContent';

  return (
    <section className="card wide" id={mode === 'terms' ? 'admin-web-info-terms' : 'admin-web-info-privacy'}>
      <div className="toolbar">
        <div>
          <h2>{title}</h2>
          <p className="notice compact">{description}</p>
        </div>
        <button className="button secondary" type="button" onClick={() => void refresh()} disabled={isBusy}>
          새로고침
        </button>
      </div>
      <form className="form admin-web-info-form" onSubmit={saveSettings}>
        <label htmlFor={`${mode}-content`}>
          {title}
          <textarea
            id={`${mode}-content`}
            rows={14}
            value={settings[fieldName]}
            onChange={(event) => updateField(fieldName, event.target.value)}
            required
          />
        </label>
        <button className="button" type="submit" disabled={isBusy}>
          {title} 저장
        </button>
      </form>
      <p className="notice">{message}</p>
      {settings.updatedAt && (
        <p className="notice compact">마지막 수정: {new Date(settings.updatedAt).toLocaleString('ko-KR')}</p>
      )}
    </section>
  );
}
