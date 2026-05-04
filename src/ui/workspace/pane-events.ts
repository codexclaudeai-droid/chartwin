type BindPaneEventHandlersArgs<TTimeframe extends string> = {
  symBtn: HTMLButtonElement;
  tfSelect: HTMLSelectElement;
  indBtn: HTMLButtonElement;
  strategyBtn: HTMLButtonElement;
  strategyDeleteBtn?: HTMLButtonElement;
  minBtn: HTMLButtonElement;
  maxBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
  onSymbolClick: () => void;
  onTimeframeChange: (timeframe: TTimeframe) => void;
  onIndicatorClick: () => void;
  onStrategyClick: () => void;
  onStrategyDeleteClick?: () => void;
  onMinimizeClick: () => void;
  onMaximizeClick: () => void;
  onCloseClick: () => void;
};

export function bindPaneEventHandlers<TTimeframe extends string>({
  symBtn,
  tfSelect,
  indBtn,
  strategyBtn,
  strategyDeleteBtn,
  minBtn,
  maxBtn,
  closeBtn,
  onSymbolClick,
  onTimeframeChange,
  onIndicatorClick,
  onStrategyClick,
  onStrategyDeleteClick,
  onMinimizeClick,
  onMaximizeClick,
  onCloseClick,
}: BindPaneEventHandlersArgs<TTimeframe>): void {
  symBtn.addEventListener('click', onSymbolClick);
  tfSelect.addEventListener('change', () => onTimeframeChange(tfSelect.value as TTimeframe));
  indBtn.addEventListener('click', onIndicatorClick);
  strategyBtn.addEventListener('click', onStrategyClick);
  if (strategyDeleteBtn && onStrategyDeleteClick) {
    strategyDeleteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      onStrategyDeleteClick();
    });
  }
  minBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    onMinimizeClick();
  });
  maxBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    onMaximizeClick();
  });
  closeBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    onCloseClick();
  });
}
