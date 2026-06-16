import * as adminPassphraseRoute from '../functions/admin/passphrase.js';
import * as adminStrategiesRoute from '../functions/admin/strategies.js';
import * as adminSymbolsRoute from '../functions/admin/symbols.js';
import * as adminValidateRoute from '../functions/admin/validate.js';

const ROUTES = new Map([
  ['/admin/passphrase', {
    POST: adminPassphraseRoute.onRequestPost,
    OPTIONS: adminPassphraseRoute.onRequestOptions,
  }],
  ['/admin/strategies', {
    GET: adminStrategiesRoute.onRequestGet,
    POST: adminStrategiesRoute.onRequestPost,
    OPTIONS: adminStrategiesRoute.onRequestOptions,
  }],
  ['/admin/symbols', {
    GET: adminSymbolsRoute.onRequestGet,
    POST: adminSymbolsRoute.onRequestPost,
    OPTIONS: adminSymbolsRoute.onRequestOptions,
  }],
  ['/admin/validate', {
    POST: adminValidateRoute.onRequestPost,
    OPTIONS: adminValidateRoute.onRequestOptions,
  }],
]);

const DATA_GATEWAY_PATHS = new Set([
  '/health',
  '/candles',
  '/stream',
  '/report/candles',
  '/admin/config',
  '/admin/provider',
  '/admin/mt45',
  '/admin/candles',
  '/ingest/api/candles',
  '/ingest/mt45/tick',
  '/ingest/webhook/tradingview',
]);

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function methodNotAllowed(allowedMethods) {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: allowedMethods.join(', '),
    },
  });
}

function missingAssetsBinding() {
  return new Response('ASSETS binding missing', { status: 500 });
}

function missingDataGatewayBinding() {
  return Response.json({
    ok: false,
    message: 'DATA_GATEWAY_URL missing',
  }, { status: 503 });
}

function isDataGatewayRoute(pathname) {
  return DATA_GATEWAY_PATHS.has(pathname);
}

function buildDataGatewayUrl(baseUrl, pathname, search) {
  return `${String(baseUrl || '').trim().replace(/\/+$/, '')}${pathname}${search}`;
}

async function proxyToDataGateway(request, env) {
  const configuredBaseUrl = typeof env?.DATA_GATEWAY_URL === 'string' ? env.DATA_GATEWAY_URL.trim() : '';
  if (!configuredBaseUrl) {
    return missingDataGatewayBinding();
  }

  const incomingUrl = new URL(request.url);
  const targetUrl = buildDataGatewayUrl(configuredBaseUrl, incomingUrl.pathname, incomingUrl.search);
  return fetch(new Request(targetUrl, request));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = normalizePathname(url.pathname);
    const route = ROUTES.get(pathname);

    if (route) {
      const handler = route[request.method.toUpperCase()];
      if (!handler) {
        return methodNotAllowed(Object.keys(route));
      }
      return handler({
        request,
        env,
        waitUntil: ctx?.waitUntil?.bind(ctx),
      });
    }

    if (isDataGatewayRoute(pathname)) {
      return proxyToDataGateway(request, env);
    }

    if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') {
      return missingAssetsBinding();
    }
    return env.ASSETS.fetch(request);
  },
};
