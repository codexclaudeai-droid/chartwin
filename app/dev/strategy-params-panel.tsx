'use client';

import { useEffect, useMemo, useState } from 'react';

type StrategyParameterProfile = {
  id?: string;
  strategyId: string;
  symbolId?: string | null;
  name?: string;
  params: Record<string, string | number | boolean>;
  enabled?: boolean;
};

type StrategyParameterPayload = {
  ok?: boolean;
  message?: string;
  strategyParams?: {
    profiles?: StrategyParameterProfile[];
  };
};

type StatusState = {
  type: 'ok' | 'err' | 'info';
  message: string;
};

const STRATEGIES = [
  { id: 'strategy_js_grid_martingale', name: 'Grid Martingale Scalping' },
  { id: 'strategy_js_grid_atr_bnf_srouter_v1', name: 'Grid+ATR+BNF+SRouter v1' },
  { id: 'strategy_js_donchian_trend_following', name: 'Donchian Trend Following' },
  { id: 'strategy_js_double_break', name: 'Double Break Strategy' },
  { id: 'strategy_js_mtf_1m_scalper', name: 'MTF 1m Scalper' },
  { id: 'strategy_js_ml_cvd_ultimate_scalper', name: 'ML CVD Ultimate Scalper' },
  { id: 'strategy_js_bb_mtf_kalman_signal', name: 'BB MTF Kalman Signal' },
  { id: 'strategy_js_shayhuang_vwap_fast', name: 'ShayHuang VWAP Fast' },
  { id: 'strategy_js_sma_9_21', name: 'SMA 9/21 Cross' },
  { id: 'strategy_pine_sma_5_20', name: 'SMA 5/20 Cross Pine' },
  { id: 'strategy_pine_bbands_directed', name: 'Bollinger Bands Directed Pine' },
] as const;

const DEFAULT_PARAMS = `{
  "entryTiming": "signal",
  "fillModel": "next_open",
  "stopMode": "swing",
  "riskReward": 2
}`;

