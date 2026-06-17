'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Plus, Send } from 'lucide-react';
import { getAllSymbolCatalog } from '../../src/catalog/symbols.ts';
import { loadStrategies } from '../../src/strategy/strategy-service.ts';
import { DeleteActionIcon, EditActionIcon } from '../shared/action-icons';
import { IconButton } from '../shared/icon-button';
import { formatAdminDateTime } from './admin-date-format';
import { AdminRefreshButton } from './admin-refresh-button';

type SignalEventType = 'buy' | 'sell' | 'stop_loss' | 'take_profit';
type TelegramAlertsTab = 'profiles' | 'logs';
type ProfileViewMode = 'list' | 'form';

type PublicTelegramProfile = {
  id: string;
  name: string;
  chatId: string;
  isEnabled: boolean;
  eventTypes: SignalEventType[];
  strategyIds: string[];
  symbolIds: string[];
  timeframeIds: string[];
  maskedBotToken: string;
  hasBotToken: boolean;
  lastTestedAt: string | null;
  lastTestStatus: 'success' | 'failed' | null;
  lastTestError: string | null;
  createdAt: string;
  updatedAt: string;
};

type TelegramDeliveryLog = {
  id: string;
  profileId: string;
  eventType: SignalEventType;
  strategyId: string;
  symbolId: string;
  message: string;
  status: 'sent' | 'failed';
  telegramMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type FormState = {
  id: string;
  name: string;
  tokenInput: string;
  chatId: string;
  isEnabled: boolean;
  eventTypes: SignalEventType[];
  strategyIds: string[];
  symbolIds: string[];
  timeframeIds: string[];
};

type StatusState = {
  type: 'ok' | 'err';
  message: string;
} | null;

type FilterField = 'strategyIds' | 'symbolIds' | 'timeframeIds';

type DropdownOption = {
  id: string;
  label: string;
  description?: string;
  group?: string;
};

const EVENT_OPTIONS: Array<{ id: SignalEventType; label: string }> = [
  { id: 'buy', label: 'Buy' },
  { id: 'sell', label: 'Sell' },
  { id: 'stop_loss', label: 'S/L' },
  { id: 'take_profit', label: 'T/P' },
];

const TELEGRAM_TIMEFRAME_OPTIONS: DropdownOption[] = [
  { id: '1s', label: '1S' },
  { id: '1m', label: '1M' },
  { id: '3m', label: '3M' },
  { id: '5m', label: '5M' },
  { id: '15m', label: '15M' },
  { id: '30m', label: '30M' },
  { id: '1h', label: '1H' },
  { id: '2h', label: '2H' },
  { id: '4h', label: '4H' },
  { id: '1d', label: '1D' },
  { id: '1w', label: '1W' },
  { id: '1M', label: '1MO' },
];

const EMPTY_FORM: FormState = {
  id: '',
  name: '',
  tokenInput: '',
  chatId: '',
  isEnabled: true,
  eventTypes: ['buy', 'sell', 'stop_loss', 'take_profit'],
  strategyIds: [],
  symbolIds: [],
  timeframeIds: [],
};

export function AdminTelegramAlertsPanel() {
  const [profiles, setProfiles] = useState<PublicTelegramProfile[]>([]);
  const [logs, setLogs] = useState<TelegramDeliveryLog[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<TelegramAlertsTab>('profiles');
  const [profileViewMode, setProfileViewMode] = useState<ProfileViewMode>('list');
  const [strategyOptions, setStrategyOptions] = useState<DropdownOption[]>([]);
  const [symbolOptions, setSymbolOptions] = useState<DropdownOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState>(null);

  useEffect(() => {
    void reloadTelegramAlertsPanel();
  }, []);

  const activeCount = useMemo(() => profiles.filter((profile) => profile.isEnabled).length, [profiles]);
  const editingProfile = profiles.find((profile) => profile.id === form.id) ?? null;
  const isBusy = loading || saving || Boolean(testingId);

  async function loadTelegramAlerts() {
    setLoading(true);
    try {
      const payload = await fetchJson('/admin/telegram-alerts');
      setProfiles(payload.profiles ?? []);
      setLogs(payload.logs ?? []);
      setStatus({ type: 'ok', message: 'Telegram alert settings loaded.' });
    } catch (error) {
      setStatus({ type: 'err', message: `Load failed: ${toReadableErrorMessage(error)}` });
    } finally {
      setLoading(false);
    }
  }

  async function reloadTelegramAlertsPanel() {
    refreshFilterOptions();
    await loadTelegramAlerts();
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = await postJson('/admin/telegram-alerts', {
        id: form.id || null,
        name: form.name,
        botToken: form.tokenInput,
        chatId: form.chatId,
        isEnabled: form.isEnabled,
        eventTypes: form.eventTypes,
        strategyIds: form.strategyIds,
        symbolIds: form.symbolIds,
        timeframeIds: form.timeframeIds,
      });
      setProfiles((current) => upsertProfile(current, payload.profile));
      setForm(EMPTY_FORM);
      setProfileViewMode('list');
      setStatus({ type: 'ok', message: 'Telegram bot profile saved.' });
    } catch (error) {
      setStatus({ type: 'err', message: `Save failed: ${toReadableErrorMessage(error)}` });
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile(profileId: string) {
    if (!window.confirm('텔레그램 봇 프로필을 삭제할까요?')) return;
    try {
      const response = await fetch(`/admin/telegram-alerts?id=${encodeURIComponent(profileId)}`, {
        method: 'DELETE',
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.message || 'delete failed');
      setProfiles((current) => current.filter((profile) => profile.id !== profileId));
      if (form.id === profileId) setForm(EMPTY_FORM);
      setProfileViewMode('list');
      setStatus({ type: 'ok', message: 'Telegram bot profile deleted.' });
    } catch (error) {
      setStatus({ type: 'err', message: `Delete failed: ${toReadableErrorMessage(error)}` });
    }
  }

  async function sendTestMessage(profileId: string) {
    setTestingId(profileId);
    try {
      const payload = await postJson('/admin/telegram-alerts/test', { profileId });
      setProfiles((current) => upsertProfile(current, payload.profile));
      setStatus({
        type: payload.profile.lastTestStatus === 'success' ? 'ok' : 'err',
        message: payload.profile.lastTestStatus === 'success'
          ? 'Telegram test message sent.'
          : `Telegram test failed: ${payload.profile.lastTestError || 'unknown error'}`,
      });
    } catch (error) {
      setStatus({ type: 'err', message: `Test failed: ${toReadableErrorMessage(error)}` });
    } finally {
      setTestingId(null);
    }
  }

  function startNewProfile() {
    refreshFilterOptions();
    setForm(EMPTY_FORM);
    setActiveTab('profiles');
    setProfileViewMode('form');
    setStatus({ type: 'ok', message: '새 텔레그램 봇 프로필을 작성합니다.' });
  }

  function startEdit(profile: PublicTelegramProfile) {
    refreshFilterOptions();
    setForm({
      id: profile.id,
      name: profile.name,
      tokenInput: '',
      chatId: profile.chatId,
      isEnabled: profile.isEnabled,
      eventTypes: profile.eventTypes,
      strategyIds: profile.strategyIds,
      symbolIds: profile.symbolIds,
      timeframeIds: profile.timeframeIds,
    });
    setActiveTab('profiles');
    setProfileViewMode('form');
    setStatus({ type: 'ok', message: '선택한 텔레그램 봇 프로필을 수정 중입니다.' });
  }

  function backToProfileList() {
    setForm(EMPTY_FORM);
    setProfileViewMode('list');
    setStatus({ type: 'ok', message: '텔레그램 봇 프로필 목록입니다.' });
  }

  function toggleEventType(eventType: SignalEventType) {
    setForm((current) => {
      const next = current.eventTypes.includes(eventType)
        ? current.eventTypes.filter((item) => item !== eventType)
        : [...current.eventTypes, eventType];
      return { ...current, eventTypes: next };
    });
  }

  function refreshFilterOptions() {
    setStrategyOptions(readStrategyOptions());
    setSymbolOptions(readSymbolOptions());
  }

  function toggleFilterValue(field: FilterField, value: string) {
    setForm((current) => {
      const currentValues = current[field];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];
      return { ...current, [field]: nextValues };
    });
  }

  function clearFilterValues(field: FilterField) {
    setForm((current) => ({ ...current, [field]: [] }));
  }

  return (
    <section id="admin-telegram-alerts" className="admin-telegram-alerts card">
      <div className="admin-telegram-alerts-header">
        <div>
          <span className="eyebrow">Telegram Alerts</span>
          <h2>텔레그램 알림관리</h2>
          <p>봇 프로필과 시그널 전송 이력을 관리합니다.</p>
        </div>
        <div className="admin-telegram-alerts-summary">
          <strong>{profiles.length}</strong>
          <span>{activeCount} active</span>
        </div>
      </div>

      <div className="admin-telegram-alerts-tabs" role="tablist" aria-label="텔레그램 알림관리 메뉴">
        <button
          type="button"
          className={activeTab === 'profiles' ? 'active' : ''}
          onClick={() => setActiveTab('profiles')}
        >
          봇프로필관리
        </button>
        <button
          type="button"
          className={activeTab === 'logs' ? 'active' : ''}
          onClick={() => setActiveTab('logs')}
        >
          전송로그
        </button>
      </div>

      {activeTab === 'profiles' ? (
        profileViewMode === 'list' ? (
          <div className="admin-telegram-alerts-subpage">
            <div className="toolbar admin-telegram-alerts-subtoolbar">
              <div>
                <h3>봇프로필관리</h3>
                <p className="notice compact">등록된 텔레그램 봇 프로필 목록입니다.</p>
              </div>
              <div className="toolbar-actions">
                <IconButton label="봇 프로필 추가" onClick={startNewProfile} disabled={isBusy}>
                  <Plus />
                </IconButton>
                <AdminRefreshButton onClick={() => void reloadTelegramAlertsPanel()} disabled={isBusy} />
              </div>
            </div>
            <div className="admin-telegram-alerts-table-wrap">
              <table className="table admin-telegram-alerts-profile-table">
                <thead>
                  <tr>
                    <th>봇 프로필</th>
                    <th>상태</th>
                    <th>이벤트</th>
                    <th>전략</th>
                    <th>심볼</th>
                    <th>TF</th>
                    <th>최근 테스트</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.length > 0 ? profiles.map((profile) => (
                    <tr key={profile.id}>
                      <td>
                        <strong>{profile.name}</strong>
                        <small>{profile.maskedBotToken || 'No token'} / {profile.chatId}</small>
                      </td>
                      <td>{profile.isEnabled ? 'ON' : 'OFF'}</td>
                      <td>{formatSignalEvents(profile.eventTypes)}</td>
                      <td>{formatFilterList(profile.strategyIds, '전체 전략')}</td>
                      <td>{formatFilterList(profile.symbolIds, '전체 심볼')}</td>
                      <td>{formatFilterList(profile.timeframeIds, '전체 TF')}</td>
                      <td>{formatProfileTestStatus(profile)}</td>
                      <td>
                        <div className="admin-telegram-alerts-actions">
                          <IconButton className="action-icon-button edit" label="봇 프로필 수정" onClick={() => startEdit(profile)} disabled={isBusy}>
                            <EditActionIcon />
                          </IconButton>
                          <button
                            className="button secondary compact admin-telegram-alerts-test-send"
                            type="button"
                            onClick={() => void sendTestMessage(profile.id)}
                            disabled={isBusy || testingId === profile.id}
                          >
                            <Send aria-hidden="true" />
                            <span>{testingId === profile.id ? '전송 중...' : '테스트 전송'}</span>
                          </button>
                          <IconButton className="action-icon-button delete" label="봇 프로필 삭제" onClick={() => void deleteProfile(profile.id)} disabled={isBusy}>
                            <DeleteActionIcon />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8}>등록된 텔레그램 봇 프로필이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <form className="form admin-telegram-alerts-form" onSubmit={saveProfile}>
            <div className="toolbar admin-telegram-alerts-subtoolbar">
              <div>
                <h3>{form.id ? '봇 프로필 수정' : '봇 프로필 등록'}</h3>
                <p className="notice compact">봇 토큰, 챗 ID, 전송 필터를 입력합니다.</p>
              </div>
              <div className="toolbar-actions">
                <IconButton label="목록으로 돌아가기" onClick={backToProfileList} disabled={isBusy}>
                  <ArrowLeft />
                </IconButton>
                <AdminRefreshButton onClick={() => void reloadTelegramAlertsPanel()} disabled={isBusy} />
              </div>
            </div>

            <div className="admin-telegram-alerts-fields">
              <label>
                <span>Profile name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Test bot"
                />
              </label>
              <label>
                <span>Bot token</span>
                <input
                  value={form.tokenInput}
                  onChange={(event) => setForm((current) => ({ ...current, tokenInput: event.target.value }))}
                  placeholder={editingProfile?.hasBotToken ? editingProfile.maskedBotToken : '123456789:AA...'}
                  type="password"
                />
              </label>
              <label>
                <span>Chat ID / Channel ID</span>
                <input
                  value={form.chatId}
                  onChange={(event) => setForm((current) => ({ ...current, chatId: event.target.value }))}
                  placeholder="-1001234567890"
                />
              </label>
              <label className="admin-telegram-alerts-switch">
                <input
                  type="checkbox"
                  checked={form.isEnabled}
                  onChange={(event) => setForm((current) => ({ ...current, isEnabled: event.target.checked }))}
                />
                <span>Enabled</span>
              </label>
            </div>

            <div className="admin-telegram-alerts-checks">
              {EVENT_OPTIONS.map((option) => (
                <label key={option.id}>
                  <input
                    checked={form.eventTypes.includes(option.id)}
                    type="checkbox"
                    onChange={() => toggleEventType(option.id)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            <div className="admin-telegram-alerts-filter-grid">
              <FilterDropdown
                emptyLabel="전체 전략"
                label="전략"
                options={strategyOptions}
                values={form.strategyIds}
                onClear={() => clearFilterValues('strategyIds')}
                onToggle={(value) => toggleFilterValue('strategyIds', value)}
              />
              <FilterDropdown
                emptyLabel="전체 심볼"
                label="심볼"
                options={symbolOptions}
                values={form.symbolIds}
                onClear={() => clearFilterValues('symbolIds')}
                onToggle={(value) => toggleFilterValue('symbolIds', value)}
              />
              <FilterDropdown
                emptyLabel="전체 TF"
                label="시간프레임"
                options={TELEGRAM_TIMEFRAME_OPTIONS}
                values={form.timeframeIds}
                onClear={() => clearFilterValues('timeframeIds')}
                onToggle={(value) => toggleFilterValue('timeframeIds', value)}
              />
            </div>

            <div className="toolbar-actions">
              {form.id ? (
                <button className="button ghost" type="button" onClick={() => setForm(EMPTY_FORM)} disabled={isBusy}>
                  새 프로필 작성
                </button>
              ) : null}
              <button className="button" type="submit" disabled={isBusy}>
                {saving ? 'Saving...' : form.id ? '수정 저장' : '프로필 등록'}
              </button>
            </div>
          </form>
        )
      ) : (
        <div className="admin-telegram-alerts-subpage">
          <div className="toolbar admin-telegram-alerts-subtoolbar">
            <div>
              <h3>전송로그</h3>
              <p className="notice compact">최근 텔레그램 시그널 전송 결과입니다.</p>
            </div>
            <div className="toolbar-actions">
              <AdminRefreshButton onClick={() => void reloadTelegramAlertsPanel()} disabled={isBusy} />
            </div>
          </div>
          <div className="admin-telegram-alerts-table-wrap">
            <table className="table admin-telegram-alerts-log-table">
              <thead>
                <tr>
                  <th>전송시간</th>
                  <th>이벤트</th>
                  <th>심볼</th>
                  <th>전략</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.createdAt)}</td>
                    <td>{formatSignalEvents([log.eventType])}</td>
                    <td>{log.symbolId}</td>
                    <td>{log.strategyId}</td>
                    <td>{log.status === 'sent' ? 'Sent' : log.errorMessage || 'Failed'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5}>전송 로그가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <StatusMessage status={status} />
    </section>
  );
}

function StatusMessage({ status }: Readonly<{ status: StatusState }>) {
  if (!status) return null;
  return (
    <p className={`notice admin-telegram-alerts-status ${status.type}`} role="status">
      {status.message}
    </p>
  );
}

function FilterDropdown({
  label,
  emptyLabel,
  options,
  values,
  onToggle,
  onClear,
}: Readonly<{
  label: string;
  emptyLabel: string;
  options: DropdownOption[];
  values: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}>) {
  const visibleOptions = mergeSelectedOptions(options, values);

  return (
    <div className="admin-telegram-alerts-filter-dropdown">
      <span>{label}</span>
      <details>
        <summary>
          <span>{formatDropdownSummary(values, options, emptyLabel)}</span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="admin-telegram-alerts-filter-menu">
          <button className="admin-telegram-alerts-filter-clear" type="button" onClick={onClear}>
            {emptyLabel}
          </button>
          {visibleOptions.length > 0 ? visibleOptions.map((option) => (
            <label key={option.id}>
              <input
                checked={values.includes(option.id)}
                type="checkbox"
                onChange={() => onToggle(option.id)}
              />
              <span>
                <strong>{option.label}</strong>
              </span>
            </label>
          )) : (
            <span className="admin-telegram-alerts-filter-empty">선택지 없음</span>
          )}
        </div>
      </details>
    </div>
  );
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.message || 'request failed');
  return payload;
}

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.message || 'request failed');
  return payload;
}

function upsertProfile(current: PublicTelegramProfile[], profile: PublicTelegramProfile) {
  const index = current.findIndex((item) => item.id === profile.id);
  if (index < 0) return [...current, profile];
  const next = [...current];
  next[index] = profile;
  return next;
}

function formatDate(value: string) {
  return formatAdminDateTime(value);
}

function formatFilterList(values: string[], fallback: string) {
  return values.length ? values.join(', ') : fallback;
}

function formatDropdownSummary(values: string[], options: DropdownOption[], emptyLabel: string) {
  if (!values.length) return emptyLabel;
  if (values.length === 1) {
    const option = options.find((item) => item.id === values[0]);
    return option?.label ?? values[0];
  }
  return `${values.length}개 선택`;
}

function mergeSelectedOptions(options: DropdownOption[], values: string[]) {
  const optionById = new Map(options.map((option) => [option.id, option]));
  values.forEach((value) => {
    if (!optionById.has(value)) optionById.set(value, { id: value, label: value });
  });
  return Array.from(optionById.values());
}

function readStrategyOptions(): DropdownOption[] {
  try {
    return loadStrategies()
      .filter((strategy) => strategy.active)
      .map((strategy) => ({
        id: strategy.id,
        label: strategy.name || strategy.id,
        description: strategy.description,
      }));
  } catch {
    return [];
  }
}

function readSymbolOptions(): DropdownOption[] {
  try {
    const optionById = new Map<string, DropdownOption>();
    Object.entries(getAllSymbolCatalog()).forEach(([group, symbols]) => {
      symbols.forEach((symbol) => {
        const id = symbol.id.trim().toUpperCase();
        if (!id || optionById.has(id)) return;
        optionById.set(id, {
          id,
          label: symbol.label || id,
          description: symbol.desc,
          group,
        });
      });
    });
    return Array.from(optionById.values());
  } catch {
    return [];
  }
}

function formatSignalEvents(eventTypes: SignalEventType[]) {
  const labels: Record<SignalEventType, string> = {
    buy: 'BUY',
    sell: 'SELL',
    stop_loss: 'S/L',
    take_profit: 'T/P',
  };
  return eventTypes.map((eventType) => labels[eventType]).join(', ') || '전체 이벤트';
}

function formatProfileTestStatus(profile: PublicTelegramProfile) {
  if (!profile.lastTestStatus) return '-';
  if (profile.lastTestStatus === 'success') {
    return profile.lastTestedAt ? `성공 ${formatDate(profile.lastTestedAt)}` : '성공';
  }
  return profile.lastTestError || '실패';
}

function toReadableErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || '');
}
