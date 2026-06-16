'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SIGNAL_POLICY_SETTINGS,
  SIGNAL_EXECUTION_MODES,
  SIGNAL_FILL_MODELS,
  SIGNAL_SOURCES,
  normalizeSignalPolicySettings,
  type SignalExecutionMode,
  type SignalFillModel,
  type SignalPolicy,
  type SignalPolicySettings,
  type SignalSource,
} from '../../src/domain/chart-service/signal-policy.ts';
import { readRequiredJsonPayload } from './signal-admin-json';

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
    label: 'Index Futures',
    webhook: true,
    symbols: [
      { id: 'NQ1!', desc: 'NAS100 ft' },
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
  { id: 'strategy_js_donchian_trend_following', name: 'Donchian Trend Following', desc: 'Donchian breakout trend strategy with sideways filters' },
  { id: 'strategy_js_mtf_1m_scalper', name: 'MTF 1m Scalper', desc: '1m EMA cross with derived 5m trend filter' },
  { id: 'strategy_js_ml_cvd_ultimate_scalper', name: 'ML CVD Ultimate Scalper', desc: 'KNN scalper filtered by EMA trend, ATR range, and CVD flow' },
  { id: 'strategy_js_bb_mtf_kalman_signal', name: 'BB MTF Kalman Signal (JS)', desc: 'Bollinger Bands MTF with Kalman reversal signals' },
];

const DEFAULT_USER_STRATEGY_ID = 'strategy_js_grid_martingale';

const SOURCE_LABELS: Record<SignalSource, string> = {
  chart_strategy: '차트전략',
  ea_strategy: 'EA전략',
  actual_fill: '실제체결',
};

const EXECUTION_LABELS: Record<SignalExecutionMode, string> = {
  simple_signal: '단순 시그널',
  advanced_order_plan: '고급 주문계획',
  ea_signal: 'EA 시그널',
  actual_fill: '실제체결 기준',
};

const FILL_MODEL_LABELS: Record<SignalFillModel, string> = {
  ohlc_conservative: 'OHLC 보수적',
  ohlc_optimistic: 'OHLC 낙관적',
  ohlc_candle_path: 'OHLC 경로추정',
  next_open: '다음 봉 시가',
  next_tick: '다음 틱',
  tick_replay: '틱 리플레이',
  actual_fill: '실제 체결',
};

