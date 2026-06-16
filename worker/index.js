import * as candlesRoute from '../functions/candles.js';
import * as adminPassphraseRoute from '../functions/admin/passphrase.js';
import * as adminStrategiesRoute from '../functions/admin/strategies.js';
import * as adminSymbolsRoute from '../functions/admin/symbols.js';
import * as adminValidateRoute from '../functions/admin/validate.js';
import * as tradingViewWebhookRoute from '../functions/ingest/webhook/tradingview.js';

const ROUTES = new Map([
  ['/candles', {
    GET: candlesRoute.onRequestGet,
    OPTIONS: candlesRoute.onRequestOptions,
  }],
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
  ['/ingest/webhook/tradingview', {
    POST: tradingViewWebhookRoute.onRequestPost,
    OPTIONS: tradingViewWebhookRoute.onRequestOptions,
  }],
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

    if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') {
      return missingAssetsBinding();
    }
    return env.ASSETS.fetch(request);
  },
};
