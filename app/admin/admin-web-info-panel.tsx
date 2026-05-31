'use client';

import { useEffect, useState } from 'react';
import { AdminRefreshButton } from './admin-refresh-button';
import { dispatchAdminRefreshEvent } from './admin-refresh-events';

type WebInfoSettings = {
  termsContent: string;
  privacyContent: string;
  planServices: Record<string, string[]>;
  updatedAt: string;
};

const emptySettings: WebInfoSettings = {
  termsContent: '',
  privacyContent: '',
  planServices: {
    plan_monthly: [],
    plan_half_year: [],
    plan_yearly: [],
  },
  updatedAt: '',
};

const PLAN_SERVICE_EDITORS = [
  { id: 'plan_monthly', label: 'BASIC' },
  { id: 'plan_half_year', label: 'PRO' },
  { id: 'plan_yearly', label: 'ELITE' },
];

export function AdminWebInfoPanel({ mode }: Readonly<{ mode: 'terms' | 'privacy' | 'planServices' }>) {
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
    setSettings(normalizeLoadedSettings(payload.settings));
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
    setSettings(normalizeLoadedSettings(payload.settings));
    setMessage('웹정보 설정을 저장했습니다. 회원가입과 구독 플랜 화면에 바로 반영됩니다.');
    dispatchAdminRefreshEvent({ source: 'webInfo' });
  }

  function updateField(field: 'termsContent' | 'privacyContent', value: string) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function updatePlanServices(planId: string, value: string) {
    setSettings((current) => ({
      ...current,
      planServices: {
        ...current.planServices,
        [planId]: parsePlanServiceLines(value),
      },
    }));
  }

  const title = getWebInfoEditorTitle(mode);
  const description = getWebInfoEditorDescription(mode);
  const fieldName = mode === 'terms' ? 'termsContent' : 'privacyContent';

  return (
    <section className="card wide" id={getWebInfoEditorSectionId(mode)}>
      <div className="toolbar">
        <div>
          <h2>{title}</h2>
          <p className="notice compact">{description}</p>
        </div>
        <AdminRefreshButton onClick={() => void refresh()} disabled={isBusy} />
      </div>
      <form className="form admin-web-info-form" onSubmit={saveSettings}>
        {mode === 'planServices' ? (
          <>
            <div className="plan-services-help">
              <strong>입력 안내</strong>
              <span>한 줄에 하나씩 서비스 항목을 입력하면 가격 페이지와 구독 선택 카드에 같은 순서로 표시됩니다.</span>
            </div>
            <div className="plan-services-grid">
              {PLAN_SERVICE_EDITORS.map((plan) => (
                <label htmlFor={`${plan.id}-services`} key={plan.id}>
                  {plan.label} 제공서비스
                  <textarea
                    id={`${plan.id}-services`}
                    rows={8}
                    value={(settings.planServices[plan.id] ?? []).join('\n')}
                    onChange={(event) => updatePlanServices(plan.id, event.target.value)}
                    placeholder="한 줄에 하나씩 제공서비스를 입력하세요"
                    required
                  />
                </label>
              ))}
            </div>
            <div className="plan-services-preview" aria-label="제공서비스 미리보기">
              {PLAN_SERVICE_EDITORS.map((plan) => {
                const services = settings.planServices[plan.id] ?? [];
                return (
                  <article key={plan.id}>
                    <span>{plan.label}</span>
                    <strong>{services.length}개 서비스 항목</strong>
                    <ul>
                      {services.map((service) => (
                        <li key={service}>{service}</li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
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
        )}
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

function parsePlanServiceLines(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function normalizeLoadedSettings(settings: Partial<WebInfoSettings>): WebInfoSettings {
  return {
    ...emptySettings,
    ...settings,
    planServices: {
      ...emptySettings.planServices,
      ...(settings.planServices ?? {}),
    },
  };
}

function getWebInfoEditorTitle(mode: 'terms' | 'privacy' | 'planServices'): string {
  if (mode === 'terms') return '가입약관';
  if (mode === 'privacy') return '개인정보보호정책';
  return '플랜 제공서비스';
}

function getWebInfoEditorDescription(mode: 'terms' | 'privacy' | 'planServices'): string {
  if (mode === 'terms') return '회원가입 화면에 표시되는 가입약관 내용을 수정합니다.';
  if (mode === 'privacy') return '회원가입 화면에 표시되는 개인정보보호정책 내용을 수정합니다.';
  return '가격 페이지와 구독 플랜 선택 카드에 표시되는 플랜별 제공서비스를 수정합니다.';
}

function getWebInfoEditorSectionId(mode: 'terms' | 'privacy' | 'planServices'): string {
  if (mode === 'terms') return 'admin-web-info-terms';
  if (mode === 'privacy') return 'admin-web-info-privacy';
  return 'admin-plan-services';
}
