export type RoutedMarketState = 'RANGE' | 'TREND_UP' | 'TREND_DOWN' | 'VOLATILE';

export type MarketStateDetectorOptions = {
  volatileAtrPct: number;
  neutralDiffPct: number;
};

export function detectMarketState(
  latestPrice: number,
  atr: number,
  maFast: number,
  maSlow: number,
  options: MarketStateDetectorOptions,
): RoutedMarketState {
  const safePrice = Math.max(Math.abs(latestPrice), 1e-10);
  const maDiff = Math.abs(maFast - maSlow) / safePrice;

  if (atr > latestPrice * options.volatileAtrPct) {
    return 'VOLATILE';
  }
  if (maDiff >= options.neutralDiffPct && maFast > maSlow) {
    return 'TREND_UP';
  }
  if (maDiff >= options.neutralDiffPct && maFast < maSlow) {
    return 'TREND_DOWN';
  }
  return 'RANGE';
}

export const MARKET_STATE_DETECTOR_FUNCTION_SOURCE = `(function(latestPrice, atr, maFast, maSlow, options) {
  var safePrice = Math.max(Math.abs(latestPrice), 1e-10);
  var maDiff = Math.abs(maFast - maSlow) / safePrice;
  if (atr > latestPrice * options.volatileAtrPct) return 'VOLATILE';
  if (maDiff >= options.neutralDiffPct && maFast > maSlow) return 'TREND_UP';
  if (maDiff >= options.neutralDiffPct && maFast < maSlow) return 'TREND_DOWN';
  return 'RANGE';
})`;
