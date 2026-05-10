const KIS_REAL_WS_URL = 'wss://ops.koreainvestment.com:21000';
const KIS_MOCK_WS_URL = 'wss://vops.koreainvestment.com:31000';
const KIS_REAL_REST_BASE_URL = 'https://openapi.koreainvestment.com:9443';
const KIS_MOCK_REST_BASE_URL = 'https://openapivts.koreainvestment.com:29443';

const DEFAULT_INDEX_SYMBOLS = {
  KOSPI: { trId: 'H0UPCNT0', code: '0001', kind: 'domestic-index' },
  KOSPI200: { trId: 'H0UPCNT0', code: '2001', kind: 'domestic-index' },
  KOSDAQ: { trId: 'H0UPCNT0', code: '1001', kind: 'domestic-index' },
  NDX: { trId: 'HDFSCNT0', code: 'DNASNDX', kind: 'overseas-stock-index' },
  NASDAQ: { trId: 'HDFSCNT0', code: 'DNASCOMP', kind: 'overseas-stock-index' },
  IXIC: { trId: 'HDFSCNT0', code: 'DNASCOMP', kind: 'overseas-stock-index' },
  'NQ1!': { trId: 'HDFFF020', code: 'NQ', kind: 'overseas-future', matchPrefix: true },
};

const FIELD_MAPS = {
  'domestic-index': {
    code: 0,
    time: 1,
    price: 2,
    volume: 5,
    open: 10,
    high: 11,
    low: 12,
  },
  'overseas-stock-index': {
    code: 0,
    date: 3,
    time: 4,
    kstDate: 5,
    kstTime: 6,
    open: 7,
    high: 8,
    low: 9,
    price: 10,
    volume: 19,
  },
  'overseas-future': {
    code: 0,
    date: 7,
    time: 8,
    price: 10,
    tickVolume: 11,
    open: 14,
    high: 15,
    low: 16,
    volume: 17,
  },
};

function normalizeSymbol(input) {
  return String(input || '').trim().toUpperCase().replace(/\s+/g, '');
}

function parseBoolean(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function parseNumber(value) {
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
}

function getKstDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || '01';
  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
  };
}

function parseKisTimeToEpochSec(value, fallbackDate = new Date(), dateValue = '') {
  const raw = String(value || '').replace(/\D/g, '');
  const hhmmss = raw.length >= 6 ? raw.slice(0, 6) : '';
  if (!hhmmss) return Math.floor(fallbackDate.getTime() / 1000);

  const hour = Number(hhmmss.slice(0, 2));
  const minute = Number(hhmmss.slice(2, 4));
  const second = Number(hhmmss.slice(4, 6));
  if (![hour, minute, second].every(Number.isFinite)) return Math.floor(fallbackDate.getTime() / 1000);

  const dateRaw = String(dateValue || '').replace(/\D/g, '');
  const hasDate = dateRaw.length >= 8;
  const fallbackParts = getKstDateParts(fallbackDate);
  const year = hasDate ? Number(dateRaw.slice(0, 4)) : fallbackParts.year;
  const month = hasDate ? Number(dateRaw.slice(4, 6)) : fallbackParts.month;
  const day = hasDate ? Number(dateRaw.slice(6, 8)) : fallbackParts.day;
  const utcMs = Date.UTC(year, month - 1, day, hour - 9, minute, second, 0);
  return Math.floor(utcMs / 1000);
}

function normalizeTickToCandle(symbol, fields, symbolConfig) {
  const kind = symbolConfig.kind || 'domestic-index';
  const map = FIELD_MAPS[kind] || FIELD_MAPS['domestic-index'];
  const price = parseNumber(fields[symbolConfig.priceField ?? map.price]);
  if (!Number.isFinite(price) || price <= 0) return null;

  const timeSec = parseKisTimeToEpochSec(
    fields[symbolConfig.timeField ?? map.time],
    new Date(),
    fields[symbolConfig.dateField ?? symbolConfig.kstDateField ?? map.kstDate ?? map.date],
  );
  const volume = parseNumber(fields[symbolConfig.volumeField ?? map.volume]);
  const tickVolume = parseNumber(fields[symbolConfig.tickVolumeField ?? map.tickVolume]);
  return {
    market: 'index',
    symbol,
    timeframe: '1m',
    candle: {
      time: Math.floor(timeSec / 60) * 60,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: Number.isFinite(tickVolume) ? tickVolume : (Number.isFinite(volume) ? volume : 0),
    },
  };
}

function mergeKisConfig(config = {}) {
  const rawSymbols = config.symbols && typeof config.symbols === 'object' ? config.symbols : {};
  const symbols = {};
  for (const [symbol, defaultConfig] of Object.entries(DEFAULT_INDEX_SYMBOLS)) {
    const override = rawSymbols[symbol] && typeof rawSymbols[symbol] === 'object' ? rawSymbols[symbol] : {};
    symbols[symbol] = {
      ...defaultConfig,
      ...override,
      trId: String(override.trId || defaultConfig.trId),
      code: String(override.code || defaultConfig.code),
      kind: String(override.kind || defaultConfig.kind || 'domestic-index'),
      priceScale: Number.isFinite(Number(override.priceScale)) ? Number(override.priceScale) : (defaultConfig.priceScale || 1),
    };
  }
  return {
    useMock: parseBoolean(process.env.KIS_USE_MOCK) || Boolean(config.useMock),
    appKey: process.env.KIS_APP_KEY || String(config.appKey || ''),
    appSecret: process.env.KIS_APP_SECRET || String(config.appSecret || ''),
    approvalKey: process.env.KIS_WS_APPROVAL_KEY || String(config.approvalKey || ''),
    reconnectMs: Math.max(1_000, Number(config.reconnectMs || process.env.KIS_RECONNECT_MS || 5_000)),
    symbols,
  };
}

