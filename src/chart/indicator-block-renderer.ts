// @ts-nocheck
import { INDICATOR_CATALOG } from '../catalog/indicators';
import { toRgba } from './color-utils';
import { getMainAxisStepByRange } from './axis-utils';
import { drawZeroLagOverlays } from './indicator-render-engine';

export function renderIndicatorBlocks(this: any, params: any): void {
  const {
    ctx,
    ind,
    indicatorLayerOn,
    maSeries,
    emaSeries,
    maS,
    maL,
    ma60,
    ma120,
    ma200,
    bbSeries,
    vwapD,
    zeroLagMaTrendLevelsD,
    zeroLagStates,
    supertrendD,
    statisticalTrailingStopD,
    envD,
    rsiD,
    dmiD,
    macdD,
    stFD,
    stSD,
    cciD,
    obvD,
    obvSignal9,
    line,
    showLine,
    chartLeft,
    effectiveChartLeft = chartLeft,
    chartRight,
    totalSp,
    candleW,
    getY,
    visData,
    displayData,
    R,
    mainH,
    fontStack,
    vMax,
    vScaleMax,
    volH,
    volTop,
    chartW,
    visRawData,
    panels,
    panelTops,
    plotHeight,
    hiddenPanels,
    subAxisStart,
    geometry,
    width,
    subChartW,
    subChartRight,
    subLine,
    subHorizontalLine,
    getSubPlotBounds,
    formatKUnit,
    formatWithComma,
    chartTextSecondary,
  } = params;    // 6) 메인 패널 지표선
    maSeries.forEach((maLine, index) => {
      if (!showLine(maLine.id)) return;
      const palette = ['#f7931a', '#2962ff', '#4caf50', '#9c27b0', '#ff5722', '#00bcd4', '#ffc107', '#e91e63'];
      const s = this.resolveStyle(maLine.id, palette[index % palette.length]);
      line(maLine.data, s.color, s.width, s.dash);
    });
    emaSeries.forEach((emaLine, index) => {
      if (!showLine(emaLine.id)) return;
      const palette = ['#ff9800', '#00b0ff', '#7cb342', '#ab47bc', '#ff7043', '#26c6da', '#ffd54f', '#ec407a'];
      const s = this.resolveStyle(emaLine.id, palette[index % palette.length]);
      line(emaLine.data, s.color, s.width, s.dash);
    });
    if (indicatorLayerOn && ind.maShort.show && showLine('maShort')) {
      const s = this.resolveStyle('maShort', '#f7931a');
      line(maS, s.color, s.width, s.dash);
    }
    if (indicatorLayerOn && ind.maLong.show && showLine('maLong')) {
      const s = this.resolveStyle('maLong', '#2962ff');
      line(maL, s.color, s.width, s.dash);
    }
    if (indicatorLayerOn && ind.ma60.show && showLine('ma60')) {
      const s = this.resolveStyle('ma60', '#4caf50');
      line(ma60, s.color, s.width, s.dash);
    }
    if (indicatorLayerOn && ind.ma120.show && showLine('ma120')) {
      const s = this.resolveStyle('ma120', '#9c27b0');
      line(ma120, s.color, s.width, s.dash);
    }
    if (indicatorLayerOn && ind.ma200.show && showLine('ma200')) {
      const s = this.resolveStyle('ma200', '#ff5722');
      line(ma200, s.color, s.width, s.dash);
    }
    bbSeries.forEach((bbLine, index) => {
      const palette = ['100,149,237', '255,193,7', '38,166,154', '239,83,80', '156,39,176'];
      const rgb = palette[index % palette.length];
      const upKey = `${bbLine.id}Upper`;
      const midKey = `${bbLine.id}Middle`;
      const loKey = `${bbLine.id}Lower`;
      const up = this.resolveStyle(upKey, `rgba(${rgb},0.8)`, 1);
      const mid = this.resolveStyle(midKey, `rgba(${rgb},0.5)`, 1, [4, 4]);
      const lo = this.resolveStyle(loKey, `rgba(${rgb},0.8)`, 1);
      if (showLine(upKey)) line(bbLine.data.upper, up.color, up.width, up.dash);
      if (showLine(midKey)) line(bbLine.data.middle, mid.color, mid.width, mid.dash);
      if (showLine(loKey)) line(bbLine.data.lower, lo.color, lo.width, lo.dash);
    });
    if (indicatorLayerOn && ind.vwap.show && showLine('vwap')) {
      const s = this.resolveStyle('vwap', '#ff9800');
      line(vwapD, s.color, s.width, s.dash);
    }
    if (indicatorLayerOn && ind.zeroLagMaTrendLevels.show) {
      const upColor = String(ind.zeroLagMaTrendLevels.upColor || '#30d453');
      const downColor = String(ind.zeroLagMaTrendLevels.downColor || '#4043f1');
      const zlmaStyle = this.resolveStyle('zeroLagMaTrendLevelsZlma', upColor, 1);
      const emaStyle = this.resolveStyle('zeroLagMaTrendLevelsEma', downColor, 1);
      const levelStyle = this.resolveStyle('zeroLagMaTrendLevelsLevel', upColor, 1);
      drawZeroLagOverlays({
        ctx,
        data: zeroLagMaTrendLevelsD,
        states: zeroLagStates,
        startIndex: this.startIndex,
        visLength: visData.length,
        chartLeft,
        chartRight,
        totalSp,
        candleW,
        getY,
        upColor,
        downColor,
        fontStack: fontStack,
        showZlma: showLine('zeroLagMaTrendLevelsZlma'),
        showEma: showLine('zeroLagMaTrendLevelsEma'),
        showLevels: showLine('zeroLagMaTrendLevelsLevel') && ind.zeroLagMaTrendLevels.showLevels,
        showSignals: showLine('zeroLagMaTrendLevelsSignal'),
        zlmaStyle: { width: zlmaStyle.width, dash: zlmaStyle.dash },
        emaStyle: { width: emaStyle.width, dash: emaStyle.dash },
        levelStyle: { width: levelStyle.width, dash: levelStyle.dash },
        signalColor: upColor,
      });
    }
    if (indicatorLayerOn && ind.supertrend.show) {
      const upStyle = this.resolveStyle('supertrendUp', '#22ab94', 1.7);
      const downStyle = this.resolveStyle('supertrendDown', '#f23645', 1.7);
      const upBgEnabled = ind.supertrend.upBgEnabled !== false;
      const downBgEnabled = ind.supertrend.downBgEnabled !== false;
      const upBgColor = ind.supertrend.upBgColor || 'rgba(34,171,148,0.18)';
      const downBgColor = ind.supertrend.downBgColor || 'rgba(242,54,69,0.18)';
      const upLine: (number | null)[] = new Array(this.data.length).fill(null);
      const downLine: (number | null)[] = new Array(this.data.length).fill(null);
      if (upBgEnabled || downBgEnabled) {
        ctx.save();
        for (let i = 0; i < visData.length; i += 1) {
          const gi = this.startIndex + i;
          const v = supertrendD.line[gi];
          if (v == null) continue;
          const dir = supertrendD.direction[gi] ?? 1;
          const candle = displayData[gi];
          if (!candle) continue;
          const centerPrice = (candle.open + candle.close) / 2;
          const yLine = getY(v);
          const yCenter = getY(centerPrice);
          const yTop = Math.min(yLine, yCenter);
          const h = Math.max(1, Math.abs(yCenter - yLine));
          if (dir < 0 && upBgEnabled) {
            ctx.fillStyle = upBgColor;
            ctx.fillRect(effectiveChartLeft + i * totalSp, yTop, Math.max(1, totalSp), h);
          } else if (dir >= 0 && downBgEnabled) {
            ctx.fillStyle = downBgColor;
            ctx.fillRect(effectiveChartLeft + i * totalSp, yTop, Math.max(1, totalSp), h);
          }
        }
        ctx.restore();
      }
      for (let i = 0; i < this.data.length; i += 1) {
        const v = supertrendD.line[i];
        if (v == null) continue;
        if ((supertrendD.direction[i] ?? 1) < 0) upLine[i] = v;
        else downLine[i] = v;
      }
      if (showLine('supertrendUp')) line(upLine, upStyle.color, upStyle.width, upStyle.dash);
      if (showLine('supertrendDown')) line(downLine, downStyle.color, downStyle.width, downStyle.dash);
    }
    if (indicatorLayerOn && ind.statisticalTrailingStop.show) {
      const bullStyle = this.resolveStyle('statisticalTrailingStopBull', '#22ab94', 1.7);
      const bearStyle = this.resolveStyle('statisticalTrailingStopBear', '#f23645', 1.7);
      const bullishFillColor = String(ind.statisticalTrailingStop.bullishColor || 'rgba(8,153,129,0.5)');
      const bearishFillColor = String(ind.statisticalTrailingStop.bearishColor || 'rgba(242,54,69,0.5)');
      const BEARISH = 0;
      const BULLISH = 1;
      const bullLine: (number | null)[] = new Array(this.data.length).fill(null);
      const bearLine: (number | null)[] = new Array(this.data.length).fill(null);
      for (let i = 0; i < this.data.length; i += 1) {
        const v = statisticalTrailingStopD.level[i];
        if (v == null) continue;
        if ((statisticalTrailingStopD.bias[i] ?? BEARISH) === BULLISH) bullLine[i] = v;
        else bearLine[i] = v;
      }
      ctx.save();
      for (let i = 0; i < visData.length; i += 1) {
        const gi = this.startIndex + i;
        const trail = statisticalTrailingStopD.level[gi];
        const anch = statisticalTrailingStopD.anchor[gi];
        const b = statisticalTrailingStopD.bias[gi];
        if (trail == null || anch == null || b == null) continue;
        if (b === BEARISH && trail <= anch) {
          ctx.fillStyle = bearishFillColor;
        } else if (b === BULLISH && trail >= anch) {
          ctx.fillStyle = bullishFillColor;
        } else {
          continue;
        }
        const yTop = Math.min(getY(trail), getY(anch));
        const h = Math.max(1, Math.abs(getY(anch) - getY(trail)));
        ctx.fillRect(effectiveChartLeft + i * totalSp, yTop, Math.max(1, totalSp), h);
      }
      ctx.restore();
      if (showLine('statisticalTrailingStopBull')) line(bullLine, bullStyle.color, bullStyle.width, bullStyle.dash);
      if (showLine('statisticalTrailingStopBear')) line(bearLine, bearStyle.color, bearStyle.width, bearStyle.dash);
      if (ind.statisticalTrailingStop.trailMarkEnabled !== false) {
        const markerStyle = String(ind.statisticalTrailingStop.trailMarkStyle || 'circle').toLowerCase();
        const markerLocation = String(ind.statisticalTrailingStop.trailMarkLocation || 'absolute').toLowerCase();
        const showPanelLabel = ind.statisticalTrailingStop.showPanelLabel === true;
        const markerSize = Math.max(4, 6 * Math.max(1, this.pixelRatio / 1.5));
        const markerOffset = Math.max(8, 10 * Math.max(1, this.pixelRatio / 1.5));
        const topY = R.top + markerOffset;
        const bottomY = Math.max(R.top + markerOffset, mainH - markerOffset);
        const getPanelLabelText = (index: number, biasValue: number): string => {
          const safeIndex = Math.max(0, Math.min(statisticalTrailingStopD.level.length - 1, index));
          const lv = statisticalTrailingStopD.level[safeIndex];
          const anc = statisticalTrailingStopD.anchor[safeIndex];
          const ext = statisticalTrailingStopD.extreme[safeIndex];
          if (lv == null || anc == null || ext == null) return 'STS';
          const priceDelta = biasValue === BEARISH ? anc - lv : lv - anc;
          const denom = biasValue === BEARISH ? (anc - ext) : (ext - anc);
          const deltaText = Number.isFinite(priceDelta) ? priceDelta.toFixed(2) : '0.00';
          if (!(priceDelta > 0) || !Number.isFinite(denom) || denom === 0) return deltaText;
          const pct = (priceDelta * 100) / denom;
          if (!Number.isFinite(pct)) return deltaText;
          return `${deltaText}\n${pct.toFixed(2)}%`;
        };
        const drawMarker = (x: number, y: number, color: string, biasValue: number, panelText: string) => {
          const r = markerSize;
          const up = biasValue === BULLISH;
          ctx.save();
          ctx.strokeStyle = color;
          ctx.fillStyle = color;
          ctx.lineWidth = 1.6;
          switch (markerStyle) {
            case 'arrowup':
              ctx.beginPath();
              ctx.moveTo(x, y - r);
              ctx.lineTo(x - r * 0.75, y + r * 0.2);
              ctx.lineTo(x - r * 0.2, y + r * 0.2);
              ctx.lineTo(x - r * 0.2, y + r);
              ctx.lineTo(x + r * 0.2, y + r);
              ctx.lineTo(x + r * 0.2, y + r * 0.2);
              ctx.lineTo(x + r * 0.75, y + r * 0.2);
              ctx.closePath();
              ctx.fill();
              break;
            case 'arrowdown':
              ctx.beginPath();
              ctx.moveTo(x, y + r);
              ctx.lineTo(x - r * 0.75, y - r * 0.2);
              ctx.lineTo(x - r * 0.2, y - r * 0.2);
              ctx.lineTo(x - r * 0.2, y - r);
              ctx.lineTo(x + r * 0.2, y - r);
              ctx.lineTo(x + r * 0.2, y - r * 0.2);
              ctx.lineTo(x + r * 0.75, y - r * 0.2);
              ctx.closePath();
              ctx.fill();
              break;
            case 'cross':
              ctx.beginPath();
              ctx.moveTo(x - r, y - r);
              ctx.lineTo(x + r, y + r);
              ctx.moveTo(x - r, y + r);
              ctx.lineTo(x + r, y - r);
              ctx.stroke();
              break;
            case 'diamond':
              ctx.beginPath();
              ctx.moveTo(x, y - r);
              ctx.lineTo(x + r, y);
              ctx.lineTo(x, y + r);
              ctx.lineTo(x - r, y);
              ctx.closePath();
              ctx.fill();
              break;
            case 'flag':
              ctx.beginPath();
              ctx.moveTo(x - r * 0.85, y + r);
              ctx.lineTo(x - r * 0.85, y - r);
              ctx.stroke();
              ctx.beginPath();
              if (up) {
                ctx.moveTo(x - r * 0.8, y - r * 0.8);
                ctx.lineTo(x + r * 0.95, y - r * 0.35);
                ctx.lineTo(x - r * 0.8, y + r * 0.1);
              } else {
                ctx.moveTo(x - r * 0.8, y + r * 0.8);
                ctx.lineTo(x + r * 0.95, y + r * 0.35);
                ctx.lineTo(x - r * 0.8, y - r * 0.1);
              }
              ctx.closePath();
              ctx.fill();
              break;
            case 'labeldown':
            case 'labelup':
              {
                const down = markerStyle === 'labeldown';
                const lines = panelText.split('\n');
                const hasTwoLines = lines.length > 1;
                const boxW = hasTwoLines ? r * 5.1 : r * 3.8;
                const boxH = hasTwoLines ? r * 3.4 : r * 2.1;
                const bx = x - boxW / 2;
                const by = down ? y - boxH - r * 0.45 : y + r * 0.45;
                ctx.fillStyle = toRgba(color, 0.16);
                ctx.strokeStyle = color;
                ctx.beginPath();
                ctx.roundRect(bx, by, boxW, boxH, 4);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = color;
                ctx.font = `500 ${Math.max(12, Math.round(r * 1.35))}px ${fontStack}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const lineGap = Math.max(14, Math.round(r * 1.45));
                const textCenterY = by + boxH / 2;
                if (hasTwoLines) {
                  ctx.fillText(lines[0], x, textCenterY - lineGap * 0.4);
                  ctx.fillText(lines[1], x, textCenterY + lineGap * 0.4);
                } else {
                  ctx.fillText(lines[0] || 'STS', x, textCenterY);
                }
                ctx.beginPath();
                if (down) {
                  ctx.moveTo(x, by + boxH + r * 0.45);
                  ctx.lineTo(x - r * 0.35, by + boxH);
                  ctx.lineTo(x + r * 0.35, by + boxH);
                } else {
                  ctx.moveTo(x, by - r * 0.45);
                  ctx.lineTo(x - r * 0.35, by);
                  ctx.lineTo(x + r * 0.35, by);
                }
                ctx.closePath();
                ctx.fill();
              }
              break;
            case 'square':
              ctx.fillRect(x - r, y - r, r * 2, r * 2);
              break;
            case 'triangledown':
              ctx.beginPath();
              ctx.moveTo(x, y + r);
              ctx.lineTo(x - r, y - r * 0.7);
              ctx.lineTo(x + r, y - r * 0.7);
              ctx.closePath();
              ctx.fill();
              break;
            case 'triangleup':
              ctx.beginPath();
              ctx.moveTo(x, y - r);
              ctx.lineTo(x - r, y + r * 0.7);
              ctx.lineTo(x + r, y + r * 0.7);
              ctx.closePath();
              ctx.fill();
              break;
            case 'circle':
            default:
              ctx.beginPath();
              ctx.arc(x, y, r, 0, Math.PI * 2);
              ctx.fill();
              break;
          }
          if (showPanelLabel && markerStyle !== 'labelup' && markerStyle !== 'labeldown') {
            ctx.fillStyle = color;
            ctx.font = `500 ${Math.max(12, Math.round(r * 1.42))}px ${fontStack}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const lines = panelText.split('\n');
            if (lines.length > 1) {
              ctx.fillText(lines[0], x, y + r + 10);
              ctx.fillText(lines[1], x, y + r + 26);
            } else {
              ctx.fillText(lines[0] || 'STS', x, y + r + 12);
            }
          }
          ctx.restore();
        };

        ctx.save();
        for (let i = 0; i < visData.length; i += 1) {
          const gi = this.startIndex + i;
          if (!statisticalTrailingStopD.newTrail[gi]) continue;
          const lv = statisticalTrailingStopD.level[gi];
          const b = statisticalTrailingStopD.bias[gi];
          const candle = displayData[gi];
          if (lv == null || b == null || !candle) continue;
          const cx = effectiveChartLeft + i * totalSp + candleW / 2;
          let cy = getY(lv);
          if (markerLocation === 'abovebar') cy = getY(candle.high) - markerOffset;
          else if (markerLocation === 'belowbar') cy = getY(candle.low) + markerOffset;
          else if (markerLocation === 'top') cy = topY;
          else if (markerLocation === 'bottom') cy = bottomY;
          cy = Math.max(R.top + 3, Math.min(mainH - 3, cy));
          const markerColor = b === BEARISH ? bearStyle.color : bullStyle.color;
          // On trail switch bars, use the previous trail snapshot for label text
          // to avoid showing only the freshly reset (often negative) new trail delta.
          const labelIndex = statisticalTrailingStopD.newTrail[gi] ? gi - 1 : gi;
          const labelBias = statisticalTrailingStopD.newTrail[gi]
            ? (statisticalTrailingStopD.bias[Math.max(0, gi - 1)] ?? b)
            : b;
          const panelText = getPanelLabelText(labelIndex, labelBias);
          drawMarker(cx, cy, markerColor, b, panelText);
        }
        ctx.restore();
      }
    }
    if (envD && ind.envelope.show) {
      const up = this.resolveStyle('envelopeUpper', 'rgba(255,200,50,0.8)', 1);
      const mid = this.resolveStyle('envelopeMiddle', 'rgba(255,200,50,0.4)', 1, [4, 4]);
      const lo = this.resolveStyle('envelopeLower', 'rgba(255,200,50,0.8)', 1);
      if (showLine('envelopeUpper')) line(envD.upper, up.color, up.width, up.dash);
      if (showLine('envelopeMiddle')) line(envD.mid, mid.color, mid.width, mid.dash);
      if (showLine('envelopeLower')) line(envD.lower, lo.color, lo.width, lo.dash);
    }
    ctx.restore();

    // 거래량 막대는 볼륨 패널 범위로 별도 클리핑해서 렌더.
    if (ind.volume.show && volH > 0 && showLine('volumeBars')) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(chartLeft, volTop, chartW, volH);
      ctx.clip();
      visData.forEach((c, i) => {
        const x = effectiveChartLeft + i * totalSp;
        const isUp = c.close >= c.open;
        const upColor = this.config.candleStyle?.upColor ?? '#22ab94';
        const downColor = this.config.candleStyle?.downColor ?? '#f23645';
        const rawVolume = Number(visRawData[i]?.volume ?? c.volume ?? 0);
        if (rawVolume <= 0) return;
        const vh = (rawVolume / vScaleMax) * (volH - 20);
        ctx.fillStyle = isUp ? toRgba(upColor, 0.35) : toRgba(downColor, 0.35);
        ctx.fillRect(
          Math.round(x),
          Math.round(volTop + volH - vh - 20),
          Math.max(1, Math.round(candleW)),
          Math.max(1, Math.round(vh)),
        );
      });
      ctx.restore();
    }

    // 7) 보조 패널 렌더
    const showCanvasPanelTitles = false;
    const subLabel = (text: string, top: number, color = chartTextSecondary) => {
      if (!showCanvasPanelTitles) return;
      ctx.save();
      ctx.fillStyle = color; ctx.font = `700 13px ${fontStack}`; ctx.textAlign = 'left';
      ctx.fillText(text, 8, top + 16);
      ctx.restore();
    };
    const drawPanelLegend = (title: string, top: number, items: Array<{ text: string; color: string; enabled?: boolean }>) => {
      if (!showCanvasPanelTitles) return;
      ctx.save();
      ctx.font = `700 13px ${fontStack}`;
      ctx.textAlign = 'left';
      let x = 8;
      const y = top + 16;
      ctx.fillStyle = chartTextSecondary;
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
    const getSubAxisSnapUnit = (lo: number, hi: number): 5 | 10 => {
      const range = Math.abs(hi - lo);
      return range >= 80 ? 10 : 5;
    };
    const snapSubAxisValue = (value: number, lo: number, hi: number): number => {
      const unit = getSubAxisSnapUnit(lo, hi);
      return Math.round(value / unit) * unit;
    };
    const subGrid = (
      vals: number[],
      top: number,
      pH: number,
      lo: number,
      hi: number,
      formatter?: (value: number) => string,
    ) => {
      const { plotTop, plotH } = getSubPlotBounds(top, pH);
      const rng = hi - lo || 1;
      ctx.save();
      ctx.strokeStyle = '#1e2230'; ctx.fillStyle = chartTextSecondary;
      ctx.font = `12px ${fontStack}`; ctx.textAlign = 'left';
      vals.forEach(v => {
        const snapped = snapSubAxisValue(v, lo, hi);
        const clamped = Math.min(hi, Math.max(lo, snapped));
        const y = plotTop + (hi - clamped) / rng * plotH;
        ctx.beginPath(); ctx.moveTo(chartLeft, y); ctx.lineTo(subChartRight, y); ctx.stroke();
        const axisTextX = subAxisStart + 4;
        ctx.fillText(formatter ? formatter(clamped) : formatWithComma(clamped, 0), axisTextX, y + 4);
      });
      ctx.restore();
    };
    const drawSubAxisValue = (value: number, top: number, pH: number, lo: number, hi: number, color: string, text?: string) => {
      const { plotTop, plotH } = getSubPlotBounds(top, pH);
      const rng = hi - lo || 1;
      const y = plotTop + (hi - value) / rng * plotH;
      const boxW = Math.max(40, Math.min(geometry.axisPad - 22, 56));
      const boxX = width - boxW - 2;
      const normalizedText = (() => {
        if (text == null) return snapSubAxisValue(value, lo, hi).toString();
        return String(text);
      })();
      ctx.save();
      ctx.fillStyle = toRgba(color, 0.28, 'rgba(96,125,139,0.28)');
      ctx.fillRect(boxX, y - 8, boxW, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = `12px ${fontStack}`;
      ctx.textAlign = 'center';
      ctx.fillText(normalizedText, boxX + boxW / 2, y + 3);
      ctx.restore();
    };
    const drawSubAlertLines = (panelId: string, top: number, pH: number, lo: number, hi: number) => {
      const alerts = this.subIndicatorAlerts.filter((a) => a.enabled && a.panelId === panelId);
      if (!alerts.length) return;
      const { plotTop, plotH } = getSubPlotBounds(top, pH);
      const rng = hi - lo || 1;
      ctx.save();
      ctx.lineWidth = 1;
      alerts.forEach((alert) => {
        const y = plotTop + (hi - alert.value) / rng * plotH;
        ctx.strokeStyle = toRgba(alert.color, 0.85, 'rgba(255,197,66,0.85)');
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(chartLeft, y);
        ctx.lineTo(subChartRight, y);
        ctx.stroke();
        this.subIndicatorAlertHitAreas.push({
          id: alert.id,
          panelId,
          x1: chartLeft,
          x2: subChartRight,
          y,
          panelTop: top,
          panelHeight: pH,
        });

      const labelText = panelId === 'volume' ? formatKUnit(alert.value, 2) : alert.value.toFixed(2);
        ctx.save();
        ctx.font = `12px ${fontStack}`;
        const boxW = Math.max(40, Math.min(geometry.axisPad - 22, Math.ceil(ctx.measureText(labelText).width) + 12));
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
    const getPanelTitle = (id: string): string => {
      if (id === 'volume') return 'Volume';
      if (id === 'rsi') return `RSI(${ind.rsi.period})`;
      if (id === 'dmi') return `DMI(${ind.dmi.period})`;
      if (id === 'macd') return `MACD(${ind.macd.fast},${ind.macd.slow},${ind.macd.signal})`;
      if (id === 'stochF') return `Stoch Fast(${ind.stochF.kPeriod},${ind.stochF.dPeriod})`;
      if (id === 'stochS') return `Stoch Slow(${ind.stochS.kPeriod},${ind.stochS.dPeriod})`;
      if (id === 'cci') return `CCI(${ind.cci.period})`;
      if (id === 'obv') return 'OBV';
      return INDICATOR_CATALOG.find(item => item.id === id)?.label ?? id.toUpperCase();
    };

    for (const id of panels) {
      const top = panelTops[id], pH = plotHeight * this.getPanelRatio(id);
      if (hiddenPanels.has(id)) {
        subLabel(getPanelTitle(id), top);
        ctx.save();
        ctx.strokeStyle = '#2a2e3e'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(chartLeft, top); ctx.lineTo(chartRight, top); ctx.stroke();
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(-1, top - 1, width + 2, pH + 2);
      ctx.clip();

      // Keep sub-indicator Y-axis area fixed on the right side in both modes.
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(subAxisStart, top, geometry.axisPad, pH);
      ctx.strokeStyle = '#2a3142';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(subAxisStart - 0.5, top);
      ctx.lineTo(subAxisStart - 0.5, top + pH);
      ctx.stroke();
      ctx.restore();

      if (id === 'volume') {
        subLabel('Volume', top);
        subGrid([vMax, vMax / 2], top, pH, 0, vScaleMax, (value) => formatKUnit(value, 2));
        drawSubAlertLines('volume', top, pH, 0, vScaleMax);
      }
      if (id === 'rsi') {
        const lastRsi = (rsiD.filter(v => v != null).slice(-1)[0] ?? 0) as number;
        const s = this.resolveStyle('rsi', '#ffeb3b');
        drawPanelLegend(`RSI(${ind.rsi.period})`, top, [{ text: `RSI ${lastRsi.toFixed(1)}`, color: s.color, enabled: showLine('rsi') }]);
        subGrid([70, 50, 30], top, pH, 0, 100);
        ctx.save();
        ctx.beginPath();
        ctx.rect(chartLeft, top, subChartW, pH);
        ctx.clip();
        const sy = (v: number) => top + (100 - v) / 100 * (pH - 20) + 20;
        ctx.fillStyle = 'rgba(242,54,69,0.06)';
        ctx.fillRect(chartLeft, sy(100), subChartW, sy(70) - sy(100));
        ctx.fillStyle = 'rgba(34,171,148,0.06)';
        ctx.fillRect(chartLeft, sy(30), subChartW, sy(0) - sy(30));
        ctx.restore();
        if (showLine('rsi')) subLine(rsiD, s.color, s.width, top, pH, 0, 100, s.dash);
        if (showLine('rsiBaseline')) {
          const b = this.resolveStyle('rsiBaseline', '#999999', 1, [4, 4]);
          subHorizontalLine(50, b.color, b.width, top, pH, 0, 100, b.dash);
        }
        drawSubAlertLines('rsi', top, pH, 0, 100);
        if (showLine('rsi')) drawSubAxisValue(lastRsi, top, pH, 0, 100, s.color, lastRsi.toFixed(2));
      }
      if (id === 'dmi') {
        const plus = this.resolveStyle('dmiPlus', '#22ab94');
        const minus = this.resolveStyle('dmiMinus', '#f23645');
        const adx = this.resolveStyle('dmiAdx', '#ffffff', 2);
        const dmiTopThresholdRaw = Number((ind.dmi as any).topThreshold);
        const dmiBottomThresholdRaw = Number((ind.dmi as any).bottomThreshold);
        const dmiTopThreshold = Number.isFinite(dmiTopThresholdRaw) ? dmiTopThresholdRaw : 30;
        const dmiBottomThreshold = Number.isFinite(dmiBottomThresholdRaw) ? dmiBottomThresholdRaw : 20;
        const dmiAxisMode = (ind.dmi as any).axisMode === 'fixed' ? 'fixed' : 'auto';
        let dmiLo = 0;
        let dmiHi = 60;
        if (dmiAxisMode === 'auto') {
          const dmiVisibleValues = [
            ...dmiD.plusDI.slice(this.startIndex, this.endIndex).filter((v): v is number => v != null && Number.isFinite(v)),
            ...dmiD.minusDI.slice(this.startIndex, this.endIndex).filter((v): v is number => v != null && Number.isFinite(v)),
            ...dmiD.adx.slice(this.startIndex, this.endIndex).filter((v): v is number => v != null && Number.isFinite(v)),
          ];
          let dmiLoTarget = dmiVisibleValues.length ? Math.min(...dmiVisibleValues) : 0;
          let dmiHiTarget = dmiVisibleValues.length ? Math.max(...dmiVisibleValues) : 60;
          const dmiPad = Math.max(4, (dmiHiTarget - dmiLoTarget) * 0.12);
          dmiLoTarget = Math.max(0, dmiLoTarget - dmiPad);
          dmiHiTarget = Math.min(100, dmiHiTarget + dmiPad);
          dmiLoTarget = Math.min(dmiLoTarget, 23);
          dmiHiTarget = Math.max(dmiHiTarget, 27);
          if (dmiHiTarget - dmiLoTarget < 20) {
            const center = (dmiHiTarget + dmiLoTarget) / 2;
            dmiLoTarget = Math.max(0, center - 10);
            dmiHiTarget = Math.min(100, center + 10);
          }
          if (!this.dmiScaleRange) {
            this.dmiScaleRange = { lo: dmiLoTarget, hi: dmiHiTarget };
          } else {
            const smoothing = 0.22;
            this.dmiScaleRange.lo += (dmiLoTarget - this.dmiScaleRange.lo) * smoothing;
            this.dmiScaleRange.hi += (dmiHiTarget - this.dmiScaleRange.hi) * smoothing;
          }
          dmiLo = this.dmiScaleRange.lo;
          dmiHi = this.dmiScaleRange.hi;
          if (dmiHi - dmiLo < 8) {
            const center = (dmiHi + dmiLo) / 2;
            dmiLo = Math.max(0, center - 4);
            dmiHi = Math.min(100, center + 4);
          }
          this.dmiScaleRange = { lo: dmiLo, hi: dmiHi };
        } else {
          this.dmiScaleRange = null;
        }
        const dmiSnapUnit = getSubAxisSnapUnit(dmiLo, dmiHi);
        dmiLo = Math.max(0, Math.floor(dmiLo / dmiSnapUnit) * dmiSnapUnit);
        dmiHi = Math.min(100, Math.ceil(dmiHi / dmiSnapUnit) * dmiSnapUnit);
        if (dmiHi - dmiLo < dmiSnapUnit * 2) {
          dmiHi = Math.min(100, dmiLo + dmiSnapUnit * 2);
        }
        const dmiMid = (dmiLo + dmiHi) / 2;
        const topLine = Math.max(dmiLo, Math.min(dmiHi, dmiTopThreshold));
        const bottomLine = Math.max(dmiLo, Math.min(dmiHi, dmiBottomThreshold));
        drawPanelLegend(`DMI(${ind.dmi.period})`, top, [
          { text: '+DI', color: plus.color, enabled: showLine('dmiPlus') },
          { text: '-DI', color: minus.color, enabled: showLine('dmiMinus') },
          { text: 'ADX', color: adx.color, enabled: showLine('dmiAdx') },
        ]);
        subGrid([dmiHi, dmiMid, dmiLo, topLine, bottomLine], top, pH, dmiLo, dmiHi);
        {
          const { plotTop, plotH } = getSubPlotBounds(top, pH);
          const dmiRange = dmiHi - dmiLo || 1;
          const yTop = plotTop + (dmiHi - topLine) / dmiRange * plotH;
          const yBottom = plotTop + (dmiHi - bottomLine) / dmiRange * plotH;
          const fillY = Math.min(yTop, yBottom);
          const fillH = Math.max(1, Math.abs(yBottom - yTop));
          ctx.save();
          ctx.beginPath();
          ctx.rect(chartLeft, top, subChartW, pH);
          ctx.clip();
          ctx.fillStyle = 'rgba(83, 109, 254, 0.12)';
          ctx.fillRect(chartLeft, fillY, subChartW, fillH);
          ctx.restore();
        }
        subHorizontalLine(topLine, '#5f6778', 1, top, pH, dmiLo, dmiHi, [4, 4]);
        subHorizontalLine(bottomLine, '#5f6778', 1, top, pH, dmiLo, dmiHi, [4, 4]);
        if (showLine('dmiPlus')) subLine(dmiD.plusDI, plus.color, plus.width, top, pH, dmiLo, dmiHi, plus.dash);
        if (showLine('dmiMinus')) subLine(dmiD.minusDI, minus.color, minus.width, top, pH, dmiLo, dmiHi, minus.dash);
        if (showLine('dmiAdx')) subLine(dmiD.adx, adx.color, adx.width, top, pH, dmiLo, dmiHi, adx.dash);
        drawSubAlertLines('dmi', top, pH, dmiLo, dmiHi);
        const lastAdx = (dmiD.adx.filter(v => v != null).slice(-1)[0] ?? 0) as number;
        if (showLine('dmiAdx')) drawSubAxisValue(lastAdx, top, pH, dmiLo, dmiHi, adx.color, lastAdx.toFixed(2));
      }
      if (id === 'macd') {
        const macdVals = [
          ...macdD.hist.slice(this.startIndex, this.endIndex).filter(v => v != null) as number[],
          ...macdD.macdLine.slice(this.startIndex, this.endIndex).filter(v => v != null) as number[],
          ...macdD.sigLine.slice(this.startIndex, this.endIndex).filter(v => v != null) as number[],
        ];
        const mMaxBase = Math.max(...macdVals.map(Math.abs), 0.001);
        const mMax = mMaxBase * 1.4;
        const macdLineStyle = this.resolveStyle('macdLine', '#2962ff');
        const sigLineStyle = this.resolveStyle('macdSignal', '#f23645');
        drawPanelLegend(`MACD(${ind.macd.fast},${ind.macd.slow},${ind.macd.signal})`, top, [
          { text: 'MACD', color: macdLineStyle.color, enabled: showLine('macdLine') },
          { text: 'Signal', color: sigLineStyle.color, enabled: showLine('macdSignal') },
        ]);
        const sy = (v: number) => top + (mMax - v) / (2 * mMax) * (pH - 20) + 20;
        ctx.save();
        ctx.beginPath();
        ctx.rect(chartLeft, top, subChartW, pH);
        ctx.clip();
        visData.forEach((_, i) => {
          const v = macdD.hist[this.startIndex + i];
          if (v == null) return;
          const zy = sy(0), by = sy(v);
          ctx.fillStyle = v >= 0 ? 'rgba(34,171,148,0.6)' : 'rgba(242,54,69,0.6)';
          ctx.fillRect(effectiveChartLeft + i * totalSp, Math.min(by, zy), candleW, Math.max(Math.abs(by - zy), 1));
        });
        ctx.restore();
        if (showLine('macdLine')) subLine(macdD.macdLine, macdLineStyle.color, macdLineStyle.width, top, pH, -mMax, mMax, macdLineStyle.dash);
        if (showLine('macdBaseline')) {
          const b = this.resolveStyle('macdBaseline', '#999999', 1, [4, 4]);
          subHorizontalLine(0, b.color, b.width, top, pH, -mMax, mMax, b.dash);
        }
        if (showLine('macdSignal')) subLine(macdD.sigLine, sigLineStyle.color, sigLineStyle.width, top, pH, -mMax, mMax, sigLineStyle.dash);
        drawSubAlertLines('macd', top, pH, -mMax, mMax);
        const lastMacd = (macdD.macdLine.filter(v => v != null).slice(-1)[0] ?? 0) as number;
        if (showLine('macdLine')) drawSubAxisValue(lastMacd, top, pH, -mMax, mMax, macdLineStyle.color, lastMacd.toFixed(2));
      }
      if (id === 'stochF' && stFD) {
        const k = this.resolveStyle('stochFastK', '#22ab94');
        const d = this.resolveStyle('stochFastD', '#f23645');
        drawPanelLegend(`Stoch Fast(${ind.stochF.kPeriod},${ind.stochF.dPeriod})`, top, [
          { text: '%K', color: k.color, enabled: showLine('stochFastK') },
          { text: '%D', color: d.color, enabled: showLine('stochFastD') },
        ]);
        subGrid([80, 50, 20], top, pH, 0, 100);
        if (showLine('stochFastK')) subLine(stFD.k, k.color, k.width, top, pH, 0, 100, k.dash);
        if (showLine('stochFastBaseline')) {
          const b = this.resolveStyle('stochFastBaseline', '#999999', 1, [4, 4]);
          subHorizontalLine(50, b.color, b.width, top, pH, 0, 100, b.dash);
        }
        if (showLine('stochFastD')) subLine(stFD.d, d.color, d.width, top, pH, 0, 100, d.dash);
        drawSubAlertLines('stochF', top, pH, 0, 100);
        const lastK = (stFD.k.filter(v => v != null).slice(-1)[0] ?? 0) as number;
        if (showLine('stochFastK')) drawSubAxisValue(lastK, top, pH, 0, 100, k.color, lastK.toFixed(2));
      }
      if (id === 'stochS' && stSD) {
        const k = this.resolveStyle('stochSlowK', '#22ab94');
        const d = this.resolveStyle('stochSlowD', '#f23645');
        drawPanelLegend(`Stoch Slow(${ind.stochS.kPeriod},${ind.stochS.dPeriod})`, top, [
          { text: '%K', color: k.color, enabled: showLine('stochSlowK') },
          { text: '%D', color: d.color, enabled: showLine('stochSlowD') },
        ]);
        subGrid([80, 50, 20], top, pH, 0, 100);
        if (showLine('stochSlowK')) subLine(stSD.k, k.color, k.width, top, pH, 0, 100, k.dash);
        if (showLine('stochSlowBaseline')) {
          const b = this.resolveStyle('stochSlowBaseline', '#999999', 1, [4, 4]);
          subHorizontalLine(50, b.color, b.width, top, pH, 0, 100, b.dash);
        }
        if (showLine('stochSlowD')) subLine(stSD.d, d.color, d.width, top, pH, 0, 100, d.dash);
        drawSubAlertLines('stochS', top, pH, 0, 100);
        const lastK = (stSD.k.filter(v => v != null).slice(-1)[0] ?? 0) as number;
        if (showLine('stochSlowK')) drawSubAxisValue(lastK, top, pH, 0, 100, k.color, lastK.toFixed(2));
      }
      if (id === 'cci') {
        const vis = cciD.slice(this.startIndex, this.endIndex).filter(v => v != null) as number[];
        const cMax = Math.max(...vis.map(Math.abs), 100);
        drawPanelLegend(`CCI(${ind.cci.period})`, top, [{ text: 'CCI', color: this.resolveStyle('cci', '#22ab94').color, enabled: showLine('cci') }]);
        subGrid([100, 0, -100], top, pH, -cMax, cMax);
        const s = this.resolveStyle('cci', '#22ab94');
        if (showLine('cci')) subLine(cciD, s.color, s.width, top, pH, -cMax, cMax, s.dash);
        if (showLine('cciBaseline')) {
          const b = this.resolveStyle('cciBaseline', '#999999', 1, [4, 4]);
          subHorizontalLine(0, b.color, b.width, top, pH, -cMax, cMax, b.dash);
        }
        drawSubAlertLines('cci', top, pH, -cMax, cMax);
        const lastCci = (cciD.filter(v => v != null).slice(-1)[0] ?? 0) as number;
        if (showLine('cci')) drawSubAxisValue(lastCci, top, pH, -cMax, cMax, s.color, lastCci.toFixed(2));
      }
      if (id === 'obv') {
        const rangeValues = [
          ...obvD.slice(this.startIndex, this.endIndex).filter(v => v != null) as number[],
          ...obvSignal9.slice(this.startIndex, this.endIndex).filter(v => v != null) as number[],
        ];
        let lo = Math.min(...rangeValues, 0);
        let hi = Math.max(...rangeValues, 1);
        if (lo === hi) { hi = lo + 1; }
        const pad = Math.max((hi - lo) * 0.18, 1);
        lo -= pad; hi += pad;
        drawPanelLegend('OBV', top, [
          { text: 'OBV', color: this.resolveStyle('obv', '#22ab94').color, enabled: showLine('obv') },
          { text: 'Signal 9', color: this.resolveStyle('obvSignal9', '#ffc107').color, enabled: showLine('obvSignal9') },
        ]);
        const s = this.resolveStyle('obv', '#22ab94');
        if (showLine('obv')) subLine(obvD, s.color, s.width, top, pH, lo, hi, s.dash);
        if (showLine('obvSignal9')) {
          const sig = this.resolveStyle('obvSignal9', '#ffc107', 1.5, [4, 2]);
          subLine(obvSignal9, sig.color, sig.width, top, pH, lo, hi, sig.dash);
        }
        if (showLine('obvBaseline') && lo <= 0 && hi >= 0) {
          const b = this.resolveStyle('obvBaseline', '#999999', 1, [4, 4]);
          subHorizontalLine(0, b.color, b.width, top, pH, lo, hi, b.dash);
        }
        drawSubAlertLines('obv', top, pH, lo, hi);
        const lastObv = obvD[obvD.length - 1] ?? 0;
        if (showLine('obv')) drawSubAxisValue(lastObv, top, pH, lo, hi, s.color, lastObv.toFixed(2));
      }
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = '#2a2e3e'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(chartLeft, top); ctx.lineTo(chartRight, top); ctx.stroke();
      ctx.restore();
    }

}

