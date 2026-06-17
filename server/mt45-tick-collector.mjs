const DEFAULT_TIMEFRAME = '1m';
const VALID_SIDES = new Set(['buy', 'sell', 'unknown']);
const TIMEFRAME_SECONDS = new Map([
  ['1m', 60],
  ['3m', 180],
  ['5m', 300],
  ['15m', 900],
  ['30m', 1800],
  ['1h', 3600],
  ['2h', 7200],
  ['4h', 14400],
  ['1d', 86400],
]);

function normalizeMarket(input) {
  const raw = String(input || '').trim().toLowerCase();
  const compact = raw.replace(/[\s_-]+/g, '');
  if (compact === 'indexfutures' || compact === 'nasdaqfutures' || compact === 'nas100futures') return 'futures';
  return raw;
}

function normalizeSymbol(input) {
  const normalized = String(input || '').trim().toUpperCase().replace(/\s+/g, '');
  if (
    normalized === 'NAS100'
    || normalized === 'NQ'
    || normalized === 'NAS100FT'
    || normalized === 'NAS100.FT'
    || normalized === 'NAS100FUTURES'
  ) return 'NQ1!';
  return normalized;
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function normalizeTimeframe(input) {
  const raw = String(input || DEFAULT_TIMEFRAME).trim();
  return TIMEFRAME_SECONDS.has(raw) ? raw : DEFAULT_TIMEFRAME;
}

function parseUnixTimeSec(value) {
  if (value == null) return NaN;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return NaN;
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return numeric > 1e12 ? Math.floor(numeric / 1000) : Math.floor(numeric);
    const parsedMs = Date.parse(raw);
    if (Number.isFinite(parsedMs)) return Math.floor(parsedMs / 1000);
  }
  return NaN;
}

function normalizeSide(input, price, bid, ask) {
  const raw = String(input || '').trim().toLowerCase();
  if (raw === 'buy' || raw === 'b' || raw === 'long' || raw === 'ask') return 'buy';
  if (raw === 'sell' || raw === 's' || raw === 'short' || raw === 'bid') return 'sell';

  if (Number.isFinite(price) && Number.isFinite(ask) && price >= ask) return 'buy';
  if (Number.isFinite(price) && Number.isFinite(bid) && price <= bid) return 'sell';
  return 'unknown';
}

function pickFirstFinite(row, keys) {
  for (const key of keys) {
    const value = toFiniteNumber(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return NaN;
}

function floorToTimeframe(timeSec, timeframe) {
  const seconds = TIMEFRAME_SECONDS.get(normalizeTimeframe(timeframe)) || 60;
  return Math.floor(timeSec / seconds) * seconds;
}

function clampSourceUtcOffsetHours(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-14, Math.min(14, number));
}

function getSourceUtcOffsetHours(defaults, context) {
  if (typeof defaults.getSourceUtcOffsetHours === 'function') {
    return clampSourceUtcOffsetHours(defaults.getSourceUtcOffsetHours(context));
  }
  return clampSourceUtcOffsetHours(
    context.row?.sourceUtcOffsetHours
      ?? context.row?.utcOffsetHours
      ?? defaults.sourceUtcOffsetHours
      ?? defaults.utcOffsetHours
      ?? 0,
  );
}

function getInputTicks(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.ticks)) return payload.ticks;
  if (payload?.tick && typeof payload.tick === 'object') return [payload.tick];
  if (payload && typeof payload === 'object') return [payload];
  return [];
}

