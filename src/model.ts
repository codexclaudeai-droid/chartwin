import type { CandleData, ChartConfig } from './types';

export class ChartModel {
  public data: CandleData[] = [];
  public startIndex = 0;
  public endIndex = 0;
  public config: ChartConfig;

  constructor(config: ChartConfig) {
    this.config = config;
  }

  public setData(data: CandleData[]): void {
    this.data = data;
    this.endIndex = data.length;
    this.startIndex = Math.max(0, data.length - 50);
  }

  public updateLastCandle(tick: Partial<CandleData>): void {
    if (!this.data.length) return;
    const last = this.data[this.data.length - 1];
    this.data[this.data.length - 1] = {
      ...last,
      ...tick,
    };
  }

  public calculateMA(period: number): Array<number | null> {
    const result: Array<number | null> = [];
    for (let i = 0; i < this.data.length; i += 1) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }
      let sum = 0;
      for (let k = 0; k < period; k += 1) {
        sum += this.data[i - k].close;
      }
      result.push(sum / period);
    }
    return result;
  }

  public calculateRSI(period: number): Array<number | null> {
    const rsiData: Array<number | null> = [];
    let gains = 0;
    let losses = 0;

    for (let i = 0; i < this.data.length; i += 1) {
      if (i === 0) {
        rsiData.push(null);
        continue;
      }

      const diff = this.data[i].close - this.data[i - 1].close;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;

      if (i < period) {
        gains += gain;
        losses += loss;
        rsiData.push(null);
        if (i === period - 1) {
          gains /= period;
          losses /= period;
        }
      } else {
        gains = (gains * (period - 1) + gain) / period;
        losses = (losses * (period - 1) + loss) / period;
        const rs = losses === 0 ? 100 : gains / losses;
        rsiData.push(100 - 100 / (1 + rs));
      }
    }

    return rsiData;
  }

  public calculateBB(period: number, stdDevMult: number): {
    middle: Array<number | null>;
    upper: Array<number | null>;
    lower: Array<number | null>;
  } {
    const middle = this.calculateMA(period);
    const upper: Array<number | null> = [];
    const lower: Array<number | null> = [];

    for (let i = 0; i < this.data.length; i += 1) {
      if (i < period - 1) {
        upper.push(null);
        lower.push(null);
        continue;
      }

      const mean = middle[i] as number;
      let variance = 0;
      for (let k = 0; k < period; k += 1) {
        variance += Math.pow(this.data[i - k].close - mean, 2);
      }
      const stdDev = Math.sqrt(variance / period);
      upper.push(mean + stdDev * stdDevMult);
      lower.push(mean - stdDev * stdDevMult);
    }

    return { middle, upper, lower };
  }

  public calculateDMI(period: number): {
    plusDI: Array<number | null>;
    minusDI: Array<number | null>;
    adx: Array<number | null>;
  } {
    const plusDI: Array<number | null> = [];
    const minusDI: Array<number | null> = [];
    const adx: Array<number | null> = [];

    let sTR = 0;
    let sPlusDM = 0;
    let sMinusDM = 0;
    let adxSum = 0;
    let adxCount = 0;
    let prevADX: number | null = null;

    for (let i = 0; i < this.data.length; i += 1) {
      if (i === 0) {
        plusDI.push(null);
        minusDI.push(null);
        adx.push(null);
        continue;
      }

      const h = this.data[i].high;
      const l = this.data[i].low;
      const ph = this.data[i - 1].high;
      const pl = this.data[i - 1].low;
      const pc = this.data[i - 1].close;

      const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      const up = h - ph;
      const down = pl - l;
      const pDM = up > down && up > 0 ? up : 0;
      const mDM = down > up && down > 0 ? down : 0;

      sTR += tr;
      sPlusDM += pDM;
      sMinusDM += mDM;

      if (i < period * 2) {
        plusDI.push(null);
        minusDI.push(null);
        adx.push(null);
        continue;
      }

      const trS = sTR / period || 1;
      const pS = (sPlusDM / period / trS) * 100;
      const mS = (sMinusDM / period / trS) * 100;

      plusDI.push(pS);
      minusDI.push(mS);

      const dx = pS + mS > 0 ? (Math.abs(pS - mS) / (pS + mS)) * 100 : 0;
      if (adxCount < period) {
        adxSum += dx;
        adxCount += 1;
        if (adxCount === period) {
          prevADX = adxSum / period;
          adx.push(prevADX);
        } else {
          adx.push(null);
        }
      } else {
        prevADX = (((prevADX as number) * (period - 1)) + dx) / period;
        adx.push(prevADX);
      }
    }

    return { plusDI, minusDI, adx };
  }
}
