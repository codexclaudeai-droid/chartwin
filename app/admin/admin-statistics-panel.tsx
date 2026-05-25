'use client';

import { useEffect, useState } from 'react';

type StatisticsPeriodKey = 'daily' | 'monthly' | 'yearly';
type StatisticsMetricKey = 'sales' | 'signups' | 'visitors';

type StatisticsTableRow = {
  label: string;
  salesUsd: number;
  signupCount: number;
  visitorCount: number;
};

type StatisticsDataset = {
  label: string;
  unit: string;
  total: number;
  maxValue: number;
  yAxisTicks: number[];
  series: Array<{
    label: string;
    barValue: number;
    lineValue: number;
  }>;
  tableRows: StatisticsTableRow[];
};

type StatisticsSummary = Record<StatisticsPeriodKey, Record<StatisticsMetricKey, StatisticsDataset>>;

type StatisticsResponse = {
  ok: boolean;
  message?: string;
  statistics?: StatisticsSummary;
};

const METRIC_OPTIONS: Array<{
  key: StatisticsMetricKey;
  label: string;
  description: string;
  anchorId: string;
}> = [
  { key: 'sales', label: '매출통계', description: '입금 확인 완료 기준 매출 흐름', anchorId: 'admin-statistics-sales' },
  { key: 'signups', label: '가입자통계', description: '회원 가입일 기준 신규 가입 흐름', anchorId: 'admin-statistics-signups' },
  { key: 'visitors', label: '방문자통계', description: '방문 로그 연동 전 추정 방문 흐름', anchorId: 'admin-statistics-visitors' },
];

const PERIOD_OPTIONS: Array<{ key: StatisticsPeriodKey; label: string }> = [
  { key: 'daily', label: '일별' },
  { key: 'monthly', label: '월별' },
  { key: 'yearly', label: '년도별' },
];

