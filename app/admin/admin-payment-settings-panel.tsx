'use client';

import { useEffect, useState } from 'react';

type PaymentTransferSettings = {
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  bankLogoUrl: string;
  usdtAddress: string;
  usdtNetwork: string;
  updatedAt: string;
};

const BANK_LOGO_PRESETS = [
  { bankName: 'KB국민은행', bankLogoUrl: '/bank-logos/kb.svg' },
  { bankName: '신한은행', bankLogoUrl: '/bank-logos/shinhan.svg' },
  { bankName: '하나은행', bankLogoUrl: '/bank-logos/hana.svg' },
  { bankName: '우리은행', bankLogoUrl: '/bank-logos/woori.svg' },
  { bankName: '카카오뱅크', bankLogoUrl: '/bank-logos/kakao.svg' },
  { bankName: '토스뱅크', bankLogoUrl: '/bank-logos/toss.svg' },
  { bankName: '직접 입력', bankLogoUrl: '/bank-logos/generic-bank.svg' },
];

const emptySettings: PaymentTransferSettings = {
  bankName: '',
  bankAccountNumber: '',
  bankAccountHolder: '',
  bankLogoUrl: '/bank-logos/generic-bank.svg',
  usdtAddress: '',
  usdtNetwork: 'TRC20',
  updatedAt: '',
};

export function AdminPaymentSettingsPanel() {
  const [settings, setSettings] = useState<PaymentTransferSettings>(emptySettings);
  const [message, setMessage] = useState('관리자 결제정보를 불러오는 중입니다.');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/admin/payment-settings');
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '결제정보를 불러오지 못했습니다.');
      return;
    }
    setSettings(payload.settings);
    setMessage('은행 입금과 USDT 이체 안내를 관리합니다.');
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    const response = await fetch('/api/admin/payment-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '결제정보 저장에 실패했습니다.');
      return;
    }
    setSettings(payload.settings);
    setMessage('결제정보를 저장했습니다. 구독 페이지 안내에 바로 반영됩니다.');
  }

  function updateField(field: keyof PaymentTransferSettings, value: string) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function selectBankPreset(bankName: string) {
    const preset = BANK_LOGO_PRESETS.find((item) => item.bankName === bankName);
    if (!preset) return;
    setSettings((current) => ({
      ...current,
      bankName: preset.bankName === '직접 입력' ? current.bankName : preset.bankName,
      bankLogoUrl: preset.bankLogoUrl,
    }));
  }

  return (
    <section className="card wide" id="admin-payment-settings">
      <div className="toolbar">
        <div>
          <h2>결제정보 입력</h2>
          <p className="notice compact">회원 구독 결제 화면에 표시할 은행 계좌와 USDT 이체 정보를 입력합니다.</p>
        </div>
        <button className="button secondary" type="button" onClick={() => void refresh()} disabled={isBusy}>
          새로고침
        </button>
      </div>
      <form className="form admin-payment-settings-form" onSubmit={saveSettings}>
        <div className="settings-grid">
          <label>
            은행 로고 선택
            <select
              value={BANK_LOGO_PRESETS.find((preset) => preset.bankLogoUrl === settings.bankLogoUrl)?.bankName ?? '직접 입력'}
              onChange={(event) => selectBankPreset(event.target.value)}
            >
              {BANK_LOGO_PRESETS.map((preset) => (
                <option key={preset.bankLogoUrl} value={preset.bankName}>{preset.bankName}</option>
              ))}
            </select>
          </label>
          <label>
            은행명
            <input
              value={settings.bankName}
              onChange={(event) => updateField('bankName', event.target.value)}
              placeholder="예: KB국민은행"
              required
            />
          </label>
          <label>
            은행 로고 이미지 URL
            <input
              value={settings.bankLogoUrl}
              onChange={(event) => updateField('bankLogoUrl', event.target.value)}
              placeholder="/bank-logos/kb.svg"
              required
            />
          </label>
          <div className="bank-logo-preview" aria-label="은행 로고 미리보기">
            <img alt={`${settings.bankName || '은행'} 로고`} src={settings.bankLogoUrl} />
            <span>{settings.bankName || '은행 로고 미리보기'}</span>
          </div>
          <label>
            은행 계좌번호
            <input
              value={settings.bankAccountNumber}
              onChange={(event) => updateField('bankAccountNumber', event.target.value)}
              placeholder="예: 123-456-7890"
              required
            />
          </label>
          <label>
            계좌주
            <input
              value={settings.bankAccountHolder}
              onChange={(event) => updateField('bankAccountHolder', event.target.value)}
              placeholder="예: TC Chart"
              required
            />
          </label>
          <label>
            USDT 주소
            <input
              value={settings.usdtAddress}
              onChange={(event) => updateField('usdtAddress', event.target.value)}
              placeholder="테더 입금 주소"
              required
            />
          </label>
          <label>
            USDT 네트워크
            <input
              value={settings.usdtNetwork}
              onChange={(event) => updateField('usdtNetwork', event.target.value)}
              placeholder="예: TRC20"
              required
            />
          </label>
        </div>
        <button className="button" type="submit" disabled={isBusy}>
          결제정보 저장
        </button>
      </form>
      <p className="notice">{message}</p>
      {settings.updatedAt && (
        <p className="notice compact">마지막 수정: {new Date(settings.updatedAt).toLocaleString('ko-KR')}</p>
      )}
    </section>
  );
}
