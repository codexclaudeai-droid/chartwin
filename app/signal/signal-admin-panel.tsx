'use client';

import { useEffect, useMemo, useState } from 'react';

type SymbolItem = {
  id: string;
  desc: string;
};

type SymbolGroup = {
  label: string;
  webhook: boolean;
  symbols: SymbolItem[];
};

type StrategyItem = {
  id: string;
  name: string;
  desc: string;
};

type StatusState = {
  type: 'ok' | 'err';
  message: string;
} | null;

const SYMBOL_GROUPS: SymbolGroup[] = [
  {
    label: 'Index',
    webhook: true,
    symbols: [
      { id: 'NQ1!', desc: 'E-mini Nasdaq-100 Futures' },
      { id: 'SPX500', desc: 'S&P 500' },
      { id: 'HSI', desc: 'Hang Seng' },
      { id: 'KOSPI', desc: 'Korea Composite Stock Price Index' },
      { id: 'KOSPI200', desc: 'KOSPI 200' },
      { id: 'KOSDAQ', desc: 'Korea Securities Dealers Automated Quotations' },
    ],
  },
  {
    label: 'Crypto Spot',
    webhook: false,
    symbols: [
      { id: 'BTCUSDT', desc: 'Bitcoin / USDT' },
      { id: 'ETHUSDT', desc: 'Ethereum / USDT' },
      { id: 'SOLUSDT', desc: 'Solana / USDT' },
      { id: 'XRPUSDT', desc: 'XRP / USDT' },
      { id: 'BNBUSDT', desc: 'BNB / USDT' },
      { id: 'TRXUSDT', desc: 'TRX / USDT' },
    ],
  },
  {
    label: 'Crypto Futures',
    webhook: false,
    symbols: [
      { id: 'BTCUSDT.P', desc: 'BTCUSDT Perpetual Futures' },
      { id: 'ETHUSDT.P', desc: 'ETHUSDT Perpetual Futures' },
      { id: 'XRPUSDT.P', desc: 'XRPUSDT Perpetual Futures' },
      { id: 'BNBUSDT.P', desc: 'BNBUSDT Perpetual Futures' },
      { id: 'SOLUSDT.P', desc: 'SOLUSDT Perpetual Futures' },
      { id: 'TRXUSDT.P', desc: 'TRXUSDT Perpetual Futures' },
    ],
  },
  {
    label: 'Commodity',
    webhook: true,
    symbols: [
      { id: 'XAUUSD', desc: 'Gold / USD' },
      { id: 'WTI1!', desc: 'WTI Crude Oil Futures' },
      { id: 'XAGUSD', desc: 'Silver / USD' },
      { id: 'XAUUSDT.P', desc: 'Gold Perpetual Futures / USDT' },
      { id: 'XAGUSDT.P', desc: 'Silver Perpetual Futures / USDT' },
    ],
  },
];

const STRATEGIES: StrategyItem[] = [
  { id: 'strategy_js_sma_9_21', name: 'SMA 9/21 Cross (JS)', desc: 'Fast/slow SMA crossover signal' },
  { id: 'strategy_pine_sma_5_20', name: 'SMA 5/20 Cross (Pine)', desc: 'Pine input strategy compiled to JS' },
  { id: 'strategy_pine_bbands_directed', name: 'Bollinger Bands Directed (Pine)', desc: 'Bollinger breakout + trend-aware signals' },
  { id: 'strategy_js_double_break', name: 'Double Break Strategy (JS)', desc: 'BB upper/lower + Envelope upper/lower breakout' },
  { id: 'strategy_js_shayhuang_vwap_fast', name: 'ShayHuang_VWAP_Fast', desc: 'VWAP breakout with continuation filters' },
  { id: 'strategy_js_grid_martingale', name: 'Grid Martingale Scalping', desc: 'Grid martingale scalping strategy' },
  { id: 'strategy_js_grid_atr_bnf_srouter_v1', name: 'Grid+ATR+BNF+SRouter v1', desc: 'Adaptive grid strategy with ATR and regime routing' },
];

const DEFAULT_USER_STRATEGY_ID = 'strategy_js_grid_martingale';

