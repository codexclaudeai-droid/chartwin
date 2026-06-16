const OUTLIER_LOWER_RATIO = 0.2;
const OUTLIER_UPPER_RATIO = 5;
const CLUSTER_LOWER_RATIO = 0.65;
const CLUSTER_UPPER_RATIO = 1.55;

function normalizeCandle(row) {
  if (!row || typeof row !== 'object') return null;
  const time = Number(row.time);
  const open = Number(row.open);
  const high = Number(row.high);
  const low = Number(row.low);
  const close = Number(row.close);
  const volume = Number(row.volume);
  if (![time, open, high, low, close, volume].every((value) => Number.isFinite(value))) return null;
  return {
    time: Math.floor(time),
    open,
    high,
    low,
    close,
    volume,
  };
}

function isImplausiblePriceJump(previousClose, candle) {
  if (!Number.isFinite(previousClose) || previousClose <= 0) return false;
  const minPrice = Math.min(candle.open, candle.high, candle.low, candle.close);
  const maxPrice = Math.max(candle.open, candle.high, candle.low, candle.close);
  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice <= 0) return true;
  return minPrice < previousClose * OUTLIER_LOWER_RATIO || maxPrice > previousClose * OUTLIER_UPPER_RATIO;
}

function isOutsideLatestPriceCluster(referenceClose, candle) {
  if (!Number.isFinite(referenceClose) || referenceClose <= 0) return false;
  const minPrice = Math.min(candle.open, candle.high, candle.low, candle.close);
  const maxPrice = Math.max(candle.open, candle.high, candle.low, candle.close);
  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice <= 0) return true;
  return minPrice < referenceClose * CLUSTER_LOWER_RATIO || maxPrice > referenceClose * CLUSTER_UPPER_RATIO;
}

function keepLatestPlausiblePriceCluster(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return Array.isArray(rows) ? rows : [];
  let startIndex = rows.length - 1;
  let referenceClose = rows[startIndex]?.close;
  for (let i = rows.length - 2; i >= 0; i -= 1) {
    const candle = rows[i];
    if (isOutsideLatestPriceCluster(referenceClose, candle)) break;
    startIndex = i;
    referenceClose = candle.close;
  }
  return rows.slice(startIndex);
}

function keepLatestContiguousSegment(rows, timeframeSec, maxGapBars) {
  if (!Array.isArray(rows) || rows.length < 2) return Array.isArray(rows) ? rows : [];
  if (!Number.isFinite(timeframeSec) || timeframeSec <= 0) return rows;
  const allowedGapSec = timeframeSec * Math.max(1, Math.floor(Number(maxGapBars) || 0));
  if (!Number.isFinite(allowedGapSec) || allowedGapSec <= 0) return rows;

  let startIndex = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const gapSec = Number(rows[i]?.time) - Number(rows[i - 1]?.time);
    if (Number.isFinite(gapSec) && gapSec > allowedGapSec) {
      startIndex = i;
    }
  }
  return rows.slice(startIndex);
}

export function sanitizeCandleSeries(rows, options = {}) {
  const timeframeSec = Number(options.timeframeSec);
  const maxGapBars = Math.max(1, Math.floor(Number(options.maxGapBars) || 0));
  if (!Array.isArray(rows)) return [];

  const deduped = new Map();
  rows
    .map((row) => normalizeCandle(row))
    .filter((row) => row != null)
    .sort((a, b) => a.time - b.time)
    .forEach((row) => {
      deduped.set(row.time, row);
    });

  const contiguousRows = keepLatestContiguousSegment(Array.from(deduped.values()), timeframeSec, maxGapBars);
  const filtered = [];
  for (const candle of contiguousRows) {
    const previousClose = filtered[filtered.length - 1]?.close;
    if (isImplausiblePriceJump(previousClose, candle)) continue;
    filtered.push(candle);
  }
  return keepLatestPlausiblePriceCluster(filtered);
}

export function shouldResetCandleSeries(currentRows, incomingRows, options = {}) {
  if (!Array.isArray(currentRows) || !currentRows.length) return false;
  if (!Array.isArray(incomingRows) || !incomingRows.length) return false;

  const timeframeSec = Number(options.timeframeSec);
  const maxGapBars = Math.max(1, Math.floor(Number(options.maxGapBars) || 0));
  if (!Number.isFinite(timeframeSec) || timeframeSec <= 0) return false;

  const allowedGapSec = timeframeSec * maxGapBars;
  const currentLastTime = Number(currentRows[currentRows.length - 1]?.time);
  const incomingFirstTime = Number(incomingRows[0]?.time);
  if (!Number.isFinite(currentLastTime) || !Number.isFinite(incomingFirstTime)) return false;
  return incomingFirstTime - currentLastTime > allowedGapSec;
}
