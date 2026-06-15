'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AdminRefreshButton } from './admin-refresh-button';

type Mt45Platform = 'mt4' | 'mt5';

type Mt45SymbolRule = {
  market: string;
  symbol: string;
  tickStorageEnabled: boolean;
  priceStep: number;
};

type Mt45TickStorageSettings = {
  enabled?: boolean;
  retentionDays?: number;
  flushIntervalMs?: number;
  maxBatchSize?: number;
};

type Mt45ProfileSettings = {
  apiKeySet?: boolean;
  priceStep?: number;
  symbols?: Mt45SymbolRule[];
  tickStorage?: Mt45TickStorageSettings;
};

type Mt45Settings = {
  activePlatform?: Mt45Platform;
  profiles?: Partial<Record<Mt45Platform, Mt45ProfileSettings>>;
  ingestPath?: string;
  apiKeySet?: boolean;
  platform?: Mt45Platform;
  priceStep?: number;
  symbols?: Mt45SymbolRule[];
  tickStorage?: Mt45TickStorageSettings;
};

type MarketDataSettings = {
  mt45?: Mt45Settings;
  tickStorageAvailable?: boolean;
  pendingRawTicks?: number;
};

type StatusState = {
  type: 'ok' | 'err';
  message: string;
} | null;

type NormalizedMt45Profile = {
  apiKeySet: boolean;
  priceStep: number;
  symbols: Mt45SymbolRule[];
  tickStorage: Required<Mt45TickStorageSettings>;
};

type NormalizedMt45Settings = {
  activePlatform: Mt45Platform;
  profiles: Record<Mt45Platform, NormalizedMt45Profile>;
  ingestPath: string;
};

const DEFAULT_SYMBOLS: Mt45SymbolRule[] = [
  { market: 'futures', symbol: 'NQ1!', tickStorageEnabled: false, priceStep: 0.25 },
  { market: 'commodity', symbol: 'XAUUSD', tickStorageEnabled: false, priceStep: 0.1 },
];

const DEFAULT_TICK_STORAGE: Required<Mt45TickStorageSettings> = {
  enabled: false,
  retentionDays: 7,
  flushIntervalMs: 1000,
  maxBatchSize: 500,
};

const DEFAULT_PROFILE: NormalizedMt45Profile = {
  apiKeySet: false,
  priceStep: 0,
  symbols: DEFAULT_SYMBOLS,
  tickStorage: DEFAULT_TICK_STORAGE,
};

const DEFAULT_SETTINGS: NormalizedMt45Settings = {
  activePlatform: 'mt5',
  profiles: {
    mt4: DEFAULT_PROFILE,
    mt5: DEFAULT_PROFILE,
  },
  ingestPath: '/ingest/mt45/tick',
};

