export type PaneLike = {
  chartArea: HTMLDivElement;
  chart: { resize: () => void };
  refreshHeader: () => void;
  refreshChartUi: () => void;
  startLive: () => void;
  stopLive: () => void;
};

export type PaneManagerState = {
  splitCount: number;
  splitPreset: number;
  splitOrientation: 'cols' | 'rows';
  activePaneId: number;
  maximizedPaneId: number | null;
  currentVisiblePaneIds: number[];
  minimizedPaneIds: Set<number>;
  closedPaneIds: Set<number>;
  allPaneIds: number[];
  splitPresets: readonly number[];
};

export function updateGridByCount(grid: HTMLDivElement, count: number, orientation: 'cols' | 'rows' = 'cols'): void {
  if (count <= 1) {
    grid.style.gridTemplateColumns = '1fr';
    grid.style.gridTemplateRows = '1fr';
    return;
  }
  if (count <= 2) {
    if (orientation === 'rows') {
      grid.style.gridTemplateColumns = '1fr';
      grid.style.gridTemplateRows = '1fr 1fr';
    } else {
      grid.style.gridTemplateColumns = '1fr 1fr';
      grid.style.gridTemplateRows = '1fr';
    }
    return;
  }
  if (count <= 4) {
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gridTemplateRows = '1fr 1fr';
    return;
  }
  if (count <= 6) {
    grid.style.gridTemplateColumns = '1fr 1fr 1fr';
    grid.style.gridTemplateRows = '1fr 1fr';
    return;
  }
  grid.style.gridTemplateColumns = '1fr 1fr 1fr 1fr';
  grid.style.gridTemplateRows = '1fr 1fr';
}

export function applyActivePaneOutline(args: {
  paneSlots: HTMLDivElement[];
  currentVisiblePaneIds: number[];
  activePaneId: number;
}) {
  const { paneSlots, currentVisiblePaneIds, activePaneId } = args;
  const visibleCount = currentVisiblePaneIds
    .filter((id) => paneSlots[id].style.display !== 'none')
    .length;
  const shouldShowActiveOutline = visibleCount > 1;
  paneSlots.forEach((slot, index) => {
    const isVisible = currentVisiblePaneIds.includes(index) && slot.style.display !== 'none';
    if (isVisible && index === activePaneId && shouldShowActiveOutline) {
      slot.style.borderColor = '#4f8cff';
      slot.style.boxShadow = 'inset 0 0 0 2px rgba(79,140,255,0.7), 0 0 0 1px rgba(79,140,255,0.5)';
      slot.style.outline = '2px solid rgba(79,140,255,0.9)';
      slot.style.outlineOffset = '-2px';
      slot.style.zIndex = '2';
    } else if (isVisible) {
      slot.style.borderColor = '#2a2e3e';
      slot.style.boxShadow = 'none';
      slot.style.outline = 'none';
      slot.style.zIndex = '1';
    } else {
      slot.style.borderColor = '#2a2e3e';
      slot.style.boxShadow = 'none';
      slot.style.outline = 'none';
      slot.style.zIndex = '1';
    }
  });
}

