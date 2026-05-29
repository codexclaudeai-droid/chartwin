'use client';

import { useEffect, useRef } from 'react';

export function ChartRuntime() {
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    void import('../../src/main.ts');
  }, []);

  return (
    <main className="chart-runtime-page" aria-label="TC Chart 런타임">
      <div id="app" className="chart-runtime-root" />
    </main>
  );
}