export function hasKisCredentials(config = {}) {
  const merged = mergeKisConfig(config);
  return Boolean(merged.approvalKey || (merged.appKey && merged.appSecret));
}

async function fetchApprovalKey(config) {
  if (config.approvalKey) return config.approvalKey;
  if (!config.appKey || !config.appSecret) {
    throw new Error('KIS_APP_KEY/KIS_APP_SECRET or KIS_WS_APPROVAL_KEY is required');
  }

  const baseUrl = config.useMock ? KIS_MOCK_REST_BASE_URL : KIS_REAL_REST_BASE_URL;
  const response = await fetch(`${baseUrl}/oauth2/Approval`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: config.appKey,
      secretkey: config.appSecret,
    }),
  });
  if (!response.ok) {
    throw new Error(`KIS approval key error: ${response.status}`);
  }
  const json = await response.json();
  const approvalKey = String(json.approval_key || '');
  if (!approvalKey) throw new Error('KIS approval key response did not include approval_key');
  return approvalKey;
}

export function createKisWebSocketCollector({ config, getEnabledSymbols, applyLiveCandle }) {
  const kisConfig = mergeKisConfig(config);
  let socket = null;
  let reconnectTimer = null;
  let stopped = false;
  let activeApprovalKey = '';

  const closeSocket = () => {
    if (!socket) return;
    const current = socket;
    socket = null;
    try {
      current.close();
    } catch {
      // Ignore close errors during reconnect.
    }
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer != null) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, kisConfig.reconnectMs);
  };

  const subscribe = () => {
    const enabled = getEnabledSymbols()
      .map(normalizeSymbol)
      .filter((symbol) => kisConfig.symbols[symbol]);
    if (!socket || socket.readyState !== WebSocket.OPEN || !activeApprovalKey || !enabled.length) return;

    for (const symbol of enabled) {
      const symbolConfig = kisConfig.symbols[symbol];
      socket.send(JSON.stringify({
        header: {
          approval_key: activeApprovalKey,
          custtype: 'P',
          tr_type: '1',
          'content-type': 'utf-8',
        },
        body: {
          input: {
            tr_id: symbolConfig.trId,
            tr_key: symbolConfig.code,
          },
        },
      }));
    }
    console.log(`[kis-ws] subscribed: ${enabled.join(', ')}`);
  };

  const handleDelimitedMessage = (message) => {
    const parts = message.split('|');
    if (parts.length < 4 || parts[0] !== '0') return;
    const trId = parts[1];
    const payload = parts.slice(3).join('|');
    const fields = payload.split('^');

    const matchingSymbols = Object.entries(kisConfig.symbols)
      .filter(([, symbolConfig]) => symbolConfig.trId === trId);
    if (!matchingSymbols.length) return;

    for (const [symbol, symbolConfig] of matchingSymbols) {
      const code = fields[0] || '';
      if (symbolConfig.code && code) {
        const expected = String(symbolConfig.code);
        const matched = symbolConfig.matchPrefix ? code.startsWith(expected) : code === expected;
        if (!matched) continue;
      }
      const normalized = normalizeTickToCandle(symbol, fields, symbolConfig);
      if (!normalized) continue;
      applyLiveCandle(normalized.market, normalized.symbol, normalized.timeframe, normalized.candle);
    }
  };

  const handleMessage = (event) => {
    const message = typeof event.data === 'string' ? event.data : '';
    if (!message) return;
    if (message.startsWith('0|')) {
      handleDelimitedMessage(message);
      return;
    }
    try {
      const json = JSON.parse(message);
      if (json?.header?.tr_id || json?.body?.msg1) {
        const trId = json.header?.tr_id || 'KIS';
        const messageText = json.body?.msg1 || json.body?.msg_cd || 'ack';
        console.log(`[kis-ws] ${trId}: ${messageText}`);
      }
    } catch {
      // KIS may send non-JSON control frames; they are not fatal.
    }
  };

  async function connect() {
    if (stopped) return;
    if (typeof WebSocket !== 'function') {
      console.error('[kis-ws] global WebSocket is not available in this Node runtime');
      return;
    }

    try {
      activeApprovalKey = await fetchApprovalKey(kisConfig);
      const url = kisConfig.useMock ? KIS_MOCK_WS_URL : KIS_REAL_WS_URL;
      closeSocket();
      socket = new WebSocket(url);
      socket.addEventListener('open', subscribe);
      socket.addEventListener('message', handleMessage);
      socket.addEventListener('error', (error) => {
        console.error('[kis-ws] socket error:', error?.message || error);
      });
      socket.addEventListener('close', () => {
        if (!stopped) {
          console.warn('[kis-ws] socket closed; reconnect scheduled');
          scheduleReconnect();
        }
      });
    } catch (error) {
      console.error('[kis-ws] connect failed:', error.message);
      scheduleReconnect();
    }
  }

  return {
    start() {
      stopped = false;
      void connect();
    },
    stop() {
      stopped = true;
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      closeSocket();
    },
    resubscribe() {
      subscribe();
    },
  };
}
