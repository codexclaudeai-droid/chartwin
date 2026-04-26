import { toRgba } from './color-utils';

type TrendState = 'up' | 'down';

type ZeroLagBox = {
  left: number;
  right: number;
  leftX: number;
  rightX: number;
  top: number;
  bottom: number;
  isUp: boolean;
  price: number;
};

export type ZeroLagMaTrendLevelsData = {
  emaValue: Array<number | null>;
  zlma: Array<number | null>;
  signalUp: boolean[];
  signalDn: boolean[];
  zlmaColor: Array<TrendState | null>;
  emaColor: Array<TrendState | null>;
  boxes: ZeroLagBox[];
  breakUp: Array<number | null>;
  breakDown: Array<number | null>;
};

export type LineStyleLike = {
  width: number;
  dash: number[];
};

export type ZeroLagTrendStates = {
  zlmaState: TrendState[];
  emaState: TrendState[];
};

export function buildZeroLagTrendStates(data: ZeroLagMaTrendLevelsData, length: number): ZeroLagTrendStates {
  const zlmaState: TrendState[] = new Array(length).fill('up');
  const emaState: TrendState[] = new Array(length).fill('up');
  let prevZ: TrendState = 'up';
  let prevE: TrendState = 'up';
  for (let i = 0; i < length; i += 1) {
    const zRaw = data.zlmaColor[i];
    if (zRaw === 'up' || zRaw === 'down') prevZ = zRaw;
    zlmaState[i] = prevZ;
    const eRaw = data.emaColor[i];
    if (eRaw === 'up' || eRaw === 'down') prevE = eRaw;
    emaState[i] = prevE;
  }
  return { zlmaState, emaState };
}

type SharedRenderParams = {
  ctx: CanvasRenderingContext2D;
  data: ZeroLagMaTrendLevelsData;
  states: ZeroLagTrendStates;
  startIndex: number;
  visLength: number;
  chartLeft: number;
  chartRight: number;
  totalSp: number;
  candleW: number;
  getY: (price: number) => number;
  upColor: string;
  downColor: string;
  fontStack: string;
};

export function drawZeroLagAreaUnderCandles(
  params: SharedRenderParams & { alpha?: number; enabled: boolean },
): void {
  if (!params.enabled) return;
  const {
    ctx,
    data,
    states,
    startIndex,
    visLength,
    chartLeft,
    totalSp,
    candleW,
    getY,
    upColor,
    downColor,
  } = params;
  const baseAlpha = params.alpha ?? 0.22;

  const fillSegment = (
    xA: number,
    xB: number,
    yZA: number,
    yZB: number,
    yEA: number,
    yEB: number,
    zColor: string,
    eColor: string,
  ) => {
    const zMid = (yZA + yZB) * 0.5;
    const eMid = (yEA + yEB) * 0.5;
    if (Math.abs(zMid - eMid) < 0.5 || zColor === eColor) {
      ctx.fillStyle = toRgba(zColor, baseAlpha);
    } else {
      const grad = ctx.createLinearGradient(0, zMid, 0, eMid);
      grad.addColorStop(0, toRgba(zColor, baseAlpha));
      grad.addColorStop(1, toRgba(eColor, baseAlpha));
      ctx.fillStyle = grad;
    }
    ctx.beginPath();
    ctx.moveTo(xA, yZA);
    ctx.lineTo(xB, yZB);
    ctx.lineTo(xB, yEB);
    ctx.lineTo(xA, yEA);
    ctx.closePath();
    ctx.fill();
  };

  ctx.save();
  for (let i = 0; i < visLength - 1; i += 1) {
    const giA = startIndex + i;
    const giB = giA + 1;
    const zA = data.zlma[giA];
    const eA = data.emaValue[giA];
    const zB = data.zlma[giB];
    const eB = data.emaValue[giB];
    if (zA == null || eA == null || zB == null || eB == null) continue;
    const x1 = chartLeft + i * totalSp + candleW / 2;
    const x2 = chartLeft + (i + 1) * totalSp + candleW / 2;
    const yZ1 = getY(zA);
    const yE1 = getY(eA);
    const yZ2 = getY(zB);
    const yE2 = getY(eB);
    const zColor = states.zlmaState[giB] === 'down' ? downColor : upColor;
    const eColor = states.emaState[giB] === 'down' ? downColor : upColor;
    const d1 = zA - eA;
    const d2 = zB - eB;
    if (d1 * d2 < 0) {
      const t = d1 / (d1 - d2);
      const xC = x1 + (x2 - x1) * t;
      const yC = yZ1 + (yZ2 - yZ1) * t;
      fillSegment(x1, xC, yZ1, yC, yE1, yC, zColor, eColor);
      fillSegment(xC, x2, yC, yZ2, yC, yE2, zColor, eColor);
    } else {
      fillSegment(x1, x2, yZ1, yZ2, yE1, yE2, zColor, eColor);
    }
  }
  ctx.restore();
}

