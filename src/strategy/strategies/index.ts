export { smaCrossJs }              from './sma-cross-js';
export { smaCrossPine }            from './sma-cross-pine';
export { bollingerDirectedPine }   from './bollinger-directed-pine';
export { doubleBreakJs }           from './double-break-js';
export { shayhuangVwapJs }         from './shayhuang-vwap-js';
export { gridMartingaleJs }        from './grid-martingale-js';
export { gridAtrBnfSrouterV1 }    from './grid-atr-bnf-srouter-v1';

import { smaCrossJs }              from './sma-cross-js';
import { smaCrossPine }            from './sma-cross-pine';
import { bollingerDirectedPine }   from './bollinger-directed-pine';
import { doubleBreakJs }           from './double-break-js';
import { shayhuangVwapJs }         from './shayhuang-vwap-js';
import { gridMartingaleJs }        from './grid-martingale-js';
import { gridAtrBnfSrouterV1 }    from './grid-atr-bnf-srouter-v1';

export const ALL_STRATEGIES = [
  smaCrossJs,
  smaCrossPine,
  bollingerDirectedPine,
  doubleBreakJs,
  shayhuangVwapJs,
  gridMartingaleJs,
  gridAtrBnfSrouterV1,
] as const;
