import type { WilliamsAlligatorResult } from '../indicators/williams-alligator.ts';
import type { DrawSeriesLine } from './main-line-renderer.ts';

type LineStyleLike = {
  color: string;
  width: number;
  dash: number[];
};

export interface WilliamsAlligatorRenderParams {
  data: WilliamsAlligatorResult;
  showLine: (key: string) => boolean;
  jawStyle: LineStyleLike;
  teethStyle: LineStyleLike;
  lipsStyle: LineStyleLike;
  drawLine: DrawSeriesLine;
}

export function renderWilliamsAlligatorLines(params: WilliamsAlligatorRenderParams): void {
  const { data, showLine, jawStyle, teethStyle, lipsStyle, drawLine } = params;
  if (showLine('williamsAlligatorJaw')) {
    drawLine(data.jaw, jawStyle.color, jawStyle.width, jawStyle.dash, data.offsets.jaw);
  }
  if (showLine('williamsAlligatorTeeth')) {
    drawLine(data.teeth, teethStyle.color, teethStyle.width, teethStyle.dash, data.offsets.teeth);
  }
  if (showLine('williamsAlligatorLips')) {
    drawLine(data.lips, lipsStyle.color, lipsStyle.width, lipsStyle.dash, data.offsets.lips);
  }
}
