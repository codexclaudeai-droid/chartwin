import { toRgba } from '../chart/color-utils';
import type { ChartPatternType, PatternAlertLevel, PatternSignal } from './pattern-detector';

const CHART_FONT_STACK = `'Segoe UI Variable Text','Segoe UI','Noto Sans KR','Apple SD Gothic Neo',sans-serif`;
const PATTERN_POPUP_STACK_OFFSET = 156;

export interface PatternPopupOptions {
  patternVisible?: boolean;
  onMoveToPattern?: () => void;
  onConfirmPatternVisible?: () => void;
}

export function clearPatternPopups(host: HTMLElement): void {
  host.querySelectorAll('.chart-pattern-popup').forEach((el) => el.remove());
}

export function showPatternPopup(host: HTMLElement, signal: PatternSignal, options: PatternPopupOptions = {}): void {
  const existing = Array.from(host.querySelectorAll('.chart-pattern-popup')) as HTMLDivElement[];
  const popup = document.createElement('div');
  popup.className = 'chart-pattern-popup';
  const patternVisible = options.patternVisible !== false;
  const levelLabel: Record<PatternAlertLevel, string> = {
    watch: '주의',
    warn: '경계',
    confirmed: '확정',
  };
  const typeLabel: Record<ChartPatternType, string> = {
    'double-bottom': '쌍바닥',
    'double-top': '쌍봉',
    'head-and-shoulders': '헤드앤숄더',
    'inverse-head-and-shoulders': '역헤드앤숄더',
    'bullish-engulfing': '상승 장악형',
    'bearish-engulfing': '하락 장악형',
    'bearish-harami': '하락 잉태형',
    'bullish-harami': '상승 잉태형',
    harami: '하라미',
    'dark-cloud-cover': '흑운형',
    'piercing-line': '관통형',
    'three-white-soldiers': '적삼병',
    'three-black-crows': '흑삼병',
    'morning-star': '샛별형',
    'evening-star': '저녁별형',
    'morning-doji-star': '새벽십자별형',
    'evening-doji-star': '저녁십자별형',
    'shooting-star': '유성형',
    'inverted-hammer': '역망치형',
  };
  const levelColor: Record<PatternAlertLevel, string> = {
    watch: '#f5c84b',
    warn: '#ff8a42',
    confirmed: '#26a69a',
  };
  const color = levelColor[signal.level];
  const checklistHtml = signal.checklist.map((item) => `<div style="opacity:0.88;">- ${item}</div>`).join('');
  const realignPatternPopups = () => {
    const left = Array.from(host.querySelectorAll('.chart-pattern-popup')) as HTMLDivElement[];
    left.forEach((el, idx) => {
      el.style.bottom = `${12 + idx * PATTERN_POPUP_STACK_OFFSET}px`;
    });
  };
  const closePopup = () => {
    popup.style.opacity = '0';
    popup.style.transform = 'translateY(-6px)';
    window.setTimeout(() => {
      popup.remove();
      realignPatternPopups();
    }, 180);
  };
  const statusColor = patternVisible ? '#83e0b7' : '#ffb387';
  const rangeText = `${signal.startIndex ?? signal.barIndex} ~ ${signal.endIndex ?? signal.barIndex}`;

  popup.style.cssText = [
    'position:absolute',
    'left:12px',
    `bottom:${12 + existing.length * PATTERN_POPUP_STACK_OFFSET}px`,
    'z-index:2270',
    'min-width:250px',
    'max-width:320px',
    'padding:10px 12px',
    'border-radius:10px',
    'background:rgba(16,24,37,0.97)',
    `border:1px solid ${toRgba(color, 0.9, '#4e6a95')}`,
    'color:#eef3ff',
    `font:600 12px ${CHART_FONT_STACK}`,
    'box-shadow:0 10px 24px rgba(0,0,0,0.36)',
    'opacity:0',
    'transform:translateY(8px)',
    'transition:opacity 180ms ease, transform 180ms ease',
  ].join(';');
  popup.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
      <div style="font-size:13px;color:${color};">${levelLabel[signal.level]} · ${typeLabel[signal.type]}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="font-size:11px;color:#9fb1d3;">신뢰도 ${(signal.confidence * 100).toFixed(0)}%</div>
        <button type="button" data-role="close-pattern-popup" style="width:20px;height:20px;border-radius:999px;border:1px solid #5d7094;background:#1b2a42;color:#d7e4ff;cursor:pointer;font-size:12px;line-height:1;">×</button>
      </div>
    </div>
    <div style="font-size:12px;color:#dfe8fb;line-height:1.35;margin-bottom:7px;">${signal.message}</div>
    <div style="font-size:11px;color:#afc0df;line-height:1.35;margin-bottom:9px;">${checklistHtml}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;padding:7px 8px;border:1px solid rgba(109,132,173,0.35);border-radius:8px;background:rgba(255,255,255,0.03);">
      <div style="font-size:11px;color:${statusColor};">패턴 표시 ${patternVisible ? '켜짐' : '꺼짐'}</div>
      <div style="font-size:11px;color:#9fb1d3;">구간 ${rangeText}</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button type="button" data-role="move-pattern-range" style="flex:1;height:30px;border-radius:8px;border:1px solid #4f6b9b;background:#22314d;color:#eef3ff;cursor:pointer;font:600 12px ${CHART_FONT_STACK};">구간 이동</button>
      <button type="button" data-role="confirm-pattern-visible" style="flex:1;height:30px;border-radius:8px;border:1px solid ${patternVisible ? '#4f8fff' : '#c97f42'};background:${patternVisible ? 'rgba(43,124,255,0.18)' : 'rgba(255,138,66,0.18)'};color:#eef3ff;cursor:pointer;font:600 12px ${CHART_FONT_STACK};">${patternVisible ? '표시 확인' : '켜고 보기'}</button>
    </div>
  `;
  const closeBtn = popup.querySelector('[data-role="close-pattern-popup"]') as HTMLButtonElement | null;
  const moveBtn = popup.querySelector('[data-role="move-pattern-range"]') as HTMLButtonElement | null;
  const confirmBtn = popup.querySelector('[data-role="confirm-pattern-visible"]') as HTMLButtonElement | null;
  closeBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    closePopup();
  });
  moveBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    options.onMoveToPattern?.();
    closePopup();
  });
  confirmBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    options.onConfirmPatternVisible?.();
    closePopup();
  });

  host.appendChild(popup);
  window.requestAnimationFrame(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'translateY(0)';
  });
}
