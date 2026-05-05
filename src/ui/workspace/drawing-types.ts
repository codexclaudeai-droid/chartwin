export type DrawingToolId =
  | 'trendline'
  | 'hline'
  | 'channel'
  | 'fib-retracement'
  | 'fib-trend'
  | 'anchored-vwap'
  | 'draw-pencil'
  | 'draw-highlighter'
  | 'draw-box'
  | 'long-position'
  | 'short-position'
  | 'measure'
  | 'text-note';

export type DrawingAnchor = {
  index: number;
  price: number;
};

export type AnchoredVwapSource =
  | 'close'
  | 'open'
  | 'high'
  | 'low'
  | 'hl2'
  | 'hlc3'
  | 'ohlc4';

export type AnchoredVwapBandConfig = {
  enabled: boolean;
  multiplier: number;
  color: string;
  visible: boolean;
};

export type AnchoredVwapSettings = {
  source: AnchoredVwapSource;
  bandMode: 'standard-deviation';
  showLine: boolean;
  showPriceLabels: boolean;
  showBackground: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  bands: [AnchoredVwapBandConfig, AnchoredVwapBandConfig, AnchoredVwapBandConfig];
};

export type DrawingShape = {
  id: string;
  kind: DrawingToolId;
  a: DrawingAnchor;
  b?: DrawingAnchor;
  points?: DrawingAnchor[];
  text?: string;
  color?: string;
  width?: number;
  lineStyle?: 'solid' | 'dash' | 'dot';
  channelOffset?: DrawingAnchor;
  avwap?: AnchoredVwapSettings;
  hidden?: boolean;
  locked?: boolean;
  alert?: {
    enabled: boolean;
    mode: 'up' | 'down';
    target: 'price' | 'trendline';
    priceValue?: number;
    appPush: boolean;
    onsite: boolean;
    sound: boolean;
    lastTriggerBar?: number;
  };
  position?: {
    accountSize: number;
    accountUnit: 'default' | 'USD' | 'KRW';
    riskMode: 'percent' | 'amount';
    riskPercent: number;
    riskAmount: number;
    leverageEnabled: boolean;
    leverage: number;
    quantityPrecision: number;
  };
};

export type DrawingDraft = {
  kind: DrawingToolId;
  a: DrawingAnchor;
  b: DrawingAnchor;
  points?: DrawingAnchor[];
  channelOffset?: DrawingAnchor;
  stage?: number;  // Position 드로잉: 0=미완성, 1=진입만 설정, 2=모두 설정
};

export type DrawingHitPart =
  | 'line'
  | 'start'
  | 'end'
  | 'body'
  | 'position-entry-info'
  | 'trendline-text-guide'
  | 'fib-offset'
  | 'position-target'
  | 'position-stop'
  | 'position-right'
  | 'channel-a'
  | 'channel-b'
  | 'channel-offset'
  | 'channel-center'
  | 'channel-mid-base'
  | 'channel-mid-parallel'
  | 'box-tl'
  | 'box-tr'
  | 'box-br'
  | 'box-bl';