export function DevStrategyParamsPanel() {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<StrategyParameterProfile[]>([]);
  const [strategyId, setStrategyId] = useState<string>(STRATEGIES[0].id);
  const [scope, setScope] = useState<'global' | 'symbol'>('global');
  const [symbolId, setSymbolId] = useState('NQ1!');
  const [paramsText, setParamsText] = useState(DEFAULT_PARAMS);
  const [status, setStatus] = useState<StatusState>({
    type: 'info',
    message: '서버 전략 파라미터를 불러오는 중입니다.',
  });

  const selectedProfile = useMemo(() => {
    const normalizedSymbol = symbolId.trim().toUpperCase();
    return profiles.find((profile) => (
      profile.strategyId === strategyId
      && (scope === 'global'
        ? !profile.symbolId
        : profile.symbolId === normalizedSymbol)
    )) ?? null;
  }, [profiles, scope, strategyId, symbolId]);

  useEffect(() => {
    void loadProfiles();
  }, []);

  useEffect(() => {
    if (!selectedProfile) return;
    setParamsText(JSON.stringify(selectedProfile.params ?? {}, null, 2));
  }, [selectedProfile?.id]);

  async function loadProfiles() {
    setLoading(true);
    try {
      const payload = await fetchStrategyParams();
      const nextProfiles = payload.strategyParams?.profiles ?? [];
      setProfiles(nextProfiles);
      setStatus({
        type: 'ok',
        message: `불러오기 완료: 저장된 프로필 ${nextProfiles.length}개`,
      });
    } catch (error) {
      setStatus({ type: 'err', message: toMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const params = parseParams(paramsText);
      const normalizedSymbol = scope === 'symbol' ? symbolId.trim().toUpperCase() : null;
      if (scope === 'symbol' && !normalizedSymbol) {
        throw new Error('종목별 저장은 Symbol 입력이 필요합니다.');
      }

      const nextProfile: StrategyParameterProfile = {
        strategyId,
        symbolId: normalizedSymbol,
        name: `${getStrategyName(strategyId)} ${normalizedSymbol ?? 'global'}`,
        params,
        enabled: true,
      };
      const nextProfileId = `${strategyId}:${normalizedSymbol ?? 'global'}`;
      const nextProfiles = [
        ...profiles.filter((profile) => profile.id !== nextProfileId),
        nextProfile,
      ];
      const payload = await postStrategyParams(nextProfiles);
      const savedProfiles = payload.strategyParams?.profiles ?? nextProfiles;
      setProfiles(savedProfiles);
      setStatus({
        type: 'ok',
        message: `${normalizedSymbol ?? '전역'} 프로필 저장 완료`,
      });
    } catch (error) {
      setStatus({ type: 'err', message: toMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function removeProfile() {
    if (!selectedProfile) return;
    setSaving(true);
    try {
      const nextProfiles = profiles.filter((profile) => profile.id !== selectedProfile.id);
      const payload = await postStrategyParams(nextProfiles);
      setProfiles(payload.strategyParams?.profiles ?? nextProfiles);
      setStatus({ type: 'ok', message: '프로필 삭제 완료' });
      setParamsText(DEFAULT_PARAMS);
    } catch (error) {
      setStatus({ type: 'err', message: toMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className={`dev-strategy-params-panel${open ? ' open' : ''}`} aria-label="DEV 전략 파라미터 서버 설정">
      <button
        className="dev-strategy-params-toggle"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'DEV 설정 접기' : 'DEV 전략 파라미터'}
      </button>
      {open && (
        <section className="dev-strategy-params-card">
          <div className="dev-strategy-params-head">
            <div>
              <span>STRATEGY DEV</span>
              <h2>전략 파라미터 서버 설정</h2>
            </div>
            <strong>{profiles.length} profiles</strong>
          </div>

          <label>
            전략
            <select value={strategyId} onChange={(event) => setStrategyId(event.target.value)}>
              {STRATEGIES.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
              ))}
            </select>
          </label>

          <div className="dev-strategy-params-scope">
            <label>
              <input
                checked={scope === 'global'}
                name="strategy-param-scope"
                onChange={() => setScope('global')}
                type="radio"
              />
              전역
            </label>
            <label>
              <input
                checked={scope === 'symbol'}
                name="strategy-param-scope"
                onChange={() => setScope('symbol')}
                type="radio"
              />
              종목별
            </label>
          </div>

          <label>
            Symbol
            <input
              disabled={scope === 'global'}
              onChange={(event) => setSymbolId(event.target.value)}
              placeholder="NQ1!"
              value={symbolId}
            />
          </label>

          <label>
            Params JSON
            <textarea
              onChange={(event) => setParamsText(event.target.value)}
              spellCheck={false}
              value={paramsText}
            />
          </label>

          <div className="dev-strategy-params-actions">
            <button disabled={loading} onClick={() => void loadProfiles()} type="button">불러오기</button>
            <button disabled={saving} onClick={() => void saveProfile()} type="button">저장</button>
            <button disabled={saving || !selectedProfile} onClick={() => void removeProfile()} type="button">삭제</button>
          </div>

          <p className={`dev-strategy-params-status ${status.type}`}>{status.message}</p>
          <p className="dev-strategy-params-note">
            이 값은 차트 내부 전략의 기본 파라미터를 서버에 저장하는 관리자용 설정입니다.
            차트 전략, EA 전략, 실제 체결 정책은 /signal에서 전체/종목별로 선택합니다.
          </p>
        </section>
      )}
    </aside>
  );
}

async function fetchStrategyParams(): Promise<StrategyParameterPayload> {
  const response = await fetch('/admin/strategy-params', { cache: 'no-store' });
  const payload = await response.json().catch(() => ({})) as StrategyParameterPayload;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.message || '전략 파라미터를 불러오지 못했습니다.');
  }
  return payload;
}

async function postStrategyParams(profiles: StrategyParameterProfile[]): Promise<StrategyParameterPayload> {
  const response = await fetch('/admin/strategy-params', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ strategyParams: { profiles } }),
  });
  const payload = await response.json().catch(() => ({})) as StrategyParameterPayload;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.message || '전략 파라미터 저장에 실패했습니다.');
  }
  return payload;
}

function parseParams(value: string): Record<string, string | number | boolean> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Params JSON은 객체여야 합니다.');
  }
  const params: Record<string, string | number | boolean> = {};
  for (const [key, rawValue] of Object.entries(parsed)) {
    if (
      typeof rawValue === 'string'
      || typeof rawValue === 'number'
      || typeof rawValue === 'boolean'
    ) {
      params[key] = rawValue;
    }
  }
  return params;
}

function getStrategyName(strategyId: string): string {
  return STRATEGIES.find((strategy) => strategy.id === strategyId)?.name ?? strategyId;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
