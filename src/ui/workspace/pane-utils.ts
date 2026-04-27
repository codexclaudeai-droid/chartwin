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
};

export function applyRangeToChart(chart: RangeChartLike, key: string): void {
  if (key === '전체') {
    chart.setVisibleAll();
    return;
  }
  if (key === '입력') {
    const val = window.prompt('범위를 입력하세요 (예: 90)', '90');
    const days = Number(val);
    if (!Number.isFinite(days) || days <= 0) return;
    chart.setVisibleBySeconds(days * 86400);
    return;
  }
  if (key === 'YTD') {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const sec = Math.floor((now.getTime() - start.getTime()) / 1000);
    chart.setVisibleBySeconds(sec);
    return;
  }
  const map: Record<string, number> = {
    '1D': 1, '5D': 5, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '5Y': 365 * 5,
  };
  chart.setVisibleBySeconds((map[key] ?? 30) * 86400);
}