export function normalizeMt45Ticks(payload, defaults = {}) {
  const parent = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const baseMarket = parent.market ?? defaults.market;
  const baseSymbol = parent.symbol ?? defaults.symbol;
  const baseSource = parent.source ?? defaults.source ?? 'mt45';
  const baseAccountId = parent.accountId ?? parent.account_id ?? parent.account ?? defaults.accountId ?? null;

  return getInputTicks(payload)
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const market = normalizeMarket(row.market ?? baseMarket);
      const symbol = normalizeSymbol(row.symbol ?? baseSymbol);
      const source = String((row.source ?? baseSource) || 'mt45');
      const sourceUtcOffsetHours = getSourceUtcOffsetHours(defaults, { market, symbol, source, row });
      const rawTime = parseUnixTimeSec(row.time ?? row.timestamp ?? row.ts ?? row.datetime);
      const time = Number.isFinite(rawTime)
        ? rawTime - Math.round(sourceUtcOffsetHours * 3600)
        : NaN;
      const bid = pickFirstFinite(row, ['bid']);
      const ask = pickFirstFinite(row, ['ask']);
      const price = pickFirstFinite(row, ['price', 'last', 'close']);
      const fallbackPrice = Number.isFinite(price)
        ? price
        : (Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : NaN);
      const quantity = pickFirstFinite(row, ['quantity', 'qty', 'volume', 'tickVolume', 'tick_volume', 'lot']);
      const side = normalizeSide(row.side ?? row.tradeSide ?? row.direction, fallbackPrice, bid, ask);
      if (!market || !symbol || !Number.isFinite(time) || !Number.isFinite(fallbackPrice)) return null;
      return {
        market,
        symbol,
        time,
        price: fallbackPrice,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        side: VALID_SIDES.has(side) ? side : 'unknown',
        bid: Number.isFinite(bid) ? bid : null,
        ask: Number.isFinite(ask) ? ask : null,
        source,
        sourceUtcOffsetHours,
        accountId: row.accountId ?? row.account_id ?? row.account ?? baseAccountId,
      };
    })
    .filter((tick) => tick != null)
    .sort((a, b) => a.time - b.time);
}

export function normalizeMt45BackfillCandles(payload, defaults = {}) {
  const parent = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const market = normalizeMarket(parent.market ?? defaults.market);
  const symbol = normalizeSymbol(parent.symbol ?? defaults.symbol);
  const timeframe = normalizeTimeframe(parent.timeframe ?? parent.interval ?? defaults.timeframe);
  const sourceUtcOffsetHours = clampSourceUtcOffsetHours(
    parent.sourceUtcOffsetHours
      ?? parent.utcOffsetHours
      ?? defaults.sourceUtcOffsetHours
      ?? defaults.utcOffsetHours
      ?? 0,
  );
  const rows = Array.isArray(parent.candles)
    ? parent.candles
    : (Array.isArray(payload) ? payload : []);
  const candles = rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const closeRaw = pickFirstFinite(row, ['close', 'c']);
      if (!Number.isFinite(closeRaw)) return null;
      const openRaw = pickFirstFinite(row, ['open', 'o']);
      const highRaw = pickFirstFinite(row, ['high', 'h']);
      const lowRaw = pickFirstFinite(row, ['low', 'l']);
      const rawTime = parseUnixTimeSec(row.time ?? row.timestamp ?? row.ts ?? row.datetime);
      const time = Number.isFinite(rawTime)
        ? floorToTimeframe(rawTime - Math.round(sourceUtcOffsetHours * 3600), timeframe)
        : NaN;
      const volume = pickFirstFinite(row, ['volume', 'tick_volume', 'tickVolume', 'real_volume', 'realVolume', 'v']);
      if (!market || !symbol || !Number.isFinite(time)) return null;
      return {
        time,
        open: Number.isFinite(openRaw) ? openRaw : closeRaw,
        high: Number.isFinite(highRaw) ? highRaw : closeRaw,
        low: Number.isFinite(lowRaw) ? lowRaw : closeRaw,
        close: closeRaw,
        volume: Number.isFinite(volume) ? volume : 0,
      };
    })
    .filter((candle) => candle != null)
    .sort((a, b) => a.time - b.time);

  return {
    market,
    symbol,
    timeframe,
    sourceUtcOffsetHours,
    candles,
  };
}

function floorToOneMinute(timeSec) {
  return Math.floor(timeSec / 60) * 60;
}

function getTradeVolumes(side, quantity) {
  if (side === 'buy') return { buyVolume: quantity, sellVolume: 0 };
  if (side === 'sell') return { buyVolume: 0, sellVolume: quantity };
  return { buyVolume: 0, sellVolume: 0 };
}