export function SignalAdminPanel() {
  const [hiddenSymbols, setHiddenSymbols] = useState<Set<string>>(new Set());
  const [disabledSymbols, setDisabledSymbols] = useState<Set<string>>(new Set());
  const [hiddenStrategies, setHiddenStrategies] = useState<Set<string>>(new Set());
  const [mgmtVisible, setMgmtVisible] = useState(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState(DEFAULT_USER_STRATEGY_ID);
  const [loading, setLoading] = useState(true);
  const [savingSymbols, setSavingSymbols] = useState(false);
  const [savingStrategies, setSavingStrategies] = useState(false);
  const [authStatus, setAuthStatus] = useState<StatusState>(null);
  const [symbolStatus, setSymbolStatus] = useState<StatusState>(null);
  const [strategyStatus, setStrategyStatus] = useState<StatusState>(null);

  useEffect(() => {
    void loadSettings();
  }, []);

  const symbolSummary = useMemo(() => {
    if (hiddenSymbols.size === 0 && disabledSymbols.size === 0) {
      return '모든 종목이 정상 노출 중입니다.';
    }
    return `숨김 ${hiddenSymbols.size}개 / 웹훅 중지 ${disabledSymbols.size}개`;
  }, [disabledSymbols, hiddenSymbols]);

  const strategySummary = useMemo(() => {
    const visibleCount = STRATEGIES.length - hiddenStrategies.size;
    const selected = STRATEGIES.find((strategy) => strategy.id === selectedStrategyId);
    return visibleCount > 0
      ? `노출 ${visibleCount}개 / 사용자용 ${selected?.name ?? DEFAULT_USER_STRATEGY_ID}`
      : '모든 전략이 숨김 상태입니다.';
  }, [hiddenStrategies, selectedStrategyId]);

  async function loadSettings() {
    setLoading(true);
    try {
      const validateResponse = await fetch('/admin/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const validatePayload = await validateResponse.json();
      if (!validatePayload.ok) throw new Error(validatePayload.message || 'unauthorized');

      const [symbolsPayload, strategiesPayload] = await Promise.all([
        fetchJson('/admin/symbols'),
        fetchJson('/admin/strategies'),
      ]);

      setHiddenSymbols(new Set((symbolsPayload.hidden ?? []).map((symbol: string) => symbol.toUpperCase())));
      setDisabledSymbols(new Set((symbolsPayload.disabled ?? []).map((symbol: string) => symbol.toUpperCase())));
      setHiddenStrategies(new Set(strategiesPayload.hidden ?? []));
      setMgmtVisible(Boolean(strategiesPayload.mgmtVisible));
      setSelectedStrategyId(strategiesPayload.selectedStrategyId || DEFAULT_USER_STRATEGY_ID);
      setAuthStatus({ type: 'ok', message: '슈퍼관리자 권한이 확인되었습니다.' });
    } catch (error) {
      setAuthStatus({ type: 'err', message: `불러오기 실패: ${toReadableErrorMessage(error)}` });
    } finally {
      setLoading(false);
    }
  }

  async function saveSymbols() {
    setSavingSymbols(true);
    try {
      const payload = await postJson('/admin/symbols', {
        hidden: Array.from(hiddenSymbols),
        disabled: Array.from(disabledSymbols),
      });
      setSymbolStatus({
        type: 'ok',
        message: `저장 완료 - 숨김 ${payload.hidden.length}개 / 웹훅 중지 ${payload.disabled.length}개`,
      });
    } catch (error) {
      setSymbolStatus({ type: 'err', message: `저장 실패: ${toReadableErrorMessage(error)}` });
    } finally {
      setSavingSymbols(false);
    }
  }

  async function saveStrategies() {
    const nextSelected = hiddenStrategies.has(selectedStrategyId)
      ? DEFAULT_USER_STRATEGY_ID
      : selectedStrategyId;
    setSavingStrategies(true);
    try {
      const payload = await postJson('/admin/strategies', {
        hidden: Array.from(hiddenStrategies),
        mgmtVisible,
        selectedStrategyId: nextSelected,
      });
      setSelectedStrategyId(payload.selectedStrategyId || nextSelected);
      setStrategyStatus({
        type: 'ok',
        message: `저장 완료 - 관리버튼 ${mgmtVisible ? 'ON' : 'OFF'} / 사용자용 ${payload.selectedStrategyId}`,
      });
    } catch (error) {
      setStrategyStatus({ type: 'err', message: `저장 실패: ${toReadableErrorMessage(error)}` });
    } finally {
      setSavingStrategies(false);
    }
  }

  function toggleSymbolVisibility(symbolId: string) {
    setHiddenSymbols((current) => toggleSetValue(current, symbolId.toUpperCase(), true));
  }

  function toggleSymbolWebhook(symbolId: string) {
    setDisabledSymbols((current) => toggleSetValue(current, symbolId.toUpperCase(), true));
  }

  function toggleStrategyVisibility(strategyId: string) {
    setHiddenStrategies((current) => {
      const next = toggleSetValue(current, strategyId, true);
      if (next.has(selectedStrategyId)) setSelectedStrategyId(DEFAULT_USER_STRATEGY_ID);
      return next;
    });
  }

  return (
    <div className="signal-admin-shell">
      <section className="signal-admin-card signal-admin-auth">
        <div>
          <span className="signal-admin-kicker">Super Admin</span>
          <h2>전략시그널 관리</h2>
        </div>
        <button className="button secondary" type="button" onClick={loadSettings} disabled={loading}>
          {loading ? '확인 중' : '새로고침'}
        </button>
      </section>
      <StatusMessage status={authStatus} />

      {authStatus?.type === 'ok' ? (
        <>
          <section className="signal-admin-card">
            <div className="signal-admin-section-head">
              <div>
                <span className="signal-admin-kicker">Symbols</span>
                <h2>종목 관리</h2>
              </div>
              <span className="signal-admin-summary">{symbolSummary}</span>
            </div>
            <div className="signal-admin-groups">
              {SYMBOL_GROUPS.map((group) => (
                <div className="signal-admin-group" key={group.label}>
                  <div className="signal-admin-group-title">
                    <span>{group.label}</span>
                    {group.webhook ? <em>WEBHOOK</em> : null}
                  </div>
                  <div className="signal-admin-list">
                    {group.symbols.map((symbol) => {
                      const symbolId = symbol.id.toUpperCase();
                      const visible = !hiddenSymbols.has(symbolId);
                      const webhookEnabled = !disabledSymbols.has(symbolId);
                      return (
                        <div className="signal-admin-row" data-webhook={group.webhook} key={symbol.id}>
                          <div>
                            <strong>{symbol.id}</strong>
                            <small>{symbol.desc}</small>
                          </div>
                          <ToggleControl
                            checked={visible}
                            label={visible ? 'ON' : 'OFF'}
                            onChange={() => toggleSymbolVisibility(symbol.id)}
                          />
                          {group.webhook ? (
                            <ToggleControl
                              checked={webhookEnabled}
                              label={webhookEnabled ? 'ON' : 'OFF'}
                              tone="blue"
                              onChange={() => toggleSymbolWebhook(symbol.id)}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="signal-admin-actions">
              <button className="button" type="button" onClick={saveSymbols} disabled={savingSymbols}>
                {savingSymbols ? '저장 중' : '변경사항 저장'}
              </button>
              <StatusMessage status={symbolStatus} compact />
            </div>
          </section>

          <section className="signal-admin-card">
            <div className="signal-admin-section-head">
              <div>
                <span className="signal-admin-kicker">Strategies</span>
                <h2>전략 시그널 설정</h2>
              </div>
              <span className="signal-admin-summary">{strategySummary}</span>
            </div>
            <div className="signal-admin-list">
              <div className="signal-admin-row signal-admin-strategy-row">
                <div>
                  <strong>JS보기 / 수정 / 삭제 버튼</strong>
                  <small>개발자 화면의 전략 설정 모달에서만 보이는 관리 버튼입니다.</small>
                </div>
                <ToggleControl
                  checked={mgmtVisible}
                  label={mgmtVisible ? 'ON' : 'OFF'}
                  onChange={() => setMgmtVisible((value) => !value)}
                />
                <span className="signal-admin-fixed">고정</span>
              </div>
              {STRATEGIES.map((strategy) => {
                const visible = !hiddenStrategies.has(strategy.id);
                const selected = selectedStrategyId === strategy.id;
                return (
                  <div className="signal-admin-row signal-admin-strategy-row" key={strategy.id}>
                    <div>
                      <strong>{strategy.name}</strong>
                      <small>{strategy.desc}</small>
                    </div>
                    <ToggleControl
                      checked={visible}
                      label={visible ? 'ON' : 'OFF'}
                      onChange={() => toggleStrategyVisibility(strategy.id)}
                    />
                    <label className="signal-admin-radio">
                      <input
                        type="radio"
                        name="selected-strategy"
                        checked={selected}
                        disabled={!visible}
                        onChange={() => setSelectedStrategyId(strategy.id)}
                      />
                      <span>{selected ? 'ON' : 'OFF'}</span>
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="signal-admin-actions">
              <button className="button" type="button" onClick={saveStrategies} disabled={savingStrategies}>
                {savingStrategies ? '저장 중' : '전략 설정 저장'}
              </button>
              <StatusMessage status={strategyStatus} compact />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function ToggleControl({
  checked,
  label,
  onChange,
  tone = 'green',
}: Readonly<{
  checked: boolean;
  label: string;
  onChange: () => void;
  tone?: 'green' | 'blue';
}>) {
  return (
    <label className="signal-admin-toggle" data-tone={tone}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span aria-hidden="true" />
      <b>{label}</b>
    </label>
  );
}

function StatusMessage({ status, compact = false }: Readonly<{ status: StatusState; compact?: boolean }>) {
  if (!status) return null;
  return (
    <div className={`signal-admin-status ${status.type}${compact ? ' compact' : ''}`} role="status">
      {status.message}
    </div>
  );
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.message || 'failed');
  return payload;
}

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.message || 'failed');
  return payload;
}

function toggleSetValue(current: Set<string>, value: string, checkedMeansDelete: boolean) {
  const next = new Set(current);
  if (checkedMeansDelete ? next.has(value) : !next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

function toReadableErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes('Session required')) return '슈퍼관리자 로그인이 필요합니다.';
  if (message.includes('Super admin')) return '슈퍼관리자 권한이 필요합니다.';
  return message || '요청을 처리하지 못했습니다.';
}
