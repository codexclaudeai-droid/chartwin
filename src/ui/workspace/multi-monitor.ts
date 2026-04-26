export type PopoutPaneInfo = {
  symbol: string;
  timeframe: string;
};

type OpenMultiMonitorPopoutsArgs = {
  sourceUrl: string;
  panes: PopoutPaneInfo[];
};

export function openMultiMonitorPopouts({
  sourceUrl,
  panes,
}: OpenMultiMonitorPopoutsArgs): void {
  for (let i = 0; i < panes.length; i += 1) {
    const pane = panes[i];
    const next = new URL(sourceUrl);
    next.searchParams.set('popout', '1');
    next.searchParams.set('pane', String(i + 1));
    next.searchParams.set('symbol', pane.symbol);
    next.searchParams.set('tf', pane.timeframe);
    const left = 60 + i * 42;
    const top = 60 + i * 24;
    window.open(next.toString(), `chart_popout_${Date.now()}_${i}`, `popup=yes,width=1080,height=760,left=${left},top=${top}`);
  }
}
