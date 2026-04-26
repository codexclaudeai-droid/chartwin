type CandleLike = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type LiveChartLike<TTimeframe extends string, TCandle extends CandleLike> = {
  config: {
    timeframe: TTimeframe;
  };
  addNewCandle: (candle: TCandle) => void;
  updateLastCandle: (patch: Pick<TCandle, 'close' | 'high' | 'low' | 'volume'>) => void;
};

type CreateLiveTickerArgs<TTimeframe extends string, TCandle extends CandleLike> = {
  chart: LiveChartLike<TTimeframe, TCandle>;
  getData: () => TCandle[];
  getBucketStartSec: (epochSec: number, timeframe: TTimeframe) => number;
  shiftBucketSec: (bucketStartSec: number, timeframe: TTimeframe, dir: 1 | -1) => number;
  onTick?: () => void;
  intervalMs?: number;
};

export function createLiveTicker<TTimeframe extends string, TCandle extends CandleLike>({
  chart,
  getData,
  getBucketStartSec,
  shiftBucketSec,
  onTick,
  intervalMs = 500,
}: CreateLiveTickerArgs<TTimeframe, TCandle>): { startLive: () => void; stopLive: () => void } {
  let liveTimer: number | null = null;

  const runTick = () => {
    const data = getData();
    if (!data.length) return;

    const tf = chart.config.timeframe;
    const nowSec = Math.floor(Date.now() / 1000);
    const currentBucket = getBucketStartSec(nowSec, tf);
    let last = data[data.length - 1];
    if (!Number.isFinite(last.time) || !Number.isFinite(last.close) || !Number.isFinite(last.high) || !Number.isFinite(last.low) || !Number.isFinite(last.volume)) return;

    let safety = 0;
    while (last.time < currentBucket && safety < 1000) {
      safety += 1;
      const nextBucket = shiftBucketSec(last.time, tf, 1);
      const open = last.close;
      const close = open + (Math.random() - 0.5) * open * 0.004;
      const high = Math.max(open, close) * (1 + Math.random() * 0.002);
      const low = Math.min(open, close) * (1 - Math.random() * 0.002);
      if (!Number.isFinite(nextBucket) || !Number.isFinite(open) || !Number.isFinite(close) || !Number.isFinite(high) || !Number.isFinite(low)) break;
      const created = {
        time: nextBucket,
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 800) + 200,
      } as TCandle;
      data.push(created);
      chart.addNewCandle(created);
      last = created;
    }
    if (safety >= 1000) return;

    const liveMove = (Math.random() - 0.495) * last.close * 0.0008;
    const liveClose = Math.max(0.0001, last.close + liveMove);
    const liveHigh = Math.max(last.high, liveClose);
    const liveLow = Math.min(last.low, liveClose);
    const liveVolume = last.volume + Math.floor(Math.random() * 15);
    last.close = liveClose;
    last.high = liveHigh;
    last.low = liveLow;
    last.volume = liveVolume;
    chart.updateLastCandle({ close: liveClose, high: liveHigh, low: liveLow, volume: liveVolume });
    onTick?.();
  };

  const startLive = () => {
    if (liveTimer !== null) return;
    liveTimer = window.setInterval(runTick, intervalMs);
  };

  const stopLive = () => {
    if (liveTimer === null) return;
    window.clearInterval(liveTimer);
    liveTimer = null;
  };

  return {
    startLive,
    stopLive,
  };
}
