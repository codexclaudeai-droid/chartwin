'use client';

import { type CSSProperties } from 'react';

const heroCandleSpacing = 2;
const heroCandleStart = -5;
const heroCandleTrendRegimes = [
  { until: 14, from: -34, to: 30, noise: 4 },
  { until: 25, from: 26, to: 20, noise: 7 },
  { until: 39, from: 18, to: -32, noise: 5 },
  { until: 47, from: -26, to: -18, noise: 6 },
  { until: 56, from: -16, to: 32, noise: 4 },
];

const heroCandlePatternSeed = [
  { direction: 'up', pattern: '', width: '8px', height: '32px', offset: '-24px', wickHeight: '62px' },
  { direction: 'down', pattern: 'squeeze', width: '8px', height: '24px', offset: '-7px', wickHeight: '44px' },
  { direction: 'up', pattern: 'doji', width: '7px', height: '7px', offset: '8px', wickHeight: '38px' },
  { direction: 'down', pattern: '', width: '8px', height: '29px', offset: '18px', wickHeight: '54px' },
  { direction: 'up', pattern: '', width: '8px', height: '37px', offset: '4px', wickHeight: '64px' },
  { direction: 'up', pattern: 'marubozu', width: '8px', height: '26px', offset: '29px', wickHeight: '34px' },
  { direction: 'down', pattern: '', width: '8px', height: '34px', offset: '14px', wickHeight: '66px' },
  { direction: 'up', pattern: 'inverted-hammer', width: '8px', height: '22px', offset: '-3px', wickHeight: '70px' },
  { direction: 'down', pattern: 'squeeze', width: '7px', height: '18px', offset: '-16px', wickHeight: '36px' },
  { direction: 'up', pattern: '', width: '8px', height: '31px', offset: '-1px', wickHeight: '58px' },
  { direction: 'down', pattern: 'doji', width: '7px', height: '7px', offset: '17px', wickHeight: '42px' },
  { direction: 'up', pattern: '', width: '8px', height: '36px', offset: '31px', wickHeight: '60px' },
  { direction: 'down', pattern: '', width: '8px', height: '27px', offset: '8px', wickHeight: '50px' },
  { direction: 'up', pattern: 'squeeze', width: '7px', height: '17px', offset: '-9px', wickHeight: '32px' },
  { direction: 'down', pattern: 'inverted-hammer', width: '8px', height: '23px', offset: '-20px', wickHeight: '68px' },
  { direction: 'up', pattern: '', width: '8px', height: '33px', offset: '6px', wickHeight: '56px' },
];

function getHeroCandleOffset(index: number): string {
  let previousUntil = 0;
  const regime = heroCandleTrendRegimes.find((entry) => {
    const matched = index < entry.until;
    if (!matched) previousUntil = entry.until;
    return matched;
  }) ?? heroCandleTrendRegimes[heroCandleTrendRegimes.length - 1]!;
  const localLength = Math.max(1, regime.until - previousUntil - 1);
  const localProgress = Math.min(1, Math.max(0, (index - previousUntil) / localLength));
  const baseOffset = regime.from + (regime.to - regime.from) * localProgress;
  const microMovement = Math.sin(index * 1.7) * regime.noise + Math.sin(index * 0.43) * regime.noise * 0.55;
  return `${Math.round(baseOffset + microMovement)}px`;
}

const heroCandleSeed = Array.from({ length: 56 }, (_, index) => {
  const candle = heroCandlePatternSeed[index % heroCandlePatternSeed.length]!;
  return {
    ...candle,
    left: `${heroCandleStart + index * heroCandleSpacing}%`,
    offset: getHeroCandleOffset(index),
    signal: index === 18 ? 'sell' : index === 42 ? 'buy' : null,
  };
});

export default function LandingChartMotion({ className }: { className?: string }) {
  return (
    <div className={className ? `landing-hero-chart-board ${className}` : 'landing-hero-chart-board'} aria-hidden="true">
      <div className="landing-hero-chart-stream">
        <div className="landing-hero-chart-track">
          {[0, 1].map((segment) => (
            <div
              className="landing-hero-chart-segment"
              key={segment}
              style={{ '--segment-left': `${segment * 50}%` } as CSSProperties}
            >
              <span className="landing-hero-chart-line" />
              {heroCandleSeed.map((candle, candleIndex) => (
                <span
                  className={`landing-hero-chart-candle ${candle.direction} ${candle.pattern}`.trim()}
                  key={`${segment}-${candle.left}-${candleIndex}`}
                  style={{
                    '--candle-left': candle.left,
                    '--candle-width': candle.width,
                    '--candle-height': candle.height,
                    '--candle-offset': candle.offset,
                    '--wick-height': candle.wickHeight,
                  } as CSSProperties}
                >
                  {candle.signal ? (
                    <span className={`landing-hero-chart-signal ${candle.signal}`}>
                      {candle.signal.toUpperCase()}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
