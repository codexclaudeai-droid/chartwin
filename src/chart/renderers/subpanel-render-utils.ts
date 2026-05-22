import { toRgba } from '../color-utils.ts';

export interface SubPanelPlotBounds {
  plotTop: number;
  plotH: number;
}

export interface SubIndicatorAlertLike {
  id: string;
  panelId: string;
  value: number;
  color: string;
  enabled: boolean;
}

export interface SubIndicatorAlertHitArea {
  id: string;
  panelId: string;
  x1: number;
  x2: number;
  y: number;
  panelTop: number;
  panelHeight: number;
}

export function getSubAxisSnapUnit(lo: number, hi: number): 5 | 10 {
  const range = Math.abs(hi - lo);
  return range >= 80 ? 10 : 5;
}

export function snapSubAxisValue(value: number, lo: number, hi: number): number {
  const unit = getSubAxisSnapUnit(lo, hi);
  return Math.round(value / unit) * unit;
}

export function createSubPanelLabelRenderer(params: {
  ctx: CanvasRenderingContext2D;
  visible: boolean;
  fontStack: string;
  defaultColor: string;
}): (text: string, top: number, color?: string) => void {
  const { ctx, visible, fontStack, defaultColor } = params;
  return (text: string, top: number, color = defaultColor) => {
    if (!visible) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `700 13px ${fontStack}`;
    ctx.textAlign = 'left';
    ctx.fillText(text, 8, top + 16);
    ctx.restore();
  };
}

export function createSubPanelLegendRenderer(params: {
  ctx: CanvasRenderingContext2D;
  visible: boolean;
  fontStack: string;
  textColor: string;
}): (title: string, top: number, items: Array<{ text: string; color: string; enabled?: boolean }>) => void {
  const { ctx, visible, fontStack, textColor } = params;
  return (title: string, top: number, items: Array<{ text: string; color: string; enabled?: boolean }>) => {
    if (!visible) return;
    ctx.save();
    ctx.font = `700 13px ${fontStack}`;
    ctx.textAlign = 'left';
    let x = 8;
    const y = top + 16;
    ctx.fillStyle = textColor;
    ctx.fillText(title, x, y);
    x += ctx.measureText(title).width + 12;
    for (const item of items) {
      if (item.enabled === false) continue;
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, x, y);
      x += ctx.measureText(item.text).width + 10;
    }
    ctx.restore();
  };
}

export function createSubGridRenderer(params: {
  ctx: CanvasRenderingContext2D;
  chartLeft: number;
  subChartRight: number;
  subAxisStart: number;
  fontStack: string;
  textColor: string;
  getSubPlotBounds: (top: number, panelHeight: number) => SubPanelPlotBounds;
  formatDefault: (value: number) => string;
}): (
  values: number[],
  top: number,
  panelHeight: number,
  lo: number,
  hi: number,
  formatter?: (value: number) => string,
) => void {
  const { ctx, chartLeft, subChartRight, subAxisStart, fontStack, textColor, getSubPlotBounds, formatDefault } = params;
  return (values, top, panelHeight, lo, hi, formatter) => {
    const { plotTop, plotH } = getSubPlotBounds(top, panelHeight);
    const range = hi - lo || 1;
    ctx.save();
    ctx.strokeStyle = '#1e2230';
    ctx.fillStyle = textColor;
    ctx.font = `12px ${fontStack}`;
    ctx.textAlign = 'left';
    values.forEach((value) => {
      const snapped = snapSubAxisValue(value, lo, hi);
      const clamped = Math.min(hi, Math.max(lo, snapped));
      const y = plotTop + (hi - clamped) / range * plotH;
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(subChartRight, y);
      ctx.stroke();
      ctx.fillText(formatter ? formatter(clamped) : formatDefault(clamped), subAxisStart + 4, y + 4);
    });
    ctx.restore();
  };
}

export function createSubAxisValueRenderer(params: {
  ctx: CanvasRenderingContext2D;
  width: number;
  axisPad: number;
  fontStack: string;
  getSubPlotBounds: (top: number, panelHeight: number) => SubPanelPlotBounds;
}): (value: number, top: number, panelHeight: number, lo: number, hi: number, color: string, text?: string) => void {
  const { ctx, width, axisPad, fontStack, getSubPlotBounds } = params;
  return (value, top, panelHeight, lo, hi, color, text) => {
    const { plotTop, plotH } = getSubPlotBounds(top, panelHeight);
    const range = hi - lo || 1;
    const y = plotTop + (hi - value) / range * plotH;
    const boxW = Math.max(40, Math.min(axisPad - 22, 56));
    const boxX = width - boxW - 2;
    const normalizedText = text == null ? snapSubAxisValue(value, lo, hi).toString() : String(text);
    ctx.save();
    ctx.fillStyle = toRgba(color, 0.28, 'rgba(96,125,139,0.28)');
    ctx.fillRect(boxX, y - 8, boxW, 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = `12px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.fillText(normalizedText, boxX + boxW / 2, y + 3);
    ctx.restore();
  };
}

export function createSubAlertLinesRenderer(params: {
  ctx: CanvasRenderingContext2D;
  alerts: SubIndicatorAlertLike[];
  hitAreas: SubIndicatorAlertHitArea[];
  chartLeft: number;
  subChartRight: number;
  width: number;
  axisPad: number;
  fontStack: string;
  getSubPlotBounds: (top: number, panelHeight: number) => SubPanelPlotBounds;
  formatVolume: (value: number) => string;
}): (panelId: string, top: number, panelHeight: number, lo: number, hi: number) => void {
  const { ctx, alerts, hitAreas, chartLeft, subChartRight, width, axisPad, fontStack, getSubPlotBounds, formatVolume } = params;
  return (panelId, top, panelHeight, lo, hi) => {
    const panelAlerts = alerts.filter((alert) => alert.enabled && alert.panelId === panelId);
    if (!panelAlerts.length) return;
    const { plotTop, plotH } = getSubPlotBounds(top, panelHeight);
    const range = hi - lo || 1;
    ctx.save();
    ctx.lineWidth = 1;
    panelAlerts.forEach((alert) => {
      const y = plotTop + (hi - alert.value) / range * plotH;
      ctx.strokeStyle = toRgba(alert.color, 0.85, 'rgba(255,197,66,0.85)');
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(subChartRight, y);
      ctx.stroke();
      hitAreas.push({
        id: alert.id,
        panelId,
        x1: chartLeft,
        x2: subChartRight,
        y,
        panelTop: top,
        panelHeight,
      });

      const labelText = panelId === 'volume' ? formatVolume(alert.value) : alert.value.toFixed(2);
      ctx.save();
      ctx.font = `12px ${fontStack}`;
      const boxW = Math.max(40, Math.min(axisPad - 22, Math.ceil(ctx.measureText(labelText).width) + 12));
      const boxX = width - boxW - 2;
      ctx.fillStyle = toRgba(alert.color, 0.32, 'rgba(255,197,66,0.32)');
      ctx.fillRect(boxX, y - 8, boxW, 16);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, boxX + boxW / 2, y);
      ctx.restore();
    });
    ctx.setLineDash([]);
    ctx.restore();
  };
}