export function drawZeroLagOverlays(
  params: SharedRenderParams & {
    showZlma: boolean;
    showEma: boolean;
    showLevels: boolean;
    showSignals: boolean;
    zlmaStyle: LineStyleLike;
    emaStyle: LineStyleLike;
    levelStyle: LineStyleLike;
    signalColor: string;
  },
): void {
  const {
    ctx,
    data,
    states,
    startIndex,
    visLength,
    chartLeft,
    chartRight,
    totalSp,
    candleW,
    getY,
    upColor,
    downColor,
    fontStack,
    showZlma,
    showEma,
    showLevels,
    showSignals,
    zlmaStyle,
    emaStyle,
    levelStyle,
  } = params;

  if (showZlma) {
    ctx.save();
    ctx.lineWidth = zlmaStyle.width;
    ctx.setLineDash(zlmaStyle.dash);
    for (let i = 1; i < visLength; i += 1) {
      const giA = startIndex + i - 1;
      const giB = giA + 1;
      const a = data.zlma[giA];
      const b = data.zlma[giB];
      if (a == null || b == null) continue;
      const x1 = chartLeft + (i - 1) * totalSp + candleW / 2;
      const x2 = chartLeft + i * totalSp + candleW / 2;
      const y1 = getY(a);
      const y2 = getY(b);
      ctx.strokeStyle = states.zlmaState[giB] === 'down' ? downColor : upColor;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (showEma) {
    ctx.save();
    ctx.lineWidth = emaStyle.width;
    ctx.setLineDash(emaStyle.dash);
    for (let i = 1; i < visLength; i += 1) {
      const giA = startIndex + i - 1;
      const giB = giA + 1;
      const a = data.emaValue[giA];
      const b = data.emaValue[giB];
      if (a == null || b == null) continue;
      const x1 = chartLeft + (i - 1) * totalSp + candleW / 2;
      const x2 = chartLeft + i * totalSp + candleW / 2;
      const y1 = getY(a);
      const y2 = getY(b);
      ctx.strokeStyle = states.emaState[giB] === 'down' ? downColor : upColor;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (showLevels) {
    ctx.save();
    data.boxes.forEach((box) => {
      const left = Math.max(startIndex - 8, box.left);
      const right = Math.min(startIndex + visLength + 8, box.right);
      if (right < left) return;
      const leftXIndex = Math.max(startIndex - 8, Math.min(box.leftX, box.rightX));
      const rightXIndex = Math.min(startIndex + visLength + 8, Math.max(box.leftX, box.rightX));
      const x1 = chartLeft + (leftXIndex - startIndex) * totalSp + candleW / 2;
      const x2 = chartLeft + (rightXIndex - startIndex) * totalSp + candleW / 2;
      const yTop = getY(box.top);
      const yBottom = getY(box.bottom);
      const rx = Math.min(x1, x2);
      const rw = Math.max(1, Math.abs(x2 - x1));
      const ry = Math.min(yTop, yBottom);
      const rh = Math.max(1, Math.abs(yBottom - yTop));
      const col = box.isUp ? upColor : downColor;
      ctx.strokeStyle = toRgba(col, 0.9);
      ctx.lineWidth = Math.max(1, levelStyle.width);
      ctx.fillStyle = toRgba(col, 0.1);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      const text = box.price.toFixed(2);
      ctx.fillStyle = '#e3e8f2';
      ctx.font = `500 10px ${fontStack}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(text, Math.min(chartRight - 4, rx + rw - 3), ry + 2);
    });
    ctx.restore();
  }

  if (showSignals) {
    ctx.save();
    ctx.font = `600 11px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < visLength; i += 1) {
      const gi = startIndex + i;
      const z = data.zlma[gi];
      if (z == null) continue;
      const x = chartLeft + i * totalSp + candleW / 2;
      const y = getY(z);
      if (data.signalUp[gi]) {
        ctx.fillStyle = upColor;
        ctx.beginPath();
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x, y + 4);
        ctx.lineTo(x - 4, y);
        ctx.closePath();
        ctx.fill();
      } else if (data.signalDn[gi]) {
        ctx.fillStyle = downColor;
        ctx.beginPath();
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x, y + 4);
        ctx.lineTo(x - 4, y);
        ctx.closePath();
        ctx.fill();
      }
      const upBreak = data.breakUp[gi];
      const downBreak = data.breakDown[gi];
      if (upBreak != null) {
        ctx.fillStyle = upColor;
        ctx.fillText('▲', x, getY(upBreak));
      }
      if (downBreak != null) {
        ctx.fillStyle = downColor;
        ctx.fillText('▼', x, getY(downBreak));
      }
    }
    ctx.restore();
  }
}
