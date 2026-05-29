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

const BANK_LOGO_UPLOAD_ACCEPT = 'image/png,image/jpeg,image/webp';
const BANK_LOGO_UPLOAD_MAX_BYTES = 300_000;

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

  async function handleBankLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!BANK_LOGO_UPLOAD_ACCEPT.split(',').includes(file.type)) {
      setMessage('은행 로고는 PNG, JPG, WEBP 이미지만 업로드할 수 있습니다.');
      event.currentTarget.value = '';
      return;
    }
    if (file.size > BANK_LOGO_UPLOAD_MAX_BYTES) {
      setMessage('은행 로고 이미지는 300KB 이하로 업로드해주세요.');
      event.currentTarget.value = '';
      return;
    }
    const bankLogoUrl = await readBankLogoFileAsDataUrl(file);
    updateField('bankLogoUrl', bankLogoUrl);
    setMessage('은행 로고 이미지를 미리보기에 반영했습니다. 저장 버튼을 눌러 결제정보에 적용해주세요.');
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
            은행명
            <input
              value={settings.bankName}
              onChange={(event) => updateField('bankName', event.target.value)}
              placeholder="예: KB국민은행"
              required
            />
          </label>
          <label>
            은행 로고 이미지 업로드
            <input
              accept={BANK_LOGO_UPLOAD_ACCEPT}
              onChange={(event) => void handleBankLogoUpload(event)}
              type="file"
            />
            <small>PNG, JPG, WEBP / 최대 300KB</small>
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
              placeholder="예: TradingCore"
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

function readBankLogoFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Bank logo file could not be read.'));
    });
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Bank logo file could not be read.')));
    reader.readAsDataURL(file);
  });
}
