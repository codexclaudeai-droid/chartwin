export { smaCrossJs }              from './sma-cross-js.ts';
export { smaCrossPine }            from './sma-cross-pine.ts';
export { bollingerDirectedPine }   from './bollinger-directed-pine.ts';
export { doubleBreakJs }           from './double-break-js.ts';
export { shayhuangVwapJs }         from './shayhuang-vwap-js.ts';
export { gridMartingaleJs }        from './grid-martingale-js.ts';
export { gridAtrBnfSrouterV1 }    from './grid-atr-bnf-srouter-v1.ts';
export { xauGridLongJs }          from './xau-grid-long-js.ts';
export { mtf1mScalperJs }         from './mtf-1m-scalper-js.ts';
export { autoTrendlineChannelJs } from './auto-trendline-channel-js.ts';
export { donchianTrendFollowingJs } from './donchian-trend-following-js.ts';
export { mlCvdUltimateScalperJs } from './ml-cvd-ultimate-scalper-js.ts';
export { bbMtfKalmanSignalJs } from './bb-mtf-kalman-signal-js.ts';

import { smaCrossJs }              from './sma-cross-js.ts';
import { smaCrossPine }            from './sma-cross-pine.ts';
import { bollingerDirectedPine }   from './bollinger-directed-pine.ts';
import { doubleBreakJs }           from './double-break-js.ts';
import { shayhuangVwapJs }         from './shayhuang-vwap-js.ts';
import { gridMartingaleJs }        from './grid-martingale-js.ts';
import { gridAtrBnfSrouterV1 }    from './grid-atr-bnf-srouter-v1.ts';
import { xauGridLongJs }          from './xau-grid-long-js.ts';
import { mtf1mScalperJs }         from './mtf-1m-scalper-js.ts';
import { autoTrendlineChannelJs } from './auto-trendline-channel-js.ts';
import { donchianTrendFollowingJs } from './donchian-trend-following-js.ts';
import { mlCvdUltimateScalperJs } from './ml-cvd-ultimate-scalper-js.ts';
import { bbMtfKalmanSignalJs } from './bb-mtf-kalman-signal-js.ts';

export const ALL_STRATEGIES = [
  smaCrossJs,
  smaCrossPine,
  bollingerDirectedPine,
  doubleBreakJs,
  shayhuangVwapJs,
  gridMartingaleJs,
  gridAtrBnfSrouterV1,
  xauGridLongJs,
  mtf1mScalperJs,
  autoTrendlineChannelJs,
  donchianTrendFollowingJs,
  mlCvdUltimateScalperJs,
  bbMtfKalmanSignalJs,
] as const;