export function AdminStatisticsPanel() {
  const [statistics, setStatistics] = useState<StatisticsSummary | null>(null);
  const [activeMetric, setActiveMetric] = useState<StatisticsMetricKey>('sales');
  const [activePeriod, setActivePeriod] = useState<StatisticsPeriodKey>('daily');
  const [message, setMessage] = useState('관리자 통계 데이터를 불러오는 중입니다.');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    function syncMetricFromHash() {
      setActiveMetric(getMetricFromHash(window.location.hash));
    }

    syncMetricFromHash();
    window.addEventListener('hashchange', syncMetricFromHash);
    return () => window.removeEventListener('hashchange', syncMetricFromHash);
  }, []);

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/admin/statistics', { cache: 'no-store' });
    const payload = await response.json() as StatisticsResponse;
    setIsBusy(false);

    if (!response.ok || !payload.statistics) {
      setStatistics(null);
      setMessage(payload.message || '관리자 통계를 불러올 수 없습니다.');
      return;
    }

    setStatistics(payload.statistics);
    setMessage('통계 데이터가 최신 상태로 갱신되었습니다.');
  }

  const dataset = statistics?.[activePeriod][activeMetric] ?? null;
  const activeMetricMeta = METRIC_OPTIONS.find((option) => option.key === activeMetric) ?? METRIC_OPTIONS[0];

  return (
    <section className="card wide" id="admin-statistics">
      <div className="statistics-subpage-anchor" id={activeMetricMeta.anchorId} />
      <div className="toolbar">
        <div>
          <h2>{activeMetricMeta.label}</h2>
          <p className="compact-copy">{activeMetricMeta.description}을 일별, 월별, 년도별로 확인합니다.</p>
        </div>
        <button className="button secondary" type="button" onClick={refresh} disabled={isBusy}>
          새로고침
        </button>
      </div>
      <p className="notice">{message}</p>
      <nav className="admin-web-info-tabs statistics-submenu-tabs" aria-label="통계 세부 메뉴">
        {METRIC_OPTIONS.map((option) => (
          <a
            aria-current={activeMetric === option.key ? 'page' : undefined}
            className={activeMetric === option.key ? 'active' : ''}
            href={`#${option.anchorId}`}
            key={option.key}
          >
            {option.label}
          </a>
        ))}
      </nav>
      <div className="quick-filter-row" aria-label="통계 기간 단위">
        {PERIOD_OPTIONS.map((option) => (
          <button
            aria-pressed={activePeriod === option.key}
            className={`button secondary${activePeriod === option.key ? ' active' : ''}`}
            key={option.key}
            onClick={() => setActivePeriod(option.key)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      {dataset && (
        <>
          <div className="statistics-summary-row">
            <div className="mini-card">
              <span>{activeMetricMeta.label}</span>
              <strong>{formatValue(dataset.total, dataset.unit)}</strong>
              <p>{activeMetricMeta.description}</p>
            </div>
            <div className="mini-card">
              <span>표시 단위</span>
              <strong>{PERIOD_OPTIONS.find((option) => option.key === activePeriod)?.label}</strong>
              <p>막대는 구간별 수치, 선형은 누적 수치입니다.</p>
            </div>
          </div>
          <div className="statistics-chart" aria-label={`${activeMetricMeta.label} ${activePeriod} 혼합 차트`}>
            <div className="statistics-y-axis" aria-label="y축 수치">
              {dataset.yAxisTicks.map((tick) => (
                <span key={tick}>{formatValue(tick, dataset.unit)}</span>
              ))}
            </div>
            <div className="statistics-plot">
              <div className="statistics-bars">
                {dataset.series.map((point) => (
                  <div className="statistics-bar-column" key={point.label}>
                    <div
                      aria-label={`${point.label} 막대 ${formatValue(point.barValue, dataset.unit)}`}
                      className="statistics-bar"
                      style={{ height: `${getBarHeight(point.barValue, dataset.maxValue)}%` }}
                    />
                    <span>{point.label}</span>
                  </div>
                ))}
              </div>
              <svg className="statistics-line" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
                <path d={createLinePath(dataset.series, dataset.maxValue)} />
                {dataset.series.map((point, index) => (
                  <circle
                    cx={getLineX(index, dataset.series.length)}
                    cy={getLineY(point.lineValue, dataset.maxValue)}
                    key={point.label}
                    r="2"
                  />
                ))}
              </svg>
            </div>
          </div>
          <table className="table statistics-table">
            <thead>
              <tr>
                <th>기간</th>
                <th>매출</th>
                <th>가입자</th>
                <th>방문자</th>
              </tr>
            </thead>
            <tbody>
              {dataset.tableRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{formatValue(row.salesUsd, 'USD')}</td>
                  <td>{formatValue(row.signupCount, '명')}</td>
                  <td>{formatValue(row.visitorCount, '명')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function getMetricFromHash(hash: string): StatisticsMetricKey {
  const targetId = hash.startsWith('#') ? hash.slice(1) : hash;
  return METRIC_OPTIONS.find((option) => option.anchorId === targetId)?.key ?? 'sales';
}

function getBarHeight(value: number, maxValue: number): number {
  return Math.max(4, Math.round((value / Math.max(1, maxValue)) * 100));
}

function createLinePath(
  series: StatisticsDataset['series'],
  maxValue: number,
): string {
  if (series.length === 0) return '';

  return series
    .map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${getLineX(index, series.length)} ${getLineY(point.lineValue, maxValue)}`;
    })
    .join(' ');
}

function getLineX(index: number, length: number): number {
  return length <= 1 ? 50 : Math.round(((index + 0.5) / length) * 100);
}

function getLineY(value: number, maxValue: number): number {
  return Math.max(4, 96 - Math.round((value / Math.max(1, maxValue)) * 90));
}

function formatValue(value: number, unit: string): string {
  if (unit === 'USD') return `$${value.toLocaleString('en-US')}`;
  return `${value.toLocaleString('ko-KR')}${unit}`;
}
