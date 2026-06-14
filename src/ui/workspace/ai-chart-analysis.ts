import type { CandleData } from '../../types';

type AiBrowserTarget = {
  provider: 'Gemini' | 'Copilot';
  url: string;
};

type AiChart = {
  config: {
    symbol: string;
    timeframe: string;
    quoteCurrency?: string;
    timezone?: string;
    indicators?: Record<string, unknown>;
  };
  getCandles: () => CandleData[];
  getVisibleCandleRange: () => { startIndex: number; endIndex: number };
  getActiveStrategyName: () => string | null;
  getCompositeDataUrl: () => string;
};

export async function openAiChartAnalysis(chart: AiChart): Promise<void> {
  const target = detectAiBrowserTarget();
  const prompt = buildAiChartAnalysisPrompt(chart);
  const chartImageDataUrl = chart.getCompositeDataUrl();
  const opened = window.open(target.url, '_blank', 'noopener,noreferrer');

  const copied = await copyAiChartAnalysisContext(prompt, chartImageDataUrl);
  showAiChartAnalysisNotice(target.provider, copied);

  if (opened) {
    try {
      opened.focus();
    } catch {
      // Ignore cross-window focus errors.
    }
  }
}

export function detectAiBrowserTarget(userAgent = navigator.userAgent): AiBrowserTarget {
  if (/\bEdg\//i.test(userAgent)) {
    return { provider: 'Copilot', url: 'https://copilot.microsoft.com/' };
  }
  return { provider: 'Gemini', url: 'https://gemini.google.com/app' };
}

function buildAiChartAnalysisPrompt(chart: AiChart): string {
  const candles = chart.getCandles();
  const range = chart.getVisibleCandleRange();
  const visibleCandles = candles.slice(
    Math.max(0, range.startIndex),
    Math.min(candles.length, range.endIndex + 1),
  );
  const recentCandles = visibleCandles.slice(-80);
  const last = recentCandles.at(-1);
  const activeIndicators = Object.entries(chart.config.indicators ?? {})
    .filter(([, value]) => isIndicatorEnabled(value))
    .map(([key]) => key)
    .slice(0, 20);
  const strategyName = chart.getActiveStrategyName();

  return [
    '첨부된 차트 스크린샷과 아래 OHLCV 데이터를 함께 보고 차트 분석을 해줘.',
    '',
    `종목: ${chart.config.symbol}`,
    `시간봉: ${chart.config.timeframe}`,
    `표시 통화: ${chart.config.quoteCurrency ?? 'USDT'}`,
    `시간대: ${chart.config.timezone ?? 'local'}`,
    `활성 전략: ${strategyName ?? '없음'}`,
    `활성 보조지표: ${activeIndicators.length ? activeIndicators.join(', ') : '없음'}`,
    `최근 캔들 수: ${recentCandles.length}`,
    '',
    '요청:',
    '1. 현재 추세와 주요 지지/저항을 요약해줘.',
    '2. 상승/하락 시나리오를 각각 정리해줘.',
    '3. 진입, 손절, 익절 후보 구간을 리스크 관점에서 설명해줘.',
    '4. 확신이 낮은 부분은 단정하지 말고 조건으로 표현해줘.',
    '',
    '최근 캔들(UTC epoch seconds, open, high, low, close, volume):',
    ...recentCandles.map(formatCandleForPrompt),
    last ? `마지막 종가: ${formatNumber(last.close)}` : '마지막 종가: 데이터 없음',
  ].join('\n');
}

async function copyAiChartAnalysisContext(prompt: string, chartImageDataUrl: string): Promise<boolean> {
  try {
    const imageBlob = await dataUrlToBlob(chartImageDataUrl);
    if ('ClipboardItem' in window && navigator.clipboard?.write) {
      const ClipboardItemCtor = window.ClipboardItem;
      const item = new ClipboardItemCtor({
        'text/plain': new Blob([prompt], { type: 'text/plain' }),
        'image/png': imageBlob,
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch {
    // Fall through to text-only clipboard support.
  }

  try {
    await navigator.clipboard.writeText(prompt);
    return true;
  } catch {
    return false;
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

function formatCandleForPrompt(candle: CandleData): string {
  return [
    Math.round(Number(candle.time) || 0),
    formatNumber(candle.open),
    formatNumber(candle.high),
    formatNumber(candle.low),
    formatNumber(candle.close),
    formatNumber(candle.volume ?? 0),
  ].join(', ');
}

function formatNumber(value: unknown): string {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Number(numberValue.toFixed(8)).toString() : '0';
}

function isIndicatorEnabled(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'show' in value &&
      (value as { show?: unknown }).show === true,
  );
}

function showAiChartAnalysisNotice(provider: AiBrowserTarget['provider'], copied: boolean): void {
  const notice = document.createElement('div');
  notice.textContent = copied
    ? `${provider}에 붙여넣을 차트 분석 자료를 복사했습니다.`
    : `${provider}를 열었습니다. 클립보드 권한이 차단되어 차트 자료 복사는 실패했습니다.`;
  notice.style.cssText = [
    'position:fixed',
    'right:16px',
    'top:54px',
    'z-index:9800',
    'max-width:min(360px,calc(100vw - 32px))',
    'padding:10px 12px',
    'border:1px solid #31405c',
    'border-radius:8px',
    'background:#121927',
    'color:#e8eefb',
    'box-shadow:0 12px 34px rgba(0,0,0,0.35)',
    'font:700 12px/1.5 Segoe UI,Arial,sans-serif',
  ].join(';');
  document.body.appendChild(notice);
  window.setTimeout(() => notice.remove(), 3200);
}
