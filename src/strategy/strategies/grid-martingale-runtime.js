export function simulateGridMartingale(close, symbol = '', rawParams = {}) {
  const prices = Array.isArray(close) ? close.map((value) => Number(value)) : [];
  const upper = String(symbol || '').trim().toUpperCase();
  const presets = {
    DEFAULT: { gridStep: 120, takeProfitSteps: 2.2, maxLevel: 8, equityStopPct: 14 },
    NASDAQ: { gridStep: 40, takeProfitSteps: 1.8, maxLevel: 7, equityStopPct: 12 },
    GOLD: { gridStep: 25, takeProfitSteps: 1.6, maxLevel: 6, equityStopPct: 10 },
  };
  const presetKey = upper.includes('XAU') || upper.includes('GOLD')
    ? 'GOLD'
    : (upper.includes('NQ') || upper.includes('NAS') || upper.includes('IXIC') ? 'NASDAQ' : 'DEFAULT');
  const preset = presets[presetKey] || presets.DEFAULT;
  const config = {
    gridStep: Number.isFinite(Number(rawParams.gridStep)) ? Number(rawParams.gridStep) : preset.gridStep,
    takeProfitSteps: Number.isFinite(Number(rawParams.takeProfitSteps)) ? Number(rawParams.takeProfitSteps) : preset.takeProfitSteps,
    maxLevel: Number.isFinite(Number(rawParams.maxLevel)) ? Number(rawParams.maxLevel) : preset.maxLevel,
    equityStopPct: Number.isFinite(Number(rawParams.equityStopPct)) ? Number(rawParams.equityStopPct) : preset.equityStopPct,
  };

  const n = prices.length;
  const signals = new Array(n).fill(0);
  const trades = [];
  const openLongEntries = [];
  const openShortEntries = [];
  if (!n) return { signals, trades, openLongEntries, openShortEntries, config };

  const midPrice = prices[Math.floor(n / 2)] || 1;
  const pointValue = midPrice >= 10000 ? 1.0
    : midPrice >= 1000 ? 0.1
      : midPrice >= 10 ? 0.01
        : 0.0001;
  const gridStep = Math.max(Number(config.gridStep) || 0, 0.0001) * pointValue;
  const basketTarget = gridStep * Math.max(Number(config.takeProfitSteps) || 0, 0.1);
  const maxLevel = Math.max(1, Math.round(Number(config.maxLevel) || 1));
  const equityStopPct = Math.max(Number(config.equityStopPct) || 0, 0.1);

  let balance = midPrice * 100;
  let longBasket = [];
  let shortBasket = [];

  const closeLongBasket = (price, index, reason, actionSigns) => {
    if (!longBasket.length) return;
    for (const leg of longBasket) {
      const pnl = price - leg.entry;
      trades.push({ side: 'LONG', entry: leg.entry, exit: price, entryIndex: leg.entryIndex, exitIndex: index, pnl, reason });
      balance += pnl;
    }
    longBasket = [];
    actionSigns.push(-1);
  };

  const closeShortBasket = (price, index, reason, actionSigns) => {
    if (!shortBasket.length) return;
    for (const leg of shortBasket) {
      const pnl = leg.entry - price;
      trades.push({ side: 'SHORT', entry: leg.entry, exit: price, entryIndex: leg.entryIndex, exitIndex: index, pnl, reason });
      balance += pnl;
    }
    shortBasket = [];
    actionSigns.push(1);
  };

  for (let i = 1; i < n; i += 1) {
    const price = prices[i];
    if (!Number.isFinite(price)) continue;
    const actionSigns = [];
    const longOpenPnl = longBasket.reduce((sum, leg) => sum + (price - leg.entry), 0);
    const shortOpenPnl = shortBasket.reduce((sum, leg) => sum + (leg.entry - price), 0);
    const totalOpenPnl = longOpenPnl + shortOpenPnl;
    const equity = balance + totalOpenPnl;

    if ((longBasket.length || shortBasket.length) && balance > 0 && (1.0 - equity / balance) * 100.0 >= equityStopPct) {
      closeLongBasket(price, i, 'equity_stop', actionSigns);
      closeShortBasket(price, i, 'equity_stop', actionSigns);
    } else {
      if (longBasket.length && longOpenPnl >= basketTarget) closeLongBasket(price, i, 'basket_tp', actionSigns);
      if (shortBasket.length && shortOpenPnl >= basketTarget) closeShortBasket(price, i, 'basket_tp', actionSigns);
    }

    if (!longBasket.length) {
      longBasket.push({ entry: price, entryIndex: i });
      actionSigns.push(1);
    } else if (longBasket.length < maxLevel) {
      let worstLongEntry = longBasket[0].entry;
      for (let j = 1; j < longBasket.length; j += 1) {
        if (longBasket[j].entry < worstLongEntry) worstLongEntry = longBasket[j].entry;
      }
      if (price <= worstLongEntry - gridStep) {
        longBasket.push({ entry: price, entryIndex: i });
        actionSigns.push(1);
      }
    }

    if (!shortBasket.length) {
      shortBasket.push({ entry: price, entryIndex: i });
      actionSigns.push(-1);
    } else if (shortBasket.length < maxLevel) {
      let worstShortEntry = shortBasket[0].entry;
      for (let j = 1; j < shortBasket.length; j += 1) {
        if (shortBasket[j].entry > worstShortEntry) worstShortEntry = shortBasket[j].entry;
      }
      if (price >= worstShortEntry + gridStep) {
        shortBasket.push({ entry: price, entryIndex: i });
        actionSigns.push(-1);
      }
    }

    if (actionSigns.length) {
      const net = actionSigns.reduce((sum, value) => sum + value, 0);
      signals[i] = net === 0 ? actionSigns[actionSigns.length - 1] : (net > 0 ? 1 : -1);
    }
  }

  openLongEntries.push(...longBasket);
  openShortEntries.push(...shortBasket);
  return { signals, trades, openLongEntries, openShortEntries, config };
}
