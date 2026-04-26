type BindPaneEventHandlersArgs<TTimeframe extends string> = {
  symBtn: HTMLButtonElement;
  tfSelect: HTMLSelectElement;
  indBtn: HTMLButtonElement;
  strategyBtn: HTMLButtonElement;
  strategyReportBtn: HTMLButtonElement;
  strategyDeleteBtn?: HTMLButtonElement;
  minBtn: HTMLButtonElement;
  maxBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
  onSymbolClick: () => void;
  onTimeframeChange: (timeframe: TTimeframe) => void;
  onIndicatorClick: () => void;
  onStrategyClick: () => void;
  onStrategyReportClick: () => void;
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
  strategyReportBtn,
  strategyDeleteBtn,
  minBtn,
  maxBtn,
  closeBtn,
  onSymbolClick,
  onTimeframeChange,
  onIndicatorClick,
  onStrategyClick,
  onStrategyReportClick,
  onStrategyDeleteClick,
  onMinimizeClick,
  onMaximizeClick,
  onCloseClick,
}: BindPaneEventHandlersArgs<TTimeframe>): void {
  symBtn.addEventListener('click', onSymbolClick);
  tfSelect.addEventListener('change', () => onTimeframeChange(tfSelect.value as TTimeframe));
  indBtn.addEventListener('click', onIndicatorClick);
  strategyBtn.addEventListener('click', onStrategyClick);
  strategyReportBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    onStrategyReportClick();
  });
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
