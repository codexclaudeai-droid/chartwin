type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';
type TooltipAlign = 'start' | 'center' | 'end';

export type TooltipBadgeContent = {
  title: string;
  shortcut?: string;
  description?: string;
};

type TooltipBadgeOptions = {
  placement?: TooltipPlacement | (() => TooltipPlacement);
  align?: TooltipAlign;
  offset?: number | ((targetRect: DOMRect) => number);
  getContent: () => TooltipBadgeContent | null;
};

type TooltipElements = {
  root: HTMLDivElement;
  card: HTMLDivElement;
  title: HTMLSpanElement;
  shortcut: HTMLSpanElement;
  description: HTMLSpanElement;
};

const TOOLTIP_STYLE_ID = 'tc-unified-tooltip-badge-style';
let sharedTooltipElements: TooltipElements | null = null;
let activeTooltipHide: (() => void) | null = null;

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const renderShortcut = (shortcut: string): string => shortcut
  .split('+')
  .map((part) => part.trim())
  .filter(Boolean)
  .map((part) => `<span class="tc-tooltip-badge__key">${escapeHtml(part)}</span>`)
  .join('<span class="tc-tooltip-badge__join">+</span>');

const ensureTooltipBadgeStyle = () => {
  if (document.getElementById(TOOLTIP_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TOOLTIP_STYLE_ID;
  style.textContent = `
    .tc-tooltip-badge {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 10050;
      pointer-events: none;
      opacity: 0;
      transform: translate3d(0, 0, 0) scale(0.98);
      transition: opacity 120ms ease, transform 120ms ease;
    }
    .tc-tooltip-badge[data-open="true"] {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
    }
    .tc-tooltip-badge__card {
      --tc-tooltip-arrow-size: 8px;
      --tc-tooltip-arrow-inset: 18px;
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      padding: 7px 10px;
      border: 1px solid #2f3746;
      border-radius: 8px;
      background: #1f2330;
      color: #f4f7ff;
      box-shadow: 0 14px 28px rgba(0, 0, 0, 0.34);
      font: 600 12px/1.2 'Segoe UI', Arial, sans-serif;
      white-space: nowrap;
      box-sizing: border-box;
    }
    .tc-tooltip-badge__card::after {
      content: '';
      position: absolute;
      width: var(--tc-tooltip-arrow-size);
      height: var(--tc-tooltip-arrow-size);
      background: #1f2330;
      border: 1px solid #2f3746;
      box-sizing: border-box;
      transform: rotate(45deg);
    }
    .tc-tooltip-badge[data-placement="right"] .tc-tooltip-badge__card::after {
      left: calc(var(--tc-tooltip-arrow-size) * -0.5);
      top: var(--tc-tooltip-arrow-inset);
      border-top: none;
      border-right: none;
    }
    .tc-tooltip-badge[data-placement="left"] .tc-tooltip-badge__card::after {
      right: calc(var(--tc-tooltip-arrow-size) * -0.5);
      top: var(--tc-tooltip-arrow-inset);
      border-left: none;
      border-bottom: none;
    }
    .tc-tooltip-badge[data-placement="bottom"] .tc-tooltip-badge__card::after {
      top: calc(var(--tc-tooltip-arrow-size) * -0.5);
      left: var(--tc-tooltip-arrow-inset);
      border-right: none;
      border-bottom: none;
    }
    .tc-tooltip-badge[data-placement="top"] .tc-tooltip-badge__card::after {
      bottom: calc(var(--tc-tooltip-arrow-size) * -0.5);
      left: var(--tc-tooltip-arrow-inset);
      border-top: none;
      border-left: none;
    }
    .tc-tooltip-badge__title {
      color: #f4f7ff;
    }
    .tc-tooltip-badge__shortcut {
      display: none;
      align-items: center;
      gap: 5px;
      color: #cad4e5;
      font-weight: 600;
    }
    .tc-tooltip-badge__shortcut[data-visible="true"] {
      display: inline-flex;
    }
    .tc-tooltip-badge__key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 20px;
      padding: 0 6px;
      border: 1px solid #596070;
      border-radius: 6px;
      background: #505665;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      box-sizing: border-box;
    }
    .tc-tooltip-badge__join,
    .tc-tooltip-badge__description {
      color: #d7dfef;
      font-weight: 600;
    }
    .tc-tooltip-badge__description {
      display: none;
    }
    .tc-tooltip-badge__description[data-visible="true"] {
      display: inline-flex;
    }
  `;
  document.head.appendChild(style);
};

const createTooltipElements = (): TooltipElements => {
  const root = document.createElement('div');
  root.className = 'tc-tooltip-badge';
  root.dataset.open = 'false';
  root.dataset.placement = 'right';

  const card = document.createElement('div');
  card.className = 'tc-tooltip-badge__card';

  const title = document.createElement('span');
  title.className = 'tc-tooltip-badge__title';

  const shortcut = document.createElement('span');
  shortcut.className = 'tc-tooltip-badge__shortcut';
  shortcut.dataset.visible = 'false';

  const description = document.createElement('span');
  description.className = 'tc-tooltip-badge__description';
  description.dataset.visible = 'false';

  card.append(title, shortcut, description);
  root.appendChild(card);
  document.body.appendChild(root);

  return { root, card, title, shortcut, description };
};

const getSharedTooltipElements = (): TooltipElements => {
  if (sharedTooltipElements) return sharedTooltipElements;
  sharedTooltipElements = createTooltipElements();
  return sharedTooltipElements;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const bindTooltipBadge = (
  target: HTMLElement,
  {
    placement = 'right',
    align = 'center',
    offset = 12,
    getContent,
  }: TooltipBadgeOptions,
): void => {
  ensureTooltipBadgeStyle();
  const els = getSharedTooltipElements();
  let open = false;

  const hide = () => {
    open = false;
    els.root.dataset.open = 'false';
    els.root.style.visibility = 'hidden';
    if (activeTooltipHide === hide) {
      activeTooltipHide = null;
    }
  };

  const positionTooltip = () => {
    const rect = target.getBoundingClientRect();
    const tipRect = els.root.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 8;
    const resolvedPlacement = typeof placement === 'function' ? placement() : placement;
    const resolvedOffset = typeof offset === 'function' ? offset(rect) : offset;
    let left = 0;
    let top = 0;
    let arrowInset = 18;

    if (resolvedPlacement === 'right' || resolvedPlacement === 'left') {
      top = align === 'start'
        ? rect.top
        : align === 'end'
          ? rect.bottom - tipRect.height
          : rect.top + ((rect.height - tipRect.height) / 2);
      top = clamp(top, margin, viewportH - tipRect.height - margin);
      left = resolvedPlacement === 'right'
        ? rect.right + resolvedOffset + 4
        : rect.left - tipRect.width - resolvedOffset - 4;
      left = clamp(left, margin, viewportW - tipRect.width - margin);
      arrowInset = clamp((rect.top + (rect.height / 2)) - top - 4, 10, Math.max(10, tipRect.height - 18));
    } else {
      left = align === 'start'
        ? rect.left
        : align === 'end'
          ? rect.right - tipRect.width
          : rect.left + ((rect.width - tipRect.width) / 2);
      left = clamp(left, margin, viewportW - tipRect.width - margin);
      top = resolvedPlacement === 'bottom'
        ? rect.bottom + resolvedOffset
        : rect.top - tipRect.height - resolvedOffset;
      top = clamp(top, margin, viewportH - tipRect.height - margin);
      arrowInset = clamp((rect.left + (rect.width / 2)) - left - 4, 12, Math.max(12, tipRect.width - 18));
    }

    els.root.style.left = `${Math.round(left)}px`;
    els.root.style.top = `${Math.round(top)}px`;
    els.root.dataset.placement = resolvedPlacement;
    els.card.style.setProperty('--tc-tooltip-arrow-inset', `${Math.round(arrowInset)}px`);
  };

  const show = () => {
    if (window.matchMedia && window.matchMedia('(hover: hover)').matches === false) return;
    if (activeTooltipHide && activeTooltipHide !== hide) {
      activeTooltipHide();
    }
    const content = getContent();
    if (!content?.title) {
      hide();
      return;
    }
    els.title.textContent = content.title;
    if (content.shortcut) {
      els.shortcut.innerHTML = renderShortcut(content.shortcut);
      els.shortcut.dataset.visible = 'true';
    } else {
      els.shortcut.innerHTML = '';
      els.shortcut.dataset.visible = 'false';
    }
    if (content.description) {
      els.description.textContent = content.description;
      els.description.dataset.visible = 'true';
    } else {
      els.description.textContent = '';
      els.description.dataset.visible = 'false';
    }
    els.root.style.visibility = 'hidden';
    els.root.dataset.open = 'false';
    els.root.style.left = '0px';
    els.root.style.top = '0px';
    open = true;
    activeTooltipHide = hide;
    requestAnimationFrame(() => {
      if (!open) return;
      positionTooltip();
      els.root.style.visibility = 'visible';
      els.root.dataset.open = 'true';
    });
  };

  if (target.title) {
    target.setAttribute('aria-label', target.getAttribute('aria-label') ?? target.title);
    target.removeAttribute('title');
  }

  target.addEventListener('mouseenter', show);
  target.addEventListener('mouseleave', hide);
  target.addEventListener('focus', show);
  target.addEventListener('blur', hide);
  target.addEventListener('pointerdown', hide);
  target.addEventListener('click', hide);
  target.addEventListener('touchstart', hide, { passive: true });
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  document.addEventListener('fullscreenchange', hide);
};
