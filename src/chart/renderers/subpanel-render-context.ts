import type { IndicatorLineStyle } from './main-line-renderer.ts';

export interface SubPanelRenderContext {
  ctx: CanvasRenderingContext2D;
  top: number;
  panelHeight: number;
  chartLeft: number;
  subChartWidth: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  startIndex: number;
  endIndex: number;
  visLength: number;
  drawPanelLegend: (title: string, top: number, items: Array<{ text: string; color: string; enabled?: boolean }>) => void;
  subGrid: (
    values: number[],
    top: number,
    panelHeight: number,
    lo: number,
    hi: number,
    formatter?: (value: number) => string,
  ) => void;
  subLine: (
    data: Array<number | null>,
    color: string,
    width: number,
    top: number,
    panelHeight: number,
    lo: number,
    hi: number,
    dash?: number[],
  ) => void;
  subHorizontalLine: (
    value: number,
    color: string,
    width: number,
    top: number,
    panelHeight: number,
    lo: number,
    hi: number,
    dash?: number[],
  ) => void;
  drawSubAlertLines: (panelId: string, top: number, panelHeight: number, lo: number, hi: number) => void;
  drawSubAxisValue: (value: number, top: number, panelHeight: number, lo: number, hi: number, color: string, text?: string) => void;
  getSubPlotBounds: (top: number, panelHeight: number) => { plotTop: number; plotH: number };
  scaleRange: (lo: number, hi: number) => { lo: number; hi: number };
  showLine: (key: string) => boolean;
  resolveStyle: (key: string, fallbackColor: string, fallbackWidth?: number, fallbackDash?: number[]) => IndicatorLineStyle;
}