export function AdminMarketDataPanel() {
  const [settings, setSettings] = useState<MarketDataSettings>({});
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);

  const mt45 = normalizeMt45Settings(settings.mt45);
  const activeProfile = mt45.profiles[mt45.activePlatform];

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const payload = await fetchJson('/api/admin/market-data');
      setSettings(payload);
      setStatus({ type: 'ok', message: 'MT4/5 market data settings loaded.' });
    } catch (error) {
      setStatus({ type: 'err', message: `Load failed: ${toReadableErrorMessage(error)}` });
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const confirmed = window.confirm([
      '데이터 수집 설정을 변경합니다.',
      '',
      `${mt45.activePlatform.toUpperCase()} 프로필에 입력한 설정만 현재 저장 대상입니다.`,
      'Tick DB 저장을 ON으로 바꾸면 선택된 종목의 raw tick 데이터가 Supabase/Postgres에 누적되어 DB 용량과 비용에 영향을 줄 수 있습니다.',
      '슈퍼관리자 권한으로 변경하시겠습니까?',
    ].join('\n'));
    if (!confirmed) {
      setStatus({ type: 'err', message: '설정 저장이 취소되었습니다.' });
      return;
    }

    setSaving(true);
    try {
      const payload = await patchJson('/api/admin/market-data', {
        apiKey: apiKeyInput.trim() || undefined,
        activePlatform: mt45.activePlatform,
        profiles: mt45.profiles,
      });
      setSettings(payload);
      setApiKeyInput('');
      setStatus({ type: 'ok', message: `${mt45.activePlatform.toUpperCase()} profile saved.` });
    } catch (error) {
      setStatus({ type: 'err', message: `Save failed: ${toReadableErrorMessage(error)}` });
    } finally {
      setSaving(false);
    }
  }

  function updateMt45(next: Partial<NormalizedMt45Settings>) {
    setSettings((current) => ({
      ...current,
      mt45: {
        ...mt45,
        ...next,
      },
    }));
  }

  function updateActiveProfile(next: Partial<NormalizedMt45Profile>) {
    updateMt45({
      profiles: {
        ...mt45.profiles,
        [mt45.activePlatform]: {
          ...activeProfile,
          ...next,
        },
      },
    });
  }

  function updateActiveTickStorage(next: Partial<NormalizedMt45Profile['tickStorage']>) {
    updateActiveProfile({
      tickStorage: {
        ...activeProfile.tickStorage,
        ...next,
      },
    });
  }

  function updatePriceStep(value: string) {
    updateActiveProfile({ priceStep: Math.max(0, Number(value) || 0) });
  }

  function switchPlatform(platform: Mt45Platform) {
    setApiKeyInput('');
    updateMt45({ activePlatform: platform });
  }

  function updateSymbolRule(index: number, patch: Partial<Mt45SymbolRule>) {
    updateActiveProfile({
      symbols: activeProfile.symbols.map((rule, ruleIndex) => (
        ruleIndex === index ? { ...rule, ...patch } : rule
      )),
    });
  }

  function addSymbolRule() {
    updateActiveProfile({
      symbols: [
        ...activeProfile.symbols,
        { market: 'futures', symbol: '', tickStorageEnabled: false, priceStep: 0 },
      ],
    });
  }

  function removeSymbolRule(index: number) {
    updateActiveProfile({
      symbols: activeProfile.symbols.filter((_, ruleIndex) => ruleIndex !== index),
    });
  }

  const enabledSymbolCount = activeProfile.symbols.filter((rule) => rule.tickStorageEnabled).length;

  return (
    <section id="admin-market-data" className="card admin-market-data-panel">
      <div className="toolbar">
        <div>
          <span className="eyebrow">Market Data</span>
          <h2>MT4/5 데이터 수집 관리</h2>
          <p className="notice compact">
            MT4/5 EA WebRequest tick을 실시간 차트에 반영하고, 완성된 1분 OHLCV만 기본 저장합니다.
          </p>
        </div>
        <AdminRefreshButton onClick={() => void loadSettings()} disabled={loading || saving} />
      </div>

      <div className="admin-symbols-summary" aria-label="MT4/5 수집 상태">
        <div>
          <span>Active platform</span>
          <strong>{mt45.activePlatform.toUpperCase()}</strong>
        </div>
        <div>
          <span>EA API Key</span>
          <strong>{activeProfile.apiKeySet ? 'SET' : 'NEED'}</strong>
        </div>
        <div>
          <span>Raw tick symbols</span>
          <strong>{enabledSymbolCount}</strong>
        </div>
        <div>
          <span>Raw Tick Buffer</span>
          <strong>{settings.pendingRawTicks ?? 0}</strong>
        </div>
      </div>

      <form className="form admin-telegram-alerts-form" onSubmit={saveSettings}>
        <div className="admin-market-data-platform" role="radiogroup" aria-label="MT4 MT5 platform">
          <span>수집 플랫폼</span>
          <button
            aria-checked={mt45.activePlatform === 'mt4'}
            aria-label="MT4"
            className={mt45.activePlatform === 'mt4' ? 'active' : ''}
            disabled={loading || saving}
            onClick={() => switchPlatform('mt4')}
            role="radio"
            type="button"
          >
            <img
              alt="MetaTrader 4"
              className="admin-market-data-platform-logo"
              src="/images/metatrader-4-logo.png"
            />
          </button>
          <button
            aria-checked={mt45.activePlatform === 'mt5'}
            aria-label="MT5"
            className={mt45.activePlatform === 'mt5' ? 'active' : ''}
            disabled={loading || saving}
            onClick={() => switchPlatform('mt5')}
            role="radio"
            type="button"
          >
            <img
              alt="MetaTrader 5"
              className="admin-market-data-platform-logo"
              src="/images/metatrader-5-logo.png"
            />
          </button>
        </div>

        <p className="notice compact">
          MT4/MT5 profile values are saved independently. 플랫폼을 바꾸면 해당 플랫폼의 API key, Tick DB 저장,
          보관 기간, 종목별 raw tick 저장, price step 값만 편집합니다.
        </p>

        <button
          aria-checked={Boolean(activeProfile.tickStorage.enabled)}
          className="admin-market-data-toggle"
          data-state={activeProfile.tickStorage.enabled ? 'on' : 'off'}
          disabled={loading || saving}
          onClick={() => updateActiveTickStorage({ enabled: !activeProfile.tickStorage.enabled })}
          role="switch"
          type="button"
        >
          <span className="admin-market-data-toggle-track" aria-hidden="true">
            <span className="admin-market-data-toggle-thumb" />
          </span>
          <span className="admin-market-data-toggle-copy">
            <strong>Tick DB 저장 마스터</strong>
            <small>
              {activeProfile.tickStorage.enabled
                ? '아래에서 선택한 종목만 raw tick 저장'
                : '기본값: 모든 종목 raw tick 저장 안 함'}
            </small>
          </span>
          <b>{activeProfile.tickStorage.enabled ? 'ON' : 'OFF'}</b>
        </button>

        <div className="admin-telegram-alerts-fields">
          <label>
            <span>보관 기간(일)</span>
            <input
              min={1}
              max={365}
              type="number"
              value={activeProfile.tickStorage.retentionDays}
              onChange={(event) => updateActiveTickStorage({ retentionDays: Number(event.target.value) || 7 })}
            />
          </label>
          <label>
            <span>Flush interval(ms)</span>
            <input
              min={100}
              max={60000}
              type="number"
              value={activeProfile.tickStorage.flushIntervalMs}
              onChange={(event) => updateActiveTickStorage({ flushIntervalMs: Number(event.target.value) || 1000 })}
            />
          </label>
          <label>
            <span>Batch size</span>
            <input
              min={1}
              max={5000}
              type="number"
              value={activeProfile.tickStorage.maxBatchSize}
              onChange={(event) => updateActiveTickStorage({ maxBatchSize: Number(event.target.value) || 500 })}
            />
          </label>
          <label>
            <span>Fallback price step</span>
            <input
              min={0}
              step="0.00001"
              type="number"
              value={activeProfile.priceStep}
              onChange={(event) => updatePriceStep(event.target.value)}
            />
          </label>
          <label>
            <span>{mt45.activePlatform.toUpperCase()} EA API Key 변경</span>
            <input
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
              placeholder={activeProfile.apiKeySet ? '현재 키 유지' : '새 API key 입력'}
              type="password"
            />
          </label>
          <label>
            <span>Ingest path</span>
            <input readOnly value={mt45.ingestPath} />
          </label>
        </div>

        <div className="admin-market-data-symbols">
          <div className="toolbar">
            <div>
              <h3>{mt45.activePlatform.toUpperCase()} 종목별 raw tick 저장 / price step</h3>
              <p className="notice compact">
                Tick DB 마스터가 ON이어도 여기서 ON으로 선택한 종목만 raw tick을 저장합니다.
              </p>
            </div>
            <button className="button secondary compact" type="button" onClick={addSymbolRule} disabled={loading || saving}>
              종목 추가
            </button>
          </div>

          <div className="table-wrap">
            <table className="table admin-market-data-symbol-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Symbol</th>
                  <th>Raw tick 저장</th>
                  <th>Price step</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {activeProfile.symbols.map((rule, index) => (
                  <tr key={`${rule.market}:${rule.symbol}:${index}`}>
                    <td>
                      <select
                        value={rule.market}
                        onChange={(event) => updateSymbolRule(index, { market: event.target.value })}
                      >
                        <option value="futures">futures</option>
                        <option value="index">index</option>
                        <option value="commodity">commodity</option>
                        <option value="fx">fx</option>
                        <option value="crypto">crypto</option>
                      </select>
                    </td>
                    <td>
                      <input
                        value={rule.symbol}
                        onChange={(event) => updateSymbolRule(index, { symbol: event.target.value.toUpperCase() })}
                        placeholder="NQ1!"
                      />
                    </td>
                    <td>
                      <button
                        aria-checked={rule.tickStorageEnabled}
                        className={`admin-market-data-mini-toggle${rule.tickStorageEnabled ? ' active' : ''}`}
                        onClick={() => updateSymbolRule(index, { tickStorageEnabled: !rule.tickStorageEnabled })}
                        role="switch"
                        type="button"
                      >
                        {rule.tickStorageEnabled ? 'ON' : 'OFF'}
                      </button>
                    </td>
                    <td>
                      <input
                        min={0}
                        step="0.00001"
                        type="number"
                        value={rule.priceStep}
                        onChange={(event) => updateSymbolRule(index, { priceStep: Math.max(0, Number(event.target.value) || 0) })}
                      />
                    </td>
                    <td>
                      <button className="button secondary compact" type="button" onClick={() => removeSymbolRule(index)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
                {!activeProfile.symbols.length && (
                  <tr>
                    <td colSpan={5}>등록된 종목 규칙이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="notice compact">
          Price step은 시간 tick이 아니라 가격 최소 단위입니다. 풋프린트/CVD의 price level을 묶을 때 쓰며,
          예를 들어 NQ/ES는 보통 0.25, 달러 단위 상품은 0.01, 금은 브로커 가격 단위에 맞춰 0.01 또는 0.1로 둡니다.
        </p>
        <p className="notice compact">
          기본 운영값은 Tick DB 저장 OFF입니다. 정밀 검증이 필요할 때만 ON으로 바꾸고 7일, 14일, 30일 보관기간을 선택하세요.
          {settings.tickStorageAvailable ? '' : ' 현재 Postgres tick store 연결이 없어 ON으로 바꿔도 저장되지 않습니다.'}
        </p>
        <p className="notice compact">
          이 메뉴는 슈퍼관리자만 저장할 수 있습니다. 저장 시 raw tick 누적, DB 용량, 보관기간 변경에 대한 확인 경고가 표시됩니다.
        </p>

        <div className="toolbar-actions">
          <button className="button" type="submit" disabled={loading || saving}>
            {saving ? 'Saving...' : '설정 저장'}
          </button>
        </div>
      </form>

      {status ? (
        <p className={`notice admin-telegram-alerts-status ${status.type}`} role="status">
          {status.message}
        </p>
      ) : null}
    </section>
  );
}

function normalizeMt45Settings(settings: Mt45Settings | undefined): NormalizedMt45Settings {
  const legacyPlatform = normalizeClientPlatform(settings?.platform);
  const activePlatform = normalizeClientPlatform(settings?.activePlatform || legacyPlatform);
  return {
    activePlatform,
    profiles: {
      mt4: normalizeProfileSettings(settings?.profiles?.mt4, legacyPlatform === 'mt4' ? settings : undefined),
      mt5: normalizeProfileSettings(settings?.profiles?.mt5, legacyPlatform === 'mt5' ? settings : undefined),
    },
    ingestPath: settings?.ingestPath || DEFAULT_SETTINGS.ingestPath,
  };
}

function normalizeProfileSettings(
  profile: Mt45ProfileSettings | undefined,
  legacyProfile: Mt45Settings | undefined,
): NormalizedMt45Profile {
  const source = profile || legacyProfile || {};
  return {
    apiKeySet: Boolean(source.apiKeySet),
    priceStep: Math.max(0, Number(source.priceStep) || DEFAULT_PROFILE.priceStep),
    symbols: normalizeClientSymbolRules(source.symbols),
    tickStorage: {
      ...DEFAULT_TICK_STORAGE,
      ...(source.tickStorage || {}),
    },
  };
}

function normalizeClientPlatform(platform: string | undefined): Mt45Platform {
  return platform === 'mt4' || platform === 'mt5' ? platform : DEFAULT_SETTINGS.activePlatform;
}

function normalizeClientSymbolRules(rules: Mt45SymbolRule[] | undefined): Mt45SymbolRule[] {
  if (!Array.isArray(rules)) return DEFAULT_SYMBOLS.map((rule) => ({ ...rule }));
  return rules.map((rule) => ({
    market: rule.market || 'futures',
    symbol: String(rule.symbol || '').toUpperCase(),
    tickStorageEnabled: Boolean(rule.tickStorageEnabled),
    priceStep: Math.max(0, Number(rule.priceStep) || 0),
  }));
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.message || 'request failed');
  return payload;
}

async function patchJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.message || 'request failed');
  return payload;
}

function toReadableErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || '');
}
