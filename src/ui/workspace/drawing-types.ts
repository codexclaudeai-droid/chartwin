export type DrawingToolId =
  | 'trendline'
  | 'hline'
  | 'channel'
  | 'fib-retracement'
  | 'fib-trend'
  | 'long-position'
  | 'short-position'
  | 'measure'
  | 'text-note';

export type DrawingAnchor = {
  index: number;
  price: number;
};

export type DrawingShape = {
  id: string;
  kind: DrawingToolId;
  a: DrawingAnchor;
  b?: DrawingAnchor;
  text?: string;
  color?: string;
  width?: number;
  lineStyle?: 'solid' | 'dash' | 'dot';
  channelOffset?: DrawingAnchor;
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
};

export type DrawingDraft = {
  kind: DrawingToolId;
  a: DrawingAnchor;
  b: DrawingAnchor;
  channelOffset?: DrawingAnchor;
  stage?: number;  // Position 드로잉: 0=미완성, 1=진입만 설정, 2=모두 설정
};

export type DrawingHitPart =
  | 'line'
  | 'start'
  | 'end'
  | 'body'
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
  | 'channel-mid-parallel';
