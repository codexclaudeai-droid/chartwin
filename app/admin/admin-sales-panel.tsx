'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { dispatchAdminQueuePresetEvent } from './admin-queue-preset-events';

type SalespersonItem = {
  id: string;
  email: string;
  name: string;
  phoneNumber: string | null;
  commissionPercent: number;
  salesCount: number;
  salesUsd: number;
  points: number;
};

type SalesCustomerItem = {
  id: string;
  email: string;
  name: string;
  referredByUserId: string | null;
  salesperson: {
    id: string;
    email: string;
    name: string;
  } | null;
};

type SalesTeamItem = {
  id: string;
  name: string;
  commissionPercent: number;
  salespersonIds: string[];
  salespersonCount: number;
  salesCount: number;
  salesUsd: number;
  points: number;
};

type TeamSalespersonItem = SalespersonItem & {
  sequence: number;
};

type SalesRow = {
  paymentId: string;
  salesDate: string;
  email: string;
  customerName: string;
  subscriptionPlan: string;
  amountUsd: number;
  commissionPercent: number;
  points: number;
};

type SalesSummary = {
  defaultPercent: number;
  defaultTeamPercent: number;
  teamPageSize: number;
  salespersonQuery: string;
  customerQuery: string;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  salespeople: SalespersonItem[];
  selectedSalesperson: SalespersonItem | null;
  customers: SalesCustomerItem[];
  teams: SalesTeamItem[];
  selectedTeam: SalesTeamItem | null;
  selectedTeamSalespeople: TeamSalespersonItem[];
  teamTotals: {
    salesCount: number;
    salesUsd: number;
    points: number;
  };
  rows: SalesRow[];
  totals: {
    salesCount: number;
    salesUsd: number;
    points: number;
  };
};

type SalesResponse = {
  ok: boolean;
  message?: string;
  summary?: SalesSummary;
};

type SalesPageKey = 'teams' | 'people' | 'assignments' | 'revenue';

const EMPTY_SALES_SUMMARY: SalesSummary = {
  defaultPercent: 30,
  defaultTeamPercent: 30,
  teamPageSize: 10,
  salespersonQuery: '',
  customerQuery: '',
  dateRange: {
    from: null,
    to: null,
  },
  salespeople: [],
  selectedSalesperson: null,
  customers: [],
  teams: [],
  selectedTeam: null,
  selectedTeamSalespeople: [],
  teamTotals: {
    salesCount: 0,
    salesUsd: 0,
    points: 0,
  },
  rows: [],
  totals: {
    salesCount: 0,
    salesUsd: 0,
    points: 0,
  },
};

const SALES_SUBMENU: Array<{
  key: SalesPageKey;
  label: string;
  description: string;
  anchorId: string;
}> = [
  { key: 'teams', label: '영업팀', description: '영업팀 등록, 팀별 영업자 배치, 팀 정산율 관리', anchorId: 'admin-sales-teams' },
  { key: 'people', label: '영업자', description: '영업자별 매출 집계와 개별 정산율 관리', anchorId: 'admin-sales-people' },
  { key: 'assignments', label: '회원배정', description: '회원별 담당 영업자 검색과 변경', anchorId: 'admin-sales-assignments' },
  { key: 'revenue', label: '매출현황', description: '기간별 매출 리스트, 포인트 집계, 엑셀 출력', anchorId: 'admin-sales-revenue' },
];

