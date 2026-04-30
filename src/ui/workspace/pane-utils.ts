export type MainIndicatorsLike = {
  indicators: {
    maShort: { show: boolean };
    maLong: { show: boolean };
    ma?: { show: boolean; lines?: Array<{ id: string; period: number }> };
    ma60: { show: boolean };
    ma120: { show: boolean };
    ma200: { show: boolean };
    bb: { show: boolean };
    vwap: { show: boolean };
    supertrend: { show: boolean };
    statisticalTrailingStop: { show: boolean };
    zeroLagMaTrendLevels: { show: boolean };
    ichimoku: { show: boolean };
    envelope: { show: boolean };
  };
};

export function collectMainIndicatorNames(config: MainIndicatorsLike): string[] {
  const names: string[] = [];
  if (
    (config.indicators.ma?.show && (config.indicators.ma.lines?.length ?? 0) > 0) ||
    config.indicators.maShort.show ||
    config.indicators.maLong.show ||
    config.indicators.ma60.show ||
    config.indicators.ma120.show ||
    config.indicators.ma200.show
  ) names.push('MA');
  if (config.indicators.bb.show) names.push('BB');
  if (config.indicators.vwap.show) names.push('VWAP');
  if (config.indicators.supertrend.show) names.push('ST');
  if (config.indicators.statisticalTrailingStop.show) names.push('STS');
  if (config.indicators.zeroLagMaTrendLevels.show) names.push('ZLMA');
  if (config.indicators.ichimoku.show) names.push('ICHI');
  if (config.indicators.envelope.show) names.push('ENV');
  return names;
}

export type RangeChartLike = {
  setVisibleAll: () => void;
  setVisibleBySeconds: (seconds: number) => void;
  setVisibleByDateRange?: (fromSec: number, toSec: number) => void;
  setTimeframe?: (timeframe: '1m' | '5m' | '30m' | '1h' | '2h' | '1d' | '1w' | '1M') => void;
};

export function applyRangeToChart(chart: RangeChartLike, key: string): void {
  const timeframeByRange: Partial<Record<string, '1m' | '5m' | '30m' | '1h' | '2h' | '1d' | '1w' | '1M'>> = {
    '1D': '1m',
    '5D': '5m',
    '1M': '30m',
    '3M': '1h',
    '6M': '2h',
    '1Y': '1d',
    '5Y': '1w',
    '전체': '1M',
  };
  const secondsByRange: Partial<Record<string, number>> = {
    '1D': 1 * 86400,
    '5D': 5 * 86400,
    '1M': 30 * 86400,
    '3M': 90 * 86400,
    '6M': 180 * 86400,
    '1Y': 365 * 86400,
    '5Y': (365 * 5) * 86400,
  };

  const mappedTimeframe = timeframeByRange[key];
  if (mappedTimeframe && typeof chart.setTimeframe === 'function') {
    chart.setTimeframe(mappedTimeframe);
    if (key === '전체') {
      chart.setVisibleAll();
      return;
    }
    const spanSec = secondsByRange[key];
    if (Number.isFinite(spanSec)) {
      chart.setVisibleBySeconds(spanSec as number);
      return;
    }
  }

  if (key === 'YTD') {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const sec = Math.floor((now.getTime() - start.getTime()) / 1000);
    chart.setVisibleBySeconds(sec);
    return;
  }

  if (key === '전체') {
    chart.setVisibleAll();
    return;
  }

  chart.setVisibleBySeconds(secondsByRange[key] ?? (30 * 86400));
}
