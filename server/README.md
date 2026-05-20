# Data Gateway (Webhook/API 전환형)

테스트용 데이터 수신 모듈입니다.
관리자 API로 시장별 provider를 바꿀 수 있습니다.

- `crypto`: 기본 `binance`
- `futures`, `index`, `commodity`, `fx`: 기본 `webhook`
- KIS는 보류/선택 옵션입니다. `symbolProviders`에 명시한 심볼만 `kis`로 라우팅됩니다.
- `NQ1!`/`NAS100`: 기본 `index` provider를 따르므로 TradingView 웹훅 수신에 적합합니다.

## 1) 실행

```bash
npm run backend:dev
```

기본 주소: `http://localhost:8787`

## 2) 설정 파일

`server/config/runtime-config.json`

```json
{
  "adminToken": "change-me-admin-token",
  "webhookPassphrase": "change-me-webhook-passphrase",
  "providers": {
    "crypto": "binance",
    "futures": "webhook",
    "index": "webhook",
    "commodity": "webhook",
    "fx": "webhook"
  },
  "symbolProviders": {},
  "kis": {
    "symbols": {
      "NDX": { "code": "DNASNDX" },
      "NASDAQ": { "code": "DNASCOMP" },
      "NQ1!": { "code": "NQ", "matchPrefix": true }
    }
  }
}
```

캔들 데이터는 `server/data/candles-db.json`에 자동 저장되며, 백엔드 재시작 시 자동 복구됩니다.

KIS 웹소켓은 `symbolProviders`에서 특정 심볼을 `kis`로 지정하고, `KIS_APP_KEY`/`KIS_APP_SECRET` 환경변수로 웹소켓 접속키를 자동 발급받거나 `KIS_WS_APPROVAL_KEY`를 직접 넣으면 시작됩니다.
KIS에서 수신한 tick은 완성된 1분봉을 기다리지 않고 현재 1분 bucket의 `high/low/close`를 즉시 갱신합니다.
`NQ1!`을 KIS로 직접 받을 수도 있지만, CME 유료시세 신청이 필요할 수 있으므로 기본 운용은 TradingView 웹훅을 권장합니다.
`NDX`/`NASDAQ` 등을 KIS로 전환하려면 `symbolProviders.index.NDX = "kis"`처럼 명시하고, KIS 종목코드는 계정 권한 또는 KIS 종목 마스터에 맞게 `kis.symbols.<symbol>.code`를 교체하면 됩니다.

## 3) 관리자: provider 변경

`POST /admin/provider`

```json
{
  "market": "futures",
  "provider": "api"
}
```

헤더: `x-admin-token: <adminToken>`

## 4) TradingView 웹훅 수신

`POST /ingest/webhook/tradingview`

```json
{
  "passphrase": "change-me-webhook-passphrase",
  "market": "futures",
  "symbol": "NAS100",
  "timeframe": "1m",
  "candles": [
    {
      "time": 1713916800,
      "open": 18234.1,
      "high": 18236.7,
      "low": 18230.4,
      "close": 18235.8,
      "volume": 1200
    }
  ]
}
```

주의: 해당 `market` provider가 `webhook` 이어야 수신됩니다.

## 5) API 방식 수신

`POST /ingest/api/candles`

헤더: `x-admin-token: <adminToken>`

```json
{
  "market": "futures",
  "symbol": "NAS100",
  "timeframe": "1m",
  "candles": [
    {
      "time": 1713916860,
      "open": 18235.8,
      "high": 18238.1,
      "low": 18235.0,
      "close": 18237.4,
      "volume": 870
    }
  ]
}
```

주의: 해당 `market` provider가 `api` 또는 `binance` 일 때만 허용됩니다.

## 6) 차트 조회

`GET /candles?market=futures&symbol=NAS100&timeframe=1m&limit=300`

프론트는 이 엔드포인트만 바라보면, 내부 provider 전환과 분리됩니다.

추가: 서버는 `1m` 데이터가 존재하면 요청 `timeframe`이 `5m/15m/30m/1h/2h/4h/1d/1w/1M`일 때 자동 집계해서 반환합니다.
즉, 수집은 `1m`만 해도 상위 타임프레임 렌더링이 가능합니다.

원본 조회 모드: `raw=1`을 붙이면 집계/공백 보간 없이 저장 원본 그대로 반환합니다.
예: `GET /candles?market=index&symbol=NAS100&timeframe=1m&limit=300&raw=1`

## 7) 데이터 초기화(관리자)

`DELETE /admin/candles?market=index&symbol=NDX&timeframe=1m`

헤더: `x-admin-token: <adminToken>`

특정 market/symbol/timeframe 키의 저장 캔들을 초기화합니다.