export function createPaneManager(args: {
  state: PaneManagerState;
  paneSlots: HTMLDivElement[];
  ensurePane: (paneId: number) => PaneLike;
  getPaneIfAny: (paneId: number) => PaneLike | undefined;
  refreshTopControlIcons: () => void;
  updateGridByCount: (count: number, orientation?: 'cols' | 'rows') => void;
}) {
  const {
    state,
    paneSlots,
    ensurePane,
    getPaneIfAny,
    refreshTopControlIcons,
    updateGridByCount: updateGrid,
  } = args;

  const setActivePane = (paneId: number) => {
    state.activePaneId = paneId;
    const visibleCount = state.currentVisiblePaneIds
      .filter((id) => paneSlots[id].style.display !== 'none')
      .length;
    const shouldShowActiveOutline = visibleCount > 1;
    paneSlots.forEach((slot, index) => {
      const isVisible = state.currentVisiblePaneIds.includes(index) && slot.style.display !== 'none';
      if (isVisible && index === paneId && shouldShowActiveOutline) {
        slot.style.borderColor = '#4f8cff';
        slot.style.boxShadow = 'inset 0 0 0 2px rgba(79,140,255,0.7), 0 0 0 1px rgba(79,140,255,0.5)';
        slot.style.outline = '2px solid rgba(79,140,255,0.9)';
        slot.style.outlineOffset = '-2px';
        slot.style.zIndex = '2';
      } else if (isVisible) {
        slot.style.borderColor = '#2a2e3e';
        slot.style.boxShadow = 'none';
        slot.style.outline = 'none';
        slot.style.zIndex = '1';
      } else {
        slot.style.borderColor = '#2a2e3e';
        slot.style.boxShadow = 'none';
        slot.style.outline = 'none';
        slot.style.zIndex = '1';
      }
    });
  };

  const renderPaneVisibility = () => {
    const maximizedVisible = state.maximizedPaneId !== null && state.currentVisiblePaneIds.includes(state.maximizedPaneId);
    const renderIds = maximizedVisible ? [state.maximizedPaneId!] : [...state.currentVisiblePaneIds];
    updateGrid(renderIds.length, state.splitOrientation);

    for (let i = 0; i < paneSlots.length; i += 1) {
      const slot = paneSlots[i];
      if (renderIds.includes(i)) {
        slot.style.display = 'block';
        const pane = ensurePane(i);
        if (state.minimizedPaneIds.has(i)) {
          pane.chartArea.style.display = 'none';
          pane.stopLive();
          pane.refreshHeader();
        } else {
          pane.chartArea.style.display = 'block';
          pane.startLive();
          pane.refreshChartUi();
          pane.chart.resize();
        }
      } else {
        slot.style.display = 'none';
        const pane = getPaneIfAny(i);
        pane?.stopLive();
      }
    }

    if (!renderIds.includes(state.activePaneId)) {
      state.activePaneId = renderIds[0] ?? 0;
    }
    setActivePane(state.activePaneId);
    window.setTimeout(() => {
      renderIds.forEach((paneId) => {
        const pane = ensurePane(paneId);
        pane.chart.resize();
        pane.refreshChartUi();
      });
    }, 40);
    refreshTopControlIcons();
  };

  const applySplitLayout = (
    count: number,
    options: { resetClosed?: boolean; updatePreset?: boolean; orientation?: 'cols' | 'rows' } = {},
  ) => {
    if (options.resetClosed) {
      state.closedPaneIds.clear();
      state.minimizedPaneIds.clear();
      state.maximizedPaneId = null;
    }

    const availableIds = state.allPaneIds.filter((id) => !state.closedPaneIds.has(id));
    if (!availableIds.length) {
      state.closedPaneIds.clear();
      availableIds.push(0);
    }

    const targetCount = Math.max(1, Math.min(count, availableIds.length));
    state.splitCount = targetCount;
    state.splitOrientation = targetCount === 2 ? (options.orientation ?? 'cols') : 'cols';
    state.currentVisiblePaneIds = availableIds.slice(0, targetCount);
    if (options.updatePreset && state.splitPresets.includes(targetCount)) {
      state.splitPreset = targetCount;
    }
    renderPaneVisibility();
  };

  const togglePaneMinimize = (paneId: number) => {
    if (state.minimizedPaneIds.has(paneId)) state.minimizedPaneIds.delete(paneId);
    else state.minimizedPaneIds.add(paneId);
    renderPaneVisibility();
  };

  const togglePaneMaximize = (paneId: number) => {
    if (state.maximizedPaneId === paneId) state.maximizedPaneId = null;
    else state.maximizedPaneId = paneId;
    setActivePane(paneId);
    renderPaneVisibility();
  };

  const closePane = (paneId: number) => {
    if (!state.currentVisiblePaneIds.includes(paneId)) return;
    if (state.splitCount <= 1) {
      state.minimizedPaneIds.add(paneId);
      state.maximizedPaneId = null;
      renderPaneVisibility();
      return;
    }
    state.closedPaneIds.add(paneId);
    state.minimizedPaneIds.delete(paneId);
    if (state.maximizedPaneId === paneId) state.maximizedPaneId = null;
    applySplitLayout(state.splitCount - 1, { resetClosed: false, updatePreset: false });
  };

  return {
    setActivePane,
    renderPaneVisibility,
    applySplitLayout,
    togglePaneMinimize,
    togglePaneMaximize,
    closePane,
  };
}