export function SignalAdminPanel() {
  const [hiddenSymbols, setHiddenSymbols] = useState<Set<string>>(new Set());
  const [disabledSymbols, setDisabledSymbols] = useState<Set<string>>(new Set());
  const [hiddenStrategies, setHiddenStrategies] = useState<Set<string>>(new Set());
  const [mgmtVisible, setMgmtVisible] = useState(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState(DEFAULT_USER_STRATEGY_ID);
  const [signalPolicy, setSignalPolicy] = useState<SignalPolicySettings>(DEFAULT_SIGNAL_POLICY_SETTINGS);
  const [draftSymbolId, setDraftSymbolId] = useState('NQ1!');
  const [loading, setLoading] = useState(true);
  const [savingSymbols, setSavingSymbols] = useState(false);
  const [savingStrategies, setSavingStrategies] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [authStatus, setAuthStatus] = useState<StatusState>(null);
  const [symbolStatus, setSymbolStatus] = useState<StatusState>(null);
  const [strategyStatus, setStrategyStatus] = useState<StatusState>(null);
  const [policyStatus, setPolicyStatus] = useState<StatusState>(null);

  useEffect(() => {
    void loadSettings();
  }, []);

  const symbolSummary = useMemo(() => {
    if (hiddenSymbols.size === 0 && disabledSymbols.size === 0) {
      return '모든 종목 표시, 웹훅 수신 활성';
    }
    return `숨김 ${hiddenSymbols.size}개 / 웹훅 중지 ${disabledSymbols.size}개`;
  }, [disabledSymbols, hiddenSymbols]);

  const strategySummary = useMemo(() => {
    const visibleCount = STRATEGIES.length - hiddenStrategies.size;
    const selected = STRATEGIES.find((strategy) => strategy.id === selectedStrategyId);
    return visibleCount > 0
      ? `노출 ${visibleCount}개 / 사용자 기본 ${selected?.name ?? DEFAULT_USER_STRATEGY_ID}`
      : '모든 전략이 숨김 상태입니다';
  }, [hiddenStrategies, selectedStrategyId]);

  const policySummary = useMemo(() => {
    const globalPolicy = signalPolicy.globalPolicy;
    return `${SOURCE_LABELS[globalPolicy.source]} / ${EXECUTION_LABELS[globalPolicy.executionMode]} / 예외 ${signalPolicy.symbolPolicies.length}개`;
  }, [signalPolicy]);

  async function loadSettings() {
    setLoading(true);
    try {
      const validateResponse = await fetch('/admin/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const validatePayload = await readRequiredJsonPayload(validateResponse);
      if (!validatePayload.ok) throw new Error(validatePayload.message || 'unauthorized');

      const [symbolsPayload, strategiesPayload, policyPayload] = await Promise.all([
        fetchJson('/admin/symbols'),
        fetchJson('/admin/strategies'),
        fetchJson('/admin/signal-policy'),
      ]);

      setHiddenSymbols(new Set((symbolsPayload.hidden ?? []).map((symbol: string) => symbol.toUpperCase())));
      setDisabledSymbols(new Set((symbolsPayload.disabled ?? []).map((symbol: string) => symbol.toUpperCase())));
      setHiddenStrategies(new Set(strategiesPayload.hidden ?? []));
      setMgmtVisible(Boolean(strategiesPayload.mgmtVisible));
      setSelectedStrategyId(strategiesPayload.selectedStrategyId || DEFAULT_USER_STRATEGY_ID);
      setSignalPolicy(normalizeSignalPolicySettings(policyPayload.signalPolicy, strategiesPayload.selectedStrategyId));
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
        message: `저장 완료 - 관리버튼 ${mgmtVisible ? 'ON' : 'OFF'} / 사용자 기본 ${payload.selectedStrategyId}`,
      });
    } catch (error) {
      setStrategyStatus({ type: 'err', message: `저장 실패: ${toReadableErrorMessage(error)}` });
    } finally {
      setSavingStrategies(false);
    }
  }

  async function saveSignalPolicy() {
    const confirmed = window.confirm(
      '시그널 정책을 변경하면 전체 차트의 시그널 표시, 리포트 계산, 알림 기준이 바뀔 수 있습니다. 저장할까요?',
    );
    if (!confirmed) return;

    setSavingPolicy(true);
    try {
      const payload = await postJson('/admin/signal-policy', { signalPolicy });
      const normalized = normalizeSignalPolicySettings(payload.signalPolicy, selectedStrategyId);
      setSignalPolicy(normalized);
      setPolicyStatus({
        type: 'ok',
        message: `저장 완료 - ${SOURCE_LABELS[normalized.globalPolicy.source]} 기준, 종목 예외 ${normalized.symbolPolicies.length}개`,
      });
    } catch (error) {
      setPolicyStatus({ type: 'err', message: `저장 실패: ${toReadableErrorMessage(error)}` });
    } finally {
      setSavingPolicy(false);
    }
  }

  function toggleSymbolVisibility(symbolId: string) {
    setHiddenSymbols((current) => toggleSetValue(current, symbolId.toUpperCase()));
  }

  function toggleSymbolWebhook(symbolId: string) {
    setDisabledSymbols((current) => toggleSetValue(current, symbolId.toUpperCase()));
  }

  function toggleStrategyVisibility(strategyId: string) {
    setHiddenStrategies((current) => {
      const next = toggleSetValue(current, strategyId);
      if (next.has(selectedStrategyId)) setSelectedStrategyId(DEFAULT_USER_STRATEGY_ID);
      return next;
    });
  }

  function updateGlobalPolicy(patch: Partial<SignalPolicy>) {
    setSignalPolicy((current) => normalizeSignalPolicySettings({
      ...current,
      globalPolicy: { ...current.globalPolicy, ...patch },
    }, selectedStrategyId));
  }

  function updateSymbolPolicy(symbolId: string, patch: Partial<SignalPolicy>) {
    setSignalPolicy((current) => normalizeSignalPolicySettings({
      ...current,
      symbolPolicies: current.symbolPolicies.map((policy) => (
        policy.symbolId === symbolId ? { ...policy, ...patch } : policy
      )),
    }, selectedStrategyId));
  }

  function addOrReplaceSymbolPolicy() {
    const symbolId = draftSymbolId.trim().toUpperCase();
    if (!symbolId) {
      setPolicyStatus({ type: 'err', message: '종목 ID를 입력해 주세요.' });
      return;
    }

    setSignalPolicy((current) => {
      const nextSymbolPolicy: SignalPolicy = {
        ...current.globalPolicy,
        scope: 'symbol',
        symbolId,
      };
      return normalizeSignalPolicySettings({
        ...current,
        symbolPolicies: [
          ...current.symbolPolicies.filter((policy) => policy.symbolId !== symbolId),
          nextSymbolPolicy,
        ],
      }, selectedStrategyId);
    });
    setPolicyStatus({ type: 'ok', message: `${symbolId} 종목 예외를 추가했습니다. 저장 버튼을 눌러 반영해 주세요.` });
  }

  function removeSymbolPolicy(symbolId: string) {
    setSignalPolicy((current) => normalizeSignalPolicySettings({
      ...current,
      symbolPolicies: current.symbolPolicies.filter((policy) => policy.symbolId !== symbolId),
    }, selectedStrategyId));
  }

  return (
    <div className="signal-admin-shell">
      <section className="signal-admin-card signal-admin-auth">
        <div>
          <span className="signal-admin-kicker">Super Admin</span>
          <h2>시그널 관리 콘솔</h2>
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
                <span className="signal-admin-kicker">Signal Policy</span>
                <h2>시그널 실행 정책</h2>
              </div>
              <span className="signal-admin-summary">{policySummary}</span>
            </div>

            <PolicyEditor
              title="전체 종목 기본 정책"
              policy={signalPolicy.globalPolicy}
              strategyOptions={STRATEGIES}
              onChange={updateGlobalPolicy}
            />

            <div className="signal-admin-policy-note">
              차트전략 단순 옵션은 기존 코인 차트처럼 확정 시그널 중심으로 표시합니다. 고급 주문계획은 전고점/전저점, 지정가/스탑, 손익비, 추적손절, 세션/스프레드 제약까지 리포트 계산 기준으로 확장하기 위한 옵션입니다.
            </div>

            <div className="signal-admin-policy-add">
              <input
                className="signal-admin-input"
                value={draftSymbolId}
                onChange={(event) => setDraftSymbolId(event.target.value)}
                placeholder="예: NQ1!, XAUUSD"
              />
              <button className="button secondary" type="button" onClick={addOrReplaceSymbolPolicy}>
                종목 예외 추가
              </button>
            </div>

            {signalPolicy.symbolPolicies.length > 0 ? (
              <div className="signal-admin-list">
                {signalPolicy.symbolPolicies.map((policy) => (
                  <div className="signal-admin-policy-card" key={policy.symbolId}>
                    <div className="signal-admin-section-head compact">
                      <div>
                        <span className="signal-admin-kicker">Symbol Override</span>
                        <h2>{policy.symbolId}</h2>
                      </div>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => policy.symbolId && removeSymbolPolicy(policy.symbolId)}
                      >
                        예외 제거
                      </button>
                    </div>
                    <PolicyEditor
                      title={`${policy.symbolId} 정책`}
                      policy={policy}
                      strategyOptions={STRATEGIES}
                      onChange={(patch) => policy.symbolId && updateSymbolPolicy(policy.symbolId, patch)}
                      compact
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="signal-admin-actions">
              <button className="button" type="button" onClick={saveSignalPolicy} disabled={savingPolicy}>
                {savingPolicy ? '저장 중' : '시그널 정책 저장'}
              </button>
              <StatusMessage status={policyStatus} compact />
            </div>
          </section>

          <section className="signal-admin-card">
            <div className="signal-admin-section-head">
              <div>
                <span className="signal-admin-kicker">Symbols</span>
                <h2>종목 표시 / 웹훅 관리</h2>
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
                            label={visible ? '표시' : '숨김'}
                            onChange={() => toggleSymbolVisibility(symbol.id)}
                          />
                          {group.webhook ? (
                            <ToggleControl
                              checked={webhookEnabled}
                              label={webhookEnabled ? '수신' : '중지'}
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
                {savingSymbols ? '저장 중' : '종목 설정 저장'}
              </button>
              <StatusMessage status={symbolStatus} compact />
            </div>
          </section>

          <section className="signal-admin-card">
            <div className="signal-admin-section-head">
              <div>
                <span className="signal-admin-kicker">Strategies</span>
                <h2>전략 노출 / 기본 전략</h2>
              </div>
              <span className="signal-admin-summary">{strategySummary}</span>
            </div>
            <div className="signal-admin-list">
              <div className="signal-admin-row signal-admin-strategy-row">
                <div>
                  <strong>개발자 화면 전략 관리 버튼</strong>
                  <small>/dev 전략 설정 모달에서 JS 보기, 수정, 삭제 버튼 노출 여부입니다.</small>
                </div>
                <ToggleControl
                  checked={mgmtVisible}
                  label={mgmtVisible ? 'ON' : 'OFF'}
                  onChange={() => setMgmtVisible((value) => !value)}
                />
                <span className="signal-admin-fixed">관리</span>
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
                      label={visible ? '표시' : '숨김'}
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
                      <span>{selected ? '기본' : '선택'}</span>
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

function PolicyEditor({
  title,
  policy,
  strategyOptions,
  onChange,
  compact = false,
}: Readonly<{
  title: string;
  policy: SignalPolicy;
  strategyOptions: StrategyItem[];
  onChange: (patch: Partial<SignalPolicy>) => void;
  compact?: boolean;
}>) {
  return (
    <div className={`signal-admin-policy-editor${compact ? ' compact' : ''}`}>
      <div className="signal-admin-policy-title">
        <strong>{title}</strong>
        <ToggleControl
          checked={policy.enabled}
          label={policy.enabled ? '사용' : '중지'}
          onChange={() => onChange({ enabled: !policy.enabled })}
        />
      </div>
      <label>
        <span>시그널 출처</span>
        <select
          className="signal-admin-select"
          value={policy.source}
          onChange={(event) => onChange({ source: event.target.value as SignalSource })}
        >
          {SIGNAL_SOURCES.map((source) => (
            <option key={source} value={source}>{SOURCE_LABELS[source]}</option>
          ))}
        </select>
      </label>
      <label>
        <span>전략 / 프로필</span>
        <select
          className="signal-admin-select"
          value={strategyOptions.some((strategy) => strategy.id === policy.strategyId) ? policy.strategyId : '__custom__'}
          onChange={(event) => {
            if (event.target.value !== '__custom__') onChange({ strategyId: event.target.value });
          }}
        >
          {strategyOptions.map((strategy) => (
            <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
          ))}
          <option value="__custom__">EA 또는 실제체결 프로필 직접 입력</option>
        </select>
        <input
          className="signal-admin-input"
          value={policy.strategyId}
          onChange={(event) => onChange({ strategyId: event.target.value })}
          placeholder="strategy id 또는 EA profile id"
        />
      </label>
      <label>
        <span>진입/청산 방식</span>
        <select
          className="signal-admin-select"
          value={policy.executionMode}
          onChange={(event) => onChange({ executionMode: event.target.value as SignalExecutionMode })}
        >
          {SIGNAL_EXECUTION_MODES.map((mode) => (
            <option key={mode} value={mode}>{EXECUTION_LABELS[mode]}</option>
          ))}
        </select>
      </label>
      <label>
        <span>체결/백테스트 기준</span>
        <select
          className="signal-admin-select"
          value={policy.fillModel}
          onChange={(event) => onChange({ fillModel: event.target.value as SignalFillModel })}
        >
          {SIGNAL_FILL_MODELS.map((model) => (
            <option key={model} value={model}>{FILL_MODEL_LABELS[model]}</option>
          ))}
        </select>
      </label>
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
  const payload = await readRequiredJsonPayload(response);
  if (!payload.ok) throw new Error(payload.message || 'failed');
  return payload;
}

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await readRequiredJsonPayload(response);
  if (!payload.ok) throw new Error(payload.message || 'failed');
  return payload;
}

function toggleSetValue(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function toReadableErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes('Session required')) return '슈퍼관리자 로그인이 필요합니다.';
  if (message.includes('Super admin')) return '슈퍼관리자 권한이 필요합니다.';
  return message || '요청을 처리하지 못했습니다.';
}
