'use client';

import { useEffect, useState } from 'react';

type SalespersonItem = {
  id: string;
  email: string;
  name: string;
  commissionPercent: number;
  salesCount: number;
  salesUsd: number;
  points: number;
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
  salespersonQuery: string;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  salespeople: SalespersonItem[];
  selectedSalesperson: SalespersonItem | null;
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

export function AdminSalesPanel() {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedSalespersonId, setSelectedSalespersonId] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('30');
  const [message, setMessage] = useState('영업관리 데이터를 불러오는 중입니다.');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(nextSalespersonId = selectedSalespersonId) {
    setIsBusy(true);
    const searchParams = new URLSearchParams();
    if (query.trim()) searchParams.set('query', query.trim());
    if (from) searchParams.set('from', from);
    if (to) searchParams.set('to', to);
    if (nextSalespersonId) searchParams.set('salespersonId', nextSalespersonId);

    const response = await fetch(`/api/admin/sales?${searchParams.toString()}`, { cache: 'no-store' });
    const payload = await response.json() as SalesResponse;
    setIsBusy(false);

    if (!response.ok || !payload.summary) {
      setSummary(null);
      setMessage(payload.message || '영업관리 데이터를 불러올 수 없습니다.');
      return;
    }

    setSummary(payload.summary);
    const nextSelectedId = payload.summary.selectedSalesperson?.id ?? '';
    setSelectedSalespersonId(nextSelectedId);
    setCommissionPercent(String(payload.summary.selectedSalesperson?.commissionPercent ?? payload.summary.defaultPercent));
    setMessage(`영업자 ${payload.summary.salespeople.length}명, 매출 ${payload.summary.totals.salesCount}건을 불러왔습니다.`);
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

    setSummary(payload.summary);
    setCommissionPercent(String(payload.summary.selectedSalesperson?.commissionPercent ?? payload.summary.defaultPercent));
    setMessage('개별 정산율을 저장했습니다. 최고관리자 권한으로만 변경할 수 있습니다.');
  }

  function selectSalesperson(salespersonId: string) {
    setSelectedSalespersonId(salespersonId);
    void refresh(salespersonId);
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

  return (
    <section className="card wide" id="admin-sales">
      <div className="toolbar">
        <div>
          <h2>영업관리</h2>
          <p className="compact-copy">영업자별 매출 현황, 적립포인트, 개별 정산율을 관리합니다.</p>
        </div>
        <button className="button secondary" type="button" onClick={() => void refresh()} disabled={isBusy}>
          새로고침
        </button>
      </div>
      <p className="notice">{message}</p>
      <div className="sales-filter-grid" aria-label="영업관리 필터">
        <label>
          <span>영업자 검색</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이메일 또는 이름"
            value={query}
          />
        </label>
        <label>
          <span>기간 범위 시작</span>
          <input type="date" onChange={(event) => setFrom(event.target.value)} value={from} />
        </label>
        <label>
          <span>기간 범위 종료</span>
          <input type="date" onChange={(event) => setTo(event.target.value)} value={to} />
        </label>
        <button className="button" type="button" onClick={() => void refresh()} disabled={isBusy}>
          조회
        </button>
      </div>
      {summary && (
        <>
          <div className="sales-summary-grid">
            <div className="mini-card">
              <span>기본 정산율</span>
              <strong>{summary.defaultPercent}%</strong>
              <p>기본값은 30%이며 최고관리자만 개별 정산율을 변경할 수 있습니다.</p>
            </div>
            <div className="mini-card">
              <span>선택 영업자</span>
              <strong>{summary.selectedSalesperson?.email ?? '영업자 없음'}</strong>
              <p>{summary.selectedSalesperson ? `${summary.selectedSalesperson.name} / ${summary.selectedSalesperson.commissionPercent}%` : '영업자 역할 회원을 먼저 지정하세요.'}</p>
            </div>
            <div className="mini-card">
              <span>집계</span>
              <strong>{formatUsd(summary.totals.salesUsd)}</strong>
              <p>적립포인트 {formatPoint(summary.totals.points)} / 매출 {summary.totals.salesCount}건</p>
            </div>
          </div>
          <div className="salesperson-list" aria-label="영업자 목록">
            {summary.salespeople.map((salesperson) => (
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
            {summary.salespeople.length === 0 && (
              <p className="notice compact">검색 조건에 맞는 영업자가 없습니다.</p>
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
            <button className="button" type="button" onClick={() => void saveCommissionPercent()} disabled={isBusy || !summary.selectedSalesperson}>
              정산율 저장
            </button>
            <button className="button secondary" type="button" onClick={downloadSalesExcel} disabled={summary.rows.length === 0}>
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
              {summary.rows.map((row) => (
                <tr key={row.paymentId}>
                  <td>{row.salesDate}</td>
                  <td>{row.email}<br /><small>{row.customerName}</small></td>
                  <td>{row.subscriptionPlan}</td>
                  <td>{formatUsd(row.amountUsd)}</td>
                  <td>{row.commissionPercent}%</td>
                  <td>{formatPoint(row.points)}</td>
                </tr>
              ))}
              {summary.rows.length === 0 && (
                <tr>
                  <td colSpan={6}>선택한 기간과 영업자에 해당하는 매출이 없습니다.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={3}>합계</th>
                <th>{formatUsd(summary.totals.salesUsd)}</th>
                <th>{summary.selectedSalesperson?.commissionPercent ?? summary.defaultPercent}%</th>
                <th>{formatPoint(summary.totals.points)}</th>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </section>
  );
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

function formatPoint(value: number): string {
  return value.toLocaleString('ko-KR');
}