export function AdminSalesPanel() {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [activePage, setActivePage] = useState<SalesPageKey>('teams');
  const [query, setQuery] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedSalespersonId, setSelectedSalespersonId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('30');
  const [teamCommissionPercent, setTeamCommissionPercent] = useState('30');
  const [teamName, setTeamName] = useState('');
  const [isSalespersonSearchOpen, setIsSalespersonSearchOpen] = useState(false);
  const [highlightedSalespersonIndex, setHighlightedSalespersonIndex] = useState(0);
  const [message, setMessage] = useState('영업관리 데이터를 불러오는 중입니다.');
  const [isBusy, setIsBusy] = useState(false);
  const customerSearchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const initialSalespersonId = getSalespersonIdFromSearch(window.location.search);
    if (initialSalespersonId) {
      setSelectedSalespersonId(initialSalespersonId);
      void refresh(initialSalespersonId, selectedTeamId, '회원관리에서 지정한 영업자를 선택했습니다. 회원 배정을 이어가세요.');
      return;
    }

    void refresh();
  }, []);

  useEffect(() => {
    function syncPageFromHash() {
      const nextPage = getSalesPageFromHash(window.location.hash);
      const nextSalespersonId = getSalespersonIdFromSearch(window.location.search);
      setActivePage(nextPage);
      if (nextPage === 'assignments' && nextSalespersonId) {
        setSelectedSalespersonId(nextSalespersonId);
        void refresh(nextSalespersonId, selectedTeamId, '회원관리에서 지정한 영업자를 선택했습니다. 회원 배정을 이어가세요.');
      }
    }

    syncPageFromHash();
    window.addEventListener('hashchange', syncPageFromHash);
    window.addEventListener('popstate', syncPageFromHash);
    return () => {
      window.removeEventListener('hashchange', syncPageFromHash);
      window.removeEventListener('popstate', syncPageFromHash);
    };
  }, []);

  useEffect(() => {
    const handoffSalespersonId = getSalespersonIdFromSearch(window.location.search);
    if (activePage !== 'assignments' || !handoffSalespersonId || selectedSalespersonId !== handoffSalespersonId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      customerSearchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activePage, selectedSalespersonId]);

  async function refresh(
    nextSalespersonId = selectedSalespersonId,
    nextTeamId = selectedTeamId,
    nextMessage?: string,
  ) {
    setIsBusy(true);
    const searchParams = new URLSearchParams();
    if (query.trim()) searchParams.set('query', query.trim());
    if (customerQuery.trim()) searchParams.set('customerQuery', customerQuery.trim());
    if (from) searchParams.set('from', from);
    if (to) searchParams.set('to', to);
    if (nextSalespersonId) searchParams.set('salespersonId', nextSalespersonId);
    if (nextTeamId) searchParams.set('teamId', nextTeamId);

    const response = await fetch(`/api/admin/sales?${searchParams.toString()}`, { cache: 'no-store' });
    const payload = await response.json() as SalesResponse;
    setIsBusy(false);

    if (!response.ok || !payload.summary) {
      setSummary(null);
      setMessage(payload.message || '영업관리 데이터를 불러오지 못했습니다.');
      return;
    }

    applySummary(payload.summary);
    if (nextSalespersonId && payload.summary.selectedSalesperson) {
      setQuery(`${payload.summary.selectedSalesperson.name} ${payload.summary.selectedSalesperson.email}`);
    }
    setMessage(nextMessage ?? `영업자 ${payload.summary.salespeople.length}명, 팀 ${payload.summary.teams.length}개를 불러왔습니다.`);
  }

  async function createSalesTeam() {
    if (!teamName.trim()) {
      setMessage('등록할 영업팀명을 입력하세요.');
      return;
    }

    setIsBusy(true);
    const response = await fetch('/api/admin/sales', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createSalesTeam',
        teamName,
      }),
    });
    const payload = await response.json() as SalesResponse;
    setIsBusy(false);

    if (!response.ok || !payload.summary) {
      setMessage(payload.message || '영업팀 등록에 실패했습니다.');
      return;
    }

    setTeamName('');
    applySummary(payload.summary);
    setMessage('영업팀을 등록했습니다. 영업자를 선택한 뒤 팀에 배치할 수 있습니다.');
  }

  async function assignSalespersonTeam() {
    if (!selectedSalespersonId || !selectedTeamId) {
      setMessage('배치할 영업자와 영업팀을 모두 선택하세요.');
      return;
    }

    setIsBusy(true);
    const response = await fetch('/api/admin/sales', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'assignSalespersonTeam',
        salespersonId: selectedSalespersonId,
        teamId: selectedTeamId,
      }),
    });
    const payload = await response.json() as SalesResponse;
    setIsBusy(false);

    if (!response.ok || !payload.summary) {
      setMessage(payload.message || '영업자 팀 배치에 실패했습니다.');
      return;
    }

    applySummary(payload.summary);
    setMessage('선택 영업자를 영업팀에 배치했습니다.');
  }

  async function saveTeamCommissionPercent() {
    if (!selectedTeamId) {
      setMessage('정산율을 변경할 영업팀을 먼저 선택하세요.');
      return;
    }

    setIsBusy(true);
    const response = await fetch('/api/admin/sales', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateSalesTeamCommission',
        teamId: selectedTeamId,
        commissionPercent: Number(teamCommissionPercent),
      }),
    });
    const payload = await response.json() as SalesResponse;
    setIsBusy(false);

    if (!response.ok || !payload.summary) {
      setMessage(payload.message || '영업팀 정산율 저장에 실패했습니다.');
      return;
    }

    applySummary(payload.summary);
    setMessage('영업팀 정산율을 저장했습니다. 이 기능은 슈퍼관리자만 사용할 수 있습니다.');
  }

  async function saveCommissionPercent() {
    if (!selectedSalespersonId) {
      setMessage('개별 정산율을 적용할 영업자를 먼저 선택하세요.');
      return;
    }

    setIsBusy(true);
    const response = await fetch('/api/admin/sales', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salespersonId: selectedSalespersonId,
        commissionPercent: Number(commissionPercent),
      }),
    });
    const payload = await response.json() as SalesResponse;
    setIsBusy(false);

    if (!response.ok || !payload.summary) {
      setMessage(payload.message || '개별 정산율 저장에 실패했습니다.');
      return;
    }

    applySummary(payload.summary);
    setMessage('개별 정산율을 저장했습니다. 최고관리자 권한으로만 변경할 수 있습니다.');
  }

  async function assignCustomerSalesperson() {
    if (!selectedCustomerId || !selectedSalespersonId) {
      setMessage('배정할 회원과 영업자를 모두 선택하세요.');
      return;
    }

    setIsBusy(true);
    const response = await fetch('/api/admin/sales', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'assignCustomerSalesperson',
        customerId: selectedCustomerId,
        salespersonId: selectedSalespersonId,
        customerQuery,
      }),
    });
    const payload = await response.json() as SalesResponse;
    setIsBusy(false);

    if (!response.ok || !payload.summary) {
      setMessage(payload.message || '영업자 배정에 실패했습니다.');
      return;
    }

    applySummary(payload.summary);
    setMessage('선택 회원의 영업자를 변경했습니다. 이후 확정 매출은 새 영업자 집계에 반영됩니다.');
  }

  function applySummary(nextSummary: SalesSummary) {
    setSummary(nextSummary);
    const nextSelectedSalespersonId = nextSummary.selectedSalesperson?.id ?? '';
    const nextSelectedTeamId = nextSummary.selectedTeam?.id ?? '';
    setSelectedSalespersonId(nextSelectedSalespersonId);
    setSelectedTeamId(nextSelectedTeamId);
    setSelectedCustomerId((currentCustomerId) => (
      nextSummary.customers.some((customer) => customer.id === currentCustomerId)
        ? currentCustomerId
        : nextSummary.customers[0]?.id ?? ''
    ));
    setCommissionPercent(String(nextSummary.selectedSalesperson?.commissionPercent ?? nextSummary.defaultPercent));
    setTeamCommissionPercent(String(nextSummary.selectedTeam?.commissionPercent ?? nextSummary.defaultTeamPercent));
  }

  function selectSalesperson(salespersonId: string) {
    setSelectedSalespersonId(salespersonId);
    void refresh(salespersonId, selectedTeamId);
  }

  function selectSalespersonFromSearch(salesperson: SalespersonItem) {
    setQuery(`${salesperson.name} ${salesperson.email}`);
    setIsSalespersonSearchOpen(false);
    setHighlightedSalespersonIndex(0);
    selectSalesperson(salesperson.id);
  }

  function applySalespersonUserFilter() {
    dispatchAdminQueuePresetEvent({ panel: 'users', presetKey: 'salesperson' });
  }

  function handleSalespersonSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setIsSalespersonSearchOpen(false);
      return;
    }

    if (salespersonSearchResults.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsSalespersonSearchOpen(true);
      setHighlightedSalespersonIndex((currentIndex) => (currentIndex + 1) % salespersonSearchResults.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsSalespersonSearchOpen(true);
      setHighlightedSalespersonIndex((currentIndex) => (
        currentIndex - 1 + salespersonSearchResults.length
      ) % salespersonSearchResults.length);
      return;
    }

    if (event.key === 'Enter' && isSalespersonSearchOpen) {
      event.preventDefault();
      const nextSalesperson = salespersonSearchResults[
        Math.min(highlightedSalespersonIndex, salespersonSearchResults.length - 1)
      ];
      if (nextSalesperson) {
        selectSalespersonFromSearch(nextSalesperson);
      }
    }
  }

  function selectTeam(teamId: string) {
    setSelectedTeamId(teamId);
    void refresh(selectedSalespersonId, teamId);
  }

  function downloadSalesExcel() {
    if (!summary) return;
    const header = ['매출일', '이메일', '이름', '구독플랜', '매출', '적립률', '적립포인트'];
    const rows = summary.rows.map((row) => [
      row.salesDate,
      row.email,
      row.customerName,
      row.subscriptionPlan,
      row.amountUsd,
      `${row.commissionPercent}%`,
      row.points,
    ]);
    rows.push(['합계', '', '', '', summary.totals.salesUsd, '', summary.totals.points]);
    const tsv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join('\t'))
      .join('\n');
    const blob = new Blob([`\uFEFF${tsv}`], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sales-${summary.selectedSalesperson?.email ?? 'all'}.xls`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const visibleSummary = summary ?? EMPTY_SALES_SUMMARY;
  const activePageMeta = SALES_SUBMENU.find((item) => item.key === activePage) ?? SALES_SUBMENU[0];
  const salespersonSearchResults = getSalespersonSearchResults(visibleSummary.salespeople, query);
  const shouldShowSalespersonSearchPanel = isSalespersonSearchOpen
    && (salespersonSearchResults.length > 0 || query.trim().length > 0);
  const clampedSalespersonIndex = Math.min(
    highlightedSalespersonIndex,
    Math.max(0, salespersonSearchResults.length - 1),
  );

  return (
    <section className="card wide" id="admin-sales">
      <div className="statistics-subpage-anchor" id={activePageMeta.anchorId} />
      <div className="toolbar">
        <div>
          <h2>{activePageMeta.label}</h2>
          <p className="compact-copy">{activePageMeta.description}을 관리합니다.</p>
        </div>
        <button className="button secondary" type="button" onClick={() => void refresh()} disabled={isBusy}>
          새로고침
        </button>
      </div>
      <p className="notice">{message}</p>
      <nav className="admin-web-info-tabs sales-submenu-tabs" aria-label="영업관리 세부 메뉴">
        {SALES_SUBMENU.map((item) => (
          <a
            aria-current={activePage === item.key ? 'page' : undefined}
            className={activePage === item.key ? 'active' : ''}
            href={`#${item.anchorId}`}
            key={item.key}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="sales-filter-grid" aria-label="영업관리 필터">
        <label className="salesperson-search-field">
          <span>영업자 검색</span>
          <input
            aria-autocomplete="list"
            aria-expanded={shouldShowSalespersonSearchPanel}
            aria-controls="salesperson-search-results"
            aria-activedescendant={isSalespersonSearchOpen && salespersonSearchResults.length > 0
              ? `salesperson-search-option-${clampedSalespersonIndex}`
              : undefined}
            onBlur={() => window.setTimeout(() => setIsSalespersonSearchOpen(false), 120)}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsSalespersonSearchOpen(true);
              setHighlightedSalespersonIndex(0);
            }}
            onFocus={() => {
              setIsSalespersonSearchOpen(true);
              setHighlightedSalespersonIndex(0);
            }}
            onKeyDown={handleSalespersonSearchKeyDown}
            placeholder="이메일 또는 이름"
            value={query}
          />
          {shouldShowSalespersonSearchPanel && (
            <div className="salesperson-search-results" id="salesperson-search-results" role="listbox">
              {salespersonSearchResults.map((salesperson, index) => (
                <button
                  aria-selected={selectedSalespersonId === salesperson.id}
                  className={[
                    selectedSalespersonId === salesperson.id ? 'active' : '',
                    index === clampedSalespersonIndex ? 'highlighted' : '',
                  ].filter(Boolean).join(' ')}
                  id={`salesperson-search-option-${index}`}
                  key={salesperson.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightedSalespersonIndex(index)}
                  onClick={() => selectSalespersonFromSearch(salesperson)}
                  role="option"
                  type="button"
                >
                  <strong>{salesperson.name}</strong>
                  <span>{salesperson.email}</span>
                  <small>{salesperson.commissionPercent}% / {formatUsd(salesperson.salesUsd)} / {formatPoint(salesperson.points)}</small>
                </button>
              ))}
              {salespersonSearchResults.length === 0 && (
                <div className="salesperson-search-empty" role="status">
                  <strong>검색 결과 없음</strong>
                  <p>일치하는 영업자가 없습니다. 회원관리에서 해당 회원의 역할을 영업자로 변경한 뒤 다시 검색하세요.</p>
                  <a
                    href="#admin-users"
                    onClick={applySalespersonUserFilter}
                  >
                    회원관리로 이동
                  </a>
                </div>
              )}
            </div>
          )}
        </label>
        <fieldset className="sales-date-range-field">
          <legend>기간 범위</legend>
          <label>
            <span className="calendar-icon" aria-hidden="true">▦</span>
            <input aria-label="기간 범위 시작" type="date" onChange={(event) => setFrom(event.target.value)} value={from} />
          </label>
          <span className="sales-date-range-separator" aria-hidden="true">~</span>
          <label>
            <span className="calendar-icon" aria-hidden="true">▦</span>
            <input aria-label="기간 범위 종료" type="date" onChange={(event) => setTo(event.target.value)} value={to} />
          </label>
        </fieldset>
        <button className="button" type="button" onClick={() => void refresh()} disabled={isBusy}>
          조회
        </button>
      </div>
      <div className="sales-management-body">
        {activePage === 'teams' && (
        <>
          <div className="sales-summary-grid">
            <div className="mini-card">
              <span>기본 팀 정산율</span>
              <strong>{visibleSummary.defaultTeamPercent}%</strong>
              <p>팀 정산율은 슈퍼관리자만 변경할 수 있습니다.</p>
            </div>
            <div className="mini-card">
              <span>선택 영업팀</span>
              <strong>{visibleSummary.selectedTeam?.name ?? '영업팀 없음'}</strong>
              <p>{visibleSummary.selectedTeam ? `${visibleSummary.selectedTeam.salespersonCount}명 / ${visibleSummary.selectedTeam.commissionPercent}%` : '영업팀을 먼저 등록하세요.'}</p>
            </div>
            <div className="mini-card">
              <span>팀 매출집계</span>
              <strong>{formatUsd(visibleSummary.teamTotals.salesUsd)}</strong>
              <p>포인트 {formatPoint(visibleSummary.teamTotals.points)} / 매출 {visibleSummary.teamTotals.salesCount}건</p>
            </div>
          </div>

          <div className="sales-team-panel">
            <div className="toolbar compact">
              <div>
                <h3>영업팀 등록 및 배치</h3>
                <p className="compact-copy">영업팀을 만들고 선택한 영업자를 팀에 배치합니다. 영업자 리스트는 기본 {visibleSummary.teamPageSize}개 단위로 표시합니다.</p>
              </div>
              <button className="button" type="button" onClick={() => void createSalesTeam()} disabled={isBusy}>
                영업팀 등록
              </button>
            </div>
            <div className="sales-filter-grid compact">
              <label>
                <span>영업팀명</span>
                <input
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="예: 수도권 1팀"
                  value={teamName}
                />
              </label>
              <button className="button secondary" type="button" onClick={() => void assignSalespersonTeam()} disabled={isBusy || !selectedSalespersonId || !selectedTeamId}>
                선택 영업자 팀 배치
              </button>
            </div>
            <div className="sales-team-grid" aria-label="영업팀 목록">
              {visibleSummary.teams.map((team) => (
                <button
                  aria-pressed={selectedTeamId === team.id}
                  className={`sales-team-card${selectedTeamId === team.id ? ' active' : ''}`}
                  key={team.id}
                  onClick={() => selectTeam(team.id)}
                  type="button"
                >
                  <strong>{team.name}</strong>
                  <span>{team.commissionPercent}% / {team.salespersonCount}명</span>
                  <small>{formatUsd(team.salesUsd)} / {formatPoint(team.points)} 포인트</small>
                </button>
              ))}
              {visibleSummary.teams.length === 0 && (
                <p className="notice compact">등록된 영업팀이 없습니다. 팀명을 입력하고 영업팀 등록을 누르세요.</p>
              )}
            </div>
            <div className="sales-commission-row">
              <label>
                <span>영업팀 정산율</span>
                <input
                  max="100"
                  min="0"
                  onChange={(event) => setTeamCommissionPercent(event.target.value)}
                  step="0.1"
                  type="number"
                  value={teamCommissionPercent}
                />
              </label>
              <button className="button" type="button" onClick={() => void saveTeamCommissionPercent()} disabled={isBusy || !visibleSummary.selectedTeam}>
                팀 정산율 저장
              </button>
            </div>
            <table className="table sales-team-table">
              <thead>
                <tr>
                  <th>순번</th>
                  <th>이름</th>
                  <th>연락번호</th>
                  <th>매출</th>
                  <th>포인트</th>
                </tr>
              </thead>
              <tbody>
                {visibleSummary.selectedTeamSalespeople.map((salesperson) => (
                  <tr key={salesperson.id}>
                    <td>{salesperson.sequence}</td>
                    <td>{salesperson.name}<br /><small>{salesperson.email}</small></td>
                    <td>{salesperson.phoneNumber ?? '미등록'}</td>
                    <td>{formatUsd(salesperson.salesUsd)}</td>
                    <td>{formatPoint(salesperson.points)}</td>
                  </tr>
                ))}
                {visibleSummary.selectedTeamSalespeople.length === 0 && (
                  <tr>
                    <td colSpan={5}>선택한 영업팀에 배치된 영업자가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
        )}

        {activePage === 'people' && (
        <>
          <div className="sales-summary-grid">
            <div className="mini-card">
              <span>개별 기본 정산율</span>
              <strong>{visibleSummary.defaultPercent}%</strong>
              <p>영업자별 매출 집계는 개별 정산율을 기준으로 계산합니다.</p>
            </div>
            <div className="mini-card">
              <span>선택 영업자</span>
              <strong>{visibleSummary.selectedSalesperson?.name ?? '영업자 없음'}</strong>
              <p>{visibleSummary.selectedSalesperson ? `${visibleSummary.selectedSalesperson.email} / ${visibleSummary.selectedSalesperson.commissionPercent}%` : '회원관리에서 역할을 영업으로 지정하세요.'}</p>
              {!visibleSummary.selectedSalesperson && (
                <a className="text-link compact" href="#admin-users" onClick={applySalespersonUserFilter}>
                  회원관리에서 영업자 지정
                </a>
              )}
            </div>
            <div className="mini-card">
              <span>개별 집계</span>
              <strong>{formatUsd(visibleSummary.totals.salesUsd)}</strong>
              <p>포인트 {formatPoint(visibleSummary.totals.points)} / 매출 {visibleSummary.totals.salesCount}건</p>
            </div>
          </div>
          <div className="salesperson-list" aria-label="영업자 목록">
            {visibleSummary.salespeople.map((salesperson) => (
              <button
                aria-pressed={selectedSalespersonId === salesperson.id}
                className={`salesperson-card${selectedSalespersonId === salesperson.id ? ' active' : ''}`}
                key={salesperson.id}
                onClick={() => selectSalesperson(salesperson.id)}
                type="button"
              >
                <strong>{salesperson.name}</strong>
                <span>{salesperson.email}</span>
                <small>{salesperson.commissionPercent}% / {formatUsd(salesperson.salesUsd)} / {formatPoint(salesperson.points)}</small>
              </button>
            ))}
            {visibleSummary.salespeople.length === 0 && (
              <p className="notice compact">
                검색 조건에 맞는 영업자가 없습니다. 회원관리에서 회원 역할을 영업으로 변경하세요.
                {' '}
                <a className="text-link compact" href="#admin-users" onClick={applySalespersonUserFilter}>
                  회원관리로 이동
                </a>
              </p>
            )}
          </div>
          <div className="sales-commission-row">
            <label>
              <span>개별 정산율</span>
              <input
                max="100"
                min="0"
                onChange={(event) => setCommissionPercent(event.target.value)}
                step="0.1"
                type="number"
                value={commissionPercent}
              />
            </label>
            <button className="button" type="button" onClick={() => void saveCommissionPercent()} disabled={isBusy || !visibleSummary.selectedSalesperson}>
              정산율 저장
            </button>
          </div>
        </>
        )}

        {activePage === 'assignments' && (
        <>
          <div className="sales-summary-grid">
            <div className="mini-card">
              <span>검색/선택 영업자</span>
              <strong>{visibleSummary.selectedSalesperson?.name ?? '영업자 없음'}</strong>
              <p>{visibleSummary.selectedSalesperson ? `${visibleSummary.selectedSalesperson.email} / ${visibleSummary.selectedSalesperson.commissionPercent}%` : '상단 영업자 검색 후 조회하면 배정할 영업자가 표시됩니다.'}</p>
            </div>
            <div className="mini-card">
              <span>배정 대상 회원</span>
              <strong>{visibleSummary.customers.find((customer) => customer.id === selectedCustomerId)?.name ?? '회원 없음'}</strong>
              <p>{visibleSummary.customers.find((customer) => customer.id === selectedCustomerId)?.email ?? '회원 검색 후 선택하세요.'}</p>
            </div>
            <div className="mini-card">
              <span>검색 결과</span>
              <strong>{visibleSummary.salespeople.length.toLocaleString('ko-KR')}명</strong>
              <p>이름 또는 이메일로 검색된 영업자 목록 기준입니다.</p>
            </div>
          </div>
          <div className="sales-assignment-panel">
            <div className="toolbar compact">
              <div>
                <h3>회원 영업자 배정</h3>
                <p className="compact-copy">회원을 선택한 뒤 위 영업자를 선택하면 담당 영업자를 변경할 수 있습니다.</p>
              </div>
              <button className="button" type="button" onClick={() => void assignCustomerSalesperson()} disabled={isBusy || !selectedCustomerId || !selectedSalespersonId}>
                선택 회원 배정
              </button>
            </div>
            <div className="sales-filter-grid compact">
              <label>
                <span>회원 검색</span>
                <input
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  placeholder="회원 이메일 또는 이름"
                  ref={customerSearchInputRef}
                  value={customerQuery}
                />
              </label>
              <button className="button secondary" type="button" onClick={() => void refresh()} disabled={isBusy}>
                회원 조회
              </button>
            </div>
            <div className="sales-customer-list" aria-label="영업자 배정 회원 목록">
              {visibleSummary.customers.map((customer) => (
                <button
                  aria-pressed={selectedCustomerId === customer.id}
                  className={`sales-customer-card${selectedCustomerId === customer.id ? ' active' : ''}`}
                  key={customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
                  type="button"
                >
                  <strong>{customer.name}</strong>
                  <span>{customer.email}</span>
                  <small>현재 영업자: {customer.salesperson ? `${customer.salesperson.name} / ${customer.salesperson.email}` : '미배정'}</small>
                </button>
              ))}
              {visibleSummary.customers.length === 0 && (
                <p className="notice compact">검색 조건에 맞는 회원이 없습니다.</p>
              )}
            </div>
          </div>
        </>
        )}

        {activePage === 'revenue' && (
        <>
          <div className="sales-summary-grid">
            <div className="mini-card">
              <span>선택 영업자</span>
              <strong>{visibleSummary.selectedSalesperson?.name ?? '영업자 없음'}</strong>
              <p>{visibleSummary.selectedSalesperson ? `${visibleSummary.selectedSalesperson.email} / ${visibleSummary.selectedSalesperson.commissionPercent}%` : '영업자를 선택하면 매출 리스트가 좁혀집니다.'}</p>
            </div>
            <div className="mini-card">
              <span>매출 집계</span>
              <strong>{formatUsd(visibleSummary.totals.salesUsd)}</strong>
              <p>매출 {visibleSummary.totals.salesCount}건 / 포인트 {formatPoint(visibleSummary.totals.points)}</p>
            </div>
            <div className="mini-card">
              <span>조회 기간</span>
              <strong>{from || to ? `${from || '시작'} ~ ${to || '종료'}` : '전체 기간'}</strong>
              <p>상단 기간 범위와 영업자 검색 조건을 적용합니다.</p>
            </div>
          </div>
          <div className="sales-commission-row">
            <button className="button secondary" type="button" onClick={downloadSalesExcel} disabled={visibleSummary.rows.length === 0}>
              엑셀출력
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>매출일</th>
                <th>이메일</th>
                <th>구독플랜</th>
                <th>매출</th>
                <th>적립률</th>
                <th>적립포인트</th>
              </tr>
            </thead>
            <tbody>
              {visibleSummary.rows.map((row) => (
                <tr key={row.paymentId}>
                  <td>{row.salesDate}</td>
                  <td>{row.email}<br /><small>{row.customerName}</small></td>
                  <td>{row.subscriptionPlan}</td>
                  <td>{formatUsd(row.amountUsd)}</td>
                  <td>{row.commissionPercent}%</td>
                  <td>{formatPoint(row.points)}</td>
                </tr>
              ))}
              {visibleSummary.rows.length === 0 && (
                <tr>
                  <td colSpan={6}>선택한 기간과 영업자에 해당하는 매출이 없습니다.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={3}>합계</th>
                <th>{formatUsd(visibleSummary.totals.salesUsd)}</th>
                <th>{visibleSummary.selectedSalesperson?.commissionPercent ?? visibleSummary.defaultPercent}%</th>
                <th>{formatPoint(visibleSummary.totals.points)}</th>
              </tr>
            </tfoot>
          </table>
        </>
        )}
      </div>
    </section>
  );
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

function formatPoint(value: number): string {
  return value.toLocaleString('ko-KR');
}

function getSalesPageFromHash(hash: string): SalesPageKey {
  const targetId = hash.startsWith('#') ? hash.slice(1) : hash;
  return SALES_SUBMENU.find((item) => item.anchorId === targetId)?.key ?? 'teams';
}

function getSalespersonIdFromSearch(search: string): string {
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return searchParams.get('salespersonId') ?? '';
}

function getSalespersonSearchResults(
  salespeople: SalespersonItem[],
  query: string,
): SalespersonItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return salespeople.slice(0, 6);

  return salespeople
    .filter((salesperson) => (
      salesperson.name.toLowerCase().includes(normalizedQuery)
      || salesperson.email.toLowerCase().includes(normalizedQuery)
    ))
    .slice(0, 8);
}
