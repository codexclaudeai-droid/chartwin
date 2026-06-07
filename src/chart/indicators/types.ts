export interface IndicatorCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume?: number;
  sellVolume?: number;
  volumeDelta?: number;
  time?: number;
}

export type NullableSeries = Array<number | null>;
