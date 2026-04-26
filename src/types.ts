export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorConfig {
  show: boolean;
  value?: number;
  period?: number;
  stdDev?: number;
  nextId?: number;
  lines?: Array<{ id: string; period: number }>;
}

export interface LayoutConfig {
  mainRatio: number;
  volumeRatio: number;
  rsiRatio: number;
  dmiRatio: number;
}

export interface ChartConfig {
  symbol: string;
  timeframe: string;
  indicators: {
    maShort: IndicatorConfig;
    maLong: IndicatorConfig;
    ma?: IndicatorConfig;
    bb: IndicatorConfig;
    rsi: IndicatorConfig;
    volume: IndicatorConfig;
    dmi: IndicatorConfig;
  };
  layout: LayoutConfig;
}
