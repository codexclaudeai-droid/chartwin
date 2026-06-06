export interface IndicatorCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time?: number;
}

export type NullableSeries = Array<number | null>;
