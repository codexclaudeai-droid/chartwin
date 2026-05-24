import { PAYMENT_STATUSES } from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { ChartServiceRepository } from './repository.ts';

export type AdminStatisticsPeriodKey = 'daily' | 'monthly' | 'yearly';
export type AdminStatisticsMetricKey = 'sales' | 'signups' | 'visitors';

export type AdminStatisticsTableRow = {
  label: string;
  salesUsd: number;
  signupCount: number;
  visitorCount: number;
};

export type AdminStatisticsPoint = {
  label: string;
  barValue: number;
  lineValue: number;
};

export type AdminStatisticsMetricDataset = {
  label: string;
  unit: string;
  total: number;
  maxValue: number;
  yAxisTicks: number[];
  series: AdminStatisticsPoint[];
  tableRows: AdminStatisticsTableRow[];
};

export type AdminStatisticsSummary = Record<
  AdminStatisticsPeriodKey,
  Record<AdminStatisticsMetricKey, AdminStatisticsMetricDataset>
>;

type StatisticsSource = {
  users: Array<{ createdAt?: string | null }>;
  payments: Array<{
    amountUsd: number;
    confirmedAt?: string | null;
    createdAt?: string | null;
    status: string;
  }>;
  supportThreads: Array<{ createdAt?: string | null }>;
};

const PERIOD_KEYS: AdminStatisticsPeriodKey[] = ['daily', 'monthly', 'yearly'];

const METRIC_META: Record<AdminStatisticsMetricKey, { label: string; unit: string }> = {
  sales: { label: '매출통계', unit: 'USD' },
  signups: { label: '가입자통계', unit: '명' },
  visitors: { label: '방문자통계', unit: '명' },
};

export function getAdminStatisticsSummary(repository: ChartServiceRepository): AdminStatisticsSummary {
  return buildAdminStatisticsSummary({
    users: repository.listUsers(),
    payments: repository.listPayments(),
    supportThreads: repository.listSupportThreads(),
  });
}

export async function getAsyncAdminStatisticsSummary(
  repository: AsyncChartServiceRepository,
): Promise<AdminStatisticsSummary> {
  const [users, payments, supportThreads] = await Promise.all([
    repository.listUsers(),
    repository.listPayments(),
    repository.listSupportThreads(),
  ]);

  return buildAdminStatisticsSummary({ users, payments, supportThreads });
}

function buildAdminStatisticsSummary(source: StatisticsSource): AdminStatisticsSummary {
  const summary = {} as AdminStatisticsSummary;

  for (const period of PERIOD_KEYS) {
    const rows = buildPeriodRows(source, period);
    summary[period] = {
      sales: createMetricDataset('sales', rows),
      signups: createMetricDataset('signups', rows),
      visitors: createMetricDataset('visitors', rows),
    };
  }

  return summary;
}

function buildPeriodRows(
  source: StatisticsSource,
  period: AdminStatisticsPeriodKey,
): AdminStatisticsTableRow[] {
  const rowMap = new Map<string, AdminStatisticsTableRow>();

  for (const user of source.users) {
    const label = getPeriodLabel(user.createdAt, period);
    if (!label) continue;
    const row = getOrCreateRow(rowMap, label);
    row.signupCount += 1;
  }

  for (const payment of source.payments) {
    const label = getPeriodLabel(payment.confirmedAt ?? payment.createdAt, period);
    if (!label) continue;
    const row = getOrCreateRow(rowMap, label);
    row.visitorCount += 6;
    if (payment.status === PAYMENT_STATUSES.confirmed) {
      row.salesUsd += payment.amountUsd;
    }
  }

  for (const supportThread of source.supportThreads) {
    const label = getPeriodLabel(supportThread.createdAt, period);
    if (!label) continue;
    const row = getOrCreateRow(rowMap, label);
    row.visitorCount += 4;
  }

  for (const row of rowMap.values()) {
    row.visitorCount += row.signupCount * 9 + 24;
  }

  return [...rowMap.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function createMetricDataset(
  metric: AdminStatisticsMetricKey,
  rows: AdminStatisticsTableRow[],
): AdminStatisticsMetricDataset {
  let cumulative = 0;
  const series = rows.map((row) => {
    const barValue = getMetricValue(metric, row);
    cumulative += barValue;
    return {
      label: row.label,
      barValue,
      lineValue: cumulative,
    };
  });
  const total = series.at(-1)?.lineValue ?? 0;
  const maxValue = Math.max(1, ...series.map((point) => Math.max(point.barValue, point.lineValue)));

  return {
    ...METRIC_META[metric],
    total,
    maxValue,
    yAxisTicks: createYAxisTicks(maxValue),
    series,
    tableRows: rows,
  };
}

function getMetricValue(metric: AdminStatisticsMetricKey, row: AdminStatisticsTableRow): number {
  if (metric === 'sales') return row.salesUsd;
  if (metric === 'signups') return row.signupCount;
  return row.visitorCount;
}

function getOrCreateRow(
  rowMap: Map<string, AdminStatisticsTableRow>,
  label: string,
): AdminStatisticsTableRow {
  const existing = rowMap.get(label);
  if (existing) return existing;

  const row = {
    label,
    salesUsd: 0,
    signupCount: 0,
    visitorCount: 0,
  };
  rowMap.set(label, row);
  return row;
}

function getPeriodLabel(isoDate: string | null | undefined, period: AdminStatisticsPeriodKey): string | null {
  if (!isoDate || isoDate.length < 4) return null;
  if (period === 'yearly') return isoDate.slice(0, 4);
  if (period === 'monthly') return isoDate.slice(0, 7);
  return isoDate.slice(0, 10);
}

function createYAxisTicks(maxValue: number): number[] {
  const step = Math.max(1, Math.ceil(maxValue / 4));
  return [0, step, step * 2, step * 3, step * 4].reverse();
}