function normalizeTickQuantity(value) {
  const quantity = Number(value);
  // Many MT CFD/futures feeds expose price ticks but no exchange volume.
  // Use one tick as the minimum tick-volume unit so volume indicators do not go blank.
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function inferSideFromReference(tick, referencePrice) {
  if (tick.side === 'buy' || tick.side === 'sell') return tick.side;
  if (!Number.isFinite(tick.price) || !Number.isFinite(referencePrice)) return tick.side;
  if (tick.price > referencePrice) return 'buy';
  if (tick.price < referencePrice) return 'sell';
  return tick.side;
}

function countDecimals(value) {
  const raw = String(value);
  const [, decimals = ''] = raw.split('.');
  return decimals.length;
}

function normalizePriceLevel(price, priceStep) {
  const step = Number(priceStep);
  if (!Number.isFinite(step) || step <= 0) return Number(price);
  const decimals = Math.min(8, countDecimals(step));
  return Number((Math.round(price / step) * step).toFixed(decimals));
}

function createCandleFromTick(tick, priceStep, referencePrice = NaN) {
  const quantity = normalizeTickQuantity(tick.quantity);
  const side = inferSideFromReference(tick, referencePrice);
  const { buyVolume, sellVolume } = getTradeVolumes(side, quantity);
  const priceLevel = normalizePriceLevel(tick.price, priceStep);
  return {
    time: floorToOneMinute(tick.time),
    open: tick.price,
    high: tick.price,
    low: tick.price,
    close: tick.price,
    volume: quantity,
    buyVolume,
    sellVolume,
    volumeDelta: buyVolume - sellVolume,
    footprint: {
      [priceLevel]: { buyVolume, sellVolume },
    },
  };
}

function applyTickToCandle(candle, tick, priceStep) {
  const quantity = normalizeTickQuantity(tick.quantity);
  const side = inferSideFromReference(tick, candle.close);
  const { buyVolume, sellVolume } = getTradeVolumes(side, quantity);
  const priceLevel = normalizePriceLevel(tick.price, priceStep);
  const currentLevel = candle.footprint[priceLevel] || { buyVolume: 0, sellVolume: 0 };
  candle.high = Math.max(candle.high, tick.price);
  candle.low = Math.min(candle.low, tick.price);
  candle.close = tick.price;
  candle.volume += quantity;
  candle.buyVolume += buyVolume;
  candle.sellVolume += sellVolume;
  candle.volumeDelta = candle.buyVolume - candle.sellVolume;
  candle.footprint[priceLevel] = {
    buyVolume: currentLevel.buyVolume + buyVolume,
    sellVolume: currentLevel.sellVolume + sellVolume,
  };
  return candle;
}

export function createMt45TickAggregator(options = {}) {
  const timeframe = options.timeframe || DEFAULT_TIMEFRAME;
  const getPriceStep = typeof options.priceStep === 'function'
    ? options.priceStep
    : () => Number(options.priceStep) || 0;
  const liveCandles = new Map();

  return {
    applyTick(tick) {
      if (!tick || !Number.isFinite(tick.time) || !Number.isFinite(tick.price)) {
        return { timeframe, liveCandle: null, finalizedCandles: [] };
      }

      const key = `${normalizeMarket(tick.market)}:${normalizeSymbol(tick.symbol)}:${timeframe}`;
      const bucketTime = floorToOneMinute(tick.time);
      const existing = liveCandles.get(key);
      const finalizedCandles = [];
      const priceStep = Number(getPriceStep(tick)) || 0;

      if (!existing) {
        const liveCandle = createCandleFromTick(tick, priceStep);
        liveCandles.set(key, liveCandle);
        return { timeframe, liveCandle: { ...liveCandle }, finalizedCandles };
      }

      if (existing.time === bucketTime) {
        const liveCandle = applyTickToCandle(existing, tick, priceStep);
        return { timeframe, liveCandle: { ...liveCandle }, finalizedCandles };
      }

      if (bucketTime > existing.time) {
        finalizedCandles.push({ ...existing });
        const liveCandle = createCandleFromTick(tick, priceStep, existing.close);
        liveCandles.set(key, liveCandle);
        return { timeframe, liveCandle: { ...liveCandle }, finalizedCandles };
      }

      return { timeframe, liveCandle: { ...existing }, finalizedCandles };
    },
    getLiveCandles() {
      return Array.from(liveCandles.values()).map((candle) => ({ ...candle }));
    },
  };
}
