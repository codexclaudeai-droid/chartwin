# TradingCore MT5 Backfill Script

`TradingCoreBackfill.mq5` reads historical candles from MT5 with `CopyRates()` and sends them to the data gateway endpoint:

`POST /ingest/mt45/backfill`

## Recommended Inputs

- `IngestUrl`: `http://127.0.0.1:8787/ingest/mt45/backfill` on the AWS Windows server.
- `ApiKey`: the MT5 EA API key configured in the admin data collection page.
- `Market`: use the MT-facing label, for example `Index Futures` or `Commodity`.
- `SymbolAlias`: leave empty to use the current chart symbol, or set a server-facing alias such as `NAS100 Futures`.
- `BackfillTimeframe`: normally `PERIOD_M1`.
- `FromTime` / `ToTime`: explicit range. If `FromTime` is empty, the script uses `LookbackDays`.
- `LookbackDays`: fallback range when `FromTime` is not set.
- `BatchSize`: 500-1000 is a safe first range for EC2 t3.micro/t3.small.
- `SourceUtcOffsetHours`: set only if the broker candle time needs UTC correction before storage.

## MT5 Setup

Add the gateway URL host to MT5:

`Tools > Options > Expert Advisors > Allow WebRequest for listed URL`

For local gateway on the same AWS server, add:

`http://127.0.0.1:8787`

Run the script from `Navigator > Scripts` on the symbol chart that has loaded enough MT5 history.
