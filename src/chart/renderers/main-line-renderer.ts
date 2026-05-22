export interface IndicatorLineStyle {
  color: string;
  width: number;
  dash: number[];
}

export interface IndicatorSeriesLine {
  id: string;
  data: Array<number | null>;
}

export type DrawSeriesLine = (
  data: Array<number | null>,
  color: string,
  width?: number,
  dash?: number[],
) => void;

export type ResolveIndicatorStyle = (
  key: string,
  fallbackColor: string,
  fallbackWidth?: number,
  fallbackDash?: number[],
) => IndicatorLineStyle;

export function renderMainMovingAverageLines(params: {
  maSeries: IndicatorSeriesLine[];
  emaSeries: IndicatorSeriesLine[];
  showLine: (key: string) => boolean;
  resolveStyle: ResolveIndicatorStyle;
  drawLine: DrawSeriesLine;
}): void {
  const { maSeries, emaSeries, showLine, resolveStyle, drawLine } = params;
  maSeries.forEach((maLine, index) => {
    if (!showLine(maLine.id)) return;
    const palette = ['#f7931a', '#2962ff', '#4caf50', '#9c27b0', '#ff5722', '#00bcd4', '#ffc107', '#e91e63'];
    const style = resolveStyle(maLine.id, palette[index % palette.length]);
    drawLine(maLine.data, style.color, style.width, style.dash);
  });
  emaSeries.forEach((emaLine, index) => {
    if (!showLine(emaLine.id)) return;
    const palette = ['#ff9800', '#00b0ff', '#7cb342', '#ab47bc', '#ff7043', '#26c6da', '#ffd54f', '#ec407a'];
    const style = resolveStyle(emaLine.id, palette[index % palette.length]);
    drawLine(emaLine.data, style.color, style.width, style.dash);
  });
}

export function renderLegacyMainMaLines(params: {
  indicatorLayerOn: boolean;
  indicators: any;
  lines: Array<{ indicatorKey: string; styleKey: string; fallbackColor: string; data: Array<number | null> }>;
  showLine: (key: string) => boolean;
  resolveStyle: ResolveIndicatorStyle;
  drawLine: DrawSeriesLine;
}): void {
  const { indicatorLayerOn, indicators, lines, showLine, resolveStyle, drawLine } = params;
  lines.forEach(({ indicatorKey, styleKey, fallbackColor, data }) => {
    if (!indicatorLayerOn || !indicators[indicatorKey]?.show || !showLine(styleKey)) return;
    const style = resolveStyle(styleKey, fallbackColor);
    drawLine(data, style.color, style.width, style.dash);
  });
}

export function renderBollingerBandLines(params: {
  bbSeries: Array<{ id: string; data: { upper: Array<number | null>; middle: Array<number | null>; lower: Array<number | null> } }>;
  showLine: (key: string) => boolean;
  resolveStyle: ResolveIndicatorStyle;
  drawLine: DrawSeriesLine;
}): void {
  const { bbSeries, showLine, resolveStyle, drawLine } = params;
  bbSeries.forEach((bbLine, index) => {
    const palette = ['100,149,237', '255,193,7', '38,166,154', '239,83,80', '156,39,176'];
    const rgb = palette[index % palette.length];
    const upKey = `${bbLine.id}Upper`;
    const midKey = `${bbLine.id}Middle`;
    const lowKey = `${bbLine.id}Lower`;
    const up = resolveStyle(upKey, `rgba(${rgb},0.8)`, 1);
    const mid = resolveStyle(midKey, `rgba(${rgb},0.5)`, 1, [4, 4]);
    const low = resolveStyle(lowKey, `rgba(${rgb},0.8)`, 1);
    if (showLine(upKey)) drawLine(bbLine.data.upper, up.color, up.width, up.dash);
    if (showLine(midKey)) drawLine(bbLine.data.middle, mid.color, mid.width, mid.dash);
    if (showLine(lowKey)) drawLine(bbLine.data.lower, low.color, low.width, low.dash);
  });
}

export function renderSingleMainLine(params: {
  enabled: boolean;
  styleKey: string;
  fallbackColor: string;
  data: Array<number | null>;
  showLine: (key: string) => boolean;
  resolveStyle: ResolveIndicatorStyle;
  drawLine: DrawSeriesLine;
}): void {
  const { enabled, styleKey, fallbackColor, data, showLine, resolveStyle, drawLine } = params;
  if (!enabled || !showLine(styleKey)) return;
  const style = resolveStyle(styleKey, fallbackColor);
  drawLine(data, style.color, style.width, style.dash);
}
