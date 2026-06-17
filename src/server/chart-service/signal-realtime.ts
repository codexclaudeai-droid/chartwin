import type { SignalEventRecord } from './repository.ts';

export type SignalRealtimeEvent = {
  type: 'signals.changed';
  signalEvent: SignalEventRecord;
  emittedAt: string;
};

export type SignalRealtimeFilters = {
  strategyId?: string | null;
  symbolId?: string | null;
  timeframe?: string | null;
};

export type SignalRealtimeStreamOptions = {
  heartbeatMs?: number | null;
  now?: () => string;
  signal?: AbortSignal;
};

type SignalRealtimeSubscriber = {
  filters: SignalRealtimeFilters;
  send: (eventName: string, payload: Record<string, unknown>) => boolean;
  close: () => void;
};

const DEFAULT_HEARTBEAT_MS = 25 * 1000;
const signalSubscribers = new Set<SignalRealtimeSubscriber>();
const textEncoder = new TextEncoder();

export function createSignalRealtimeStream(
  filters: SignalRealtimeFilters = {},
  options: SignalRealtimeStreamOptions = {},
): ReadableStream<Uint8Array> {
  const heartbeatMs = options.heartbeatMs === undefined ? DEFAULT_HEARTBEAT_MS : options.heartbeatMs;
  const now = options.now ?? (() => new Date().toISOString());
  let cleanup: () => void = () => {};

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;
      let heartbeatId: ReturnType<typeof setInterval> | null = null;

      const subscriber: SignalRealtimeSubscriber = {
        filters: normalizeSignalRealtimeFilters(filters),
        send(eventName, payload) {
          if (isClosed) return false;
          try {
            controller.enqueue(encodeSseEvent(eventName, payload));
            return true;
          } catch {
            cleanup();
            return false;
          }
        },
        close() {
          cleanup();
        },
      };

      cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        if (heartbeatId) clearInterval(heartbeatId);
        options.signal?.removeEventListener('abort', cleanup);
        signalSubscribers.delete(subscriber);
        try {
          controller.close();
        } catch {
          // The stream may already be canceled by the client.
        }
      };

      signalSubscribers.add(subscriber);
      options.signal?.addEventListener('abort', cleanup, { once: true });
      controller.enqueue(textEncoder.encode('retry: 5000\n\n'));
      subscriber.send('signals.ready', {
        type: 'signals.ready',
        emittedAt: now(),
      });

      if (heartbeatMs !== null && heartbeatMs > 0) {
        heartbeatId = setInterval(() => {
          if (!subscriber.send('signals.heartbeat', {
            type: 'signals.heartbeat',
            emittedAt: now(),
          })) {
            cleanup();
          }
        }, heartbeatMs);
      }
    },
    cancel() {
      cleanup();
    },
  });
}

export function publishSignalRealtimeEvent(signalEvent: SignalEventRecord): number {
  const event: SignalRealtimeEvent = {
    type: 'signals.changed',
    signalEvent,
    emittedAt: new Date().toISOString(),
  };

  let deliveredCount = 0;
  for (const subscriber of [...signalSubscribers]) {
    if (!matchesSignalRealtimeFilters(signalEvent, subscriber.filters)) continue;
    if (subscriber.send('signals.changed', event)) {
      deliveredCount += 1;
    } else {
      signalSubscribers.delete(subscriber);
    }
  }
  return deliveredCount;
}

export function getSignalRealtimeSubscriberCount(): number {
  return signalSubscribers.size;
}

function normalizeSignalRealtimeFilters(filters: SignalRealtimeFilters): SignalRealtimeFilters {
  return {
    strategyId: normalizeText(filters.strategyId),
    symbolId: normalizeText(filters.symbolId)?.toUpperCase() ?? null,
    timeframe: normalizeText(filters.timeframe),
  };
}

function matchesSignalRealtimeFilters(
  signalEvent: SignalEventRecord,
  filters: SignalRealtimeFilters,
): boolean {
  if (filters.strategyId && signalEvent.strategyId !== filters.strategyId) return false;
  if (filters.symbolId && signalEvent.symbolId.toUpperCase() !== filters.symbolId) return false;
  if (filters.timeframe && signalEvent.timeframe !== filters.timeframe) return false;
  return true;
}

function normalizeText(value: string | null | undefined): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

function encodeSseEvent(eventName: string, payload: Record<string, unknown>): Uint8Array {
  return textEncoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
}
