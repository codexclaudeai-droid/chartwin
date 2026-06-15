import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMt45TickAggregator,
  normalizeMt45Ticks,
} from '../server/mt45-tick-collector.mjs';

test('MT45 tick normalizer accepts EA webrequest batches and infers sell side from bid/ask', () => {
  const ticks = normalizeMt45Ticks({
    market: 'futures',
    symbol: 'nq1!',
    ticks: [
      {
        time: '2024-04-24T00:00:10.500Z',
        price: '17750.25',
        volume: '2',
        bid: '17750.25',
        ask: '17750.50',
      },
    ],
  });

  assert.deepEqual(ticks, [
    {
      market: 'futures',
      symbol: 'NQ1!',
      time: 1713916810,
      price: 17750.25,
      quantity: 2,
      side: 'sell',
      bid: 17750.25,
      ask: 17750.5,
      source: 'mt45',
      accountId: null,
    },
  ]);
});

test('MT45 tick normalizer uses platform defaults as raw tick source', () => {
  const ticks = normalizeMt45Ticks({
    market: 'futures',
    symbol: 'NQ1!',
    time: 1713916810,
    price: 17750.25,
    volume: 1,
  }, { source: 'mt5' });

  assert.equal(ticks[0].source, 'mt5');
});

test('MT45 tick aggregator keeps live candle in memory and finalizes only closed one minute candles', () => {
  const aggregator = createMt45TickAggregator({ priceStep: 0.25 });

  const first = aggregator.applyTick({
    market: 'futures',
    symbol: 'NQ1!',
    time: 1713916810,
    price: 100,
    quantity: 2,
    side: 'buy',
    source: 'mt45',
  });
  assert.equal(first.finalizedCandles.length, 0);
  assert.deepEqual(first.liveCandle, {
    time: 1713916800,
    open: 100,
    high: 100,
    low: 100,
    close: 100,
    volume: 2,
    buyVolume: 2,
    sellVolume: 0,
    volumeDelta: 2,
    footprint: {
      100: { buyVolume: 2, sellVolume: 0 },
    },
  });

  const second = aggregator.applyTick({
    market: 'futures',
    symbol: 'NQ1!',
    time: 1713916820,
    price: 100.25,
    quantity: 1,
    side: 'sell',
    source: 'mt45',
  });
  assert.equal(second.finalizedCandles.length, 0);
  assert.equal(second.liveCandle.close, 100.25);
  assert.equal(second.liveCandle.volume, 3);
  assert.equal(second.liveCandle.volumeDelta, 1);
  assert.deepEqual(second.liveCandle.footprint[100.25], { buyVolume: 0, sellVolume: 1 });

  const third = aggregator.applyTick({
    market: 'futures',
    symbol: 'NQ1!',
    time: 1713916861,
    price: 101,
    quantity: 5,
    side: 'buy',
    source: 'mt45',
  });

  assert.equal(third.finalizedCandles.length, 1);
  assert.equal(third.finalizedCandles[0].time, 1713916800);
  assert.equal(third.finalizedCandles[0].close, 100.25);
  assert.equal(third.finalizedCandles[0].volume, 3);
  assert.equal(third.liveCandle.time, 1713916860);
  assert.equal(third.liveCandle.open, 101);
});

test('MT45 tick aggregator can resolve price step per symbol', () => {
  const aggregator = createMt45TickAggregator({
    priceStep: (tick) => (tick.symbol === 'NQ1!' ? 0.25 : 0.1),
  });

  const nq = aggregator.applyTick({
    market: 'futures',
    symbol: 'NQ1!',
    time: 1713916810,
    price: 100.12,
    quantity: 1,
    side: 'buy',
    source: 'mt5',
  });
  const gold = aggregator.applyTick({
    market: 'commodity',
    symbol: 'XAUUSD',
    time: 1713916810,
    price: 100.12,
    quantity: 1,
    side: 'buy',
    source: 'mt5',
  });

  assert.deepEqual(nq.liveCandle.footprint[100], { buyVolume: 1, sellVolume: 0 });
  assert.deepEqual(gold.liveCandle.footprint[100.1], { buyVolume: 1, sellVolume: 0 });
});
