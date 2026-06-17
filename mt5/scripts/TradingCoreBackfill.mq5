#property strict
#property script_show_inputs

input string IngestUrl = "http://127.0.0.1:8787/ingest/mt45/backfill";
input string ApiKey = "";
input string Market = "Index Futures";
input string SymbolAlias = "";
input ENUM_TIMEFRAMES BackfillTimeframe = PERIOD_M1;
input datetime FromTime = 0;
input datetime ToTime = 0;
input int LookbackDays = 30;
input int BatchSize = 800;
input int RequestTimeoutMs = 10000;
input int PauseMs = 250;
input int SourceUtcOffsetHours = 0;

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\r", "\\r");
   StringReplace(value, "\n", "\\n");
   return value;
}

string TimeframeToText(ENUM_TIMEFRAMES timeframe)
{
   if(timeframe == PERIOD_M1) return "1m";
   if(timeframe == PERIOD_M3) return "3m";
   if(timeframe == PERIOD_M5) return "5m";
   if(timeframe == PERIOD_M15) return "15m";
   if(timeframe == PERIOD_M30) return "30m";
   if(timeframe == PERIOD_H1) return "1h";
   if(timeframe == PERIOD_H2) return "2h";
   if(timeframe == PERIOD_H4) return "4h";
   if(timeframe == PERIOD_D1) return "1d";
   return "1m";
}

string NumberToJson(double value)
{
   string text = DoubleToString(value, 8);
   while(StringFind(text, ".") >= 0 && StringSubstr(text, StringLen(text) - 1, 1) == "0")
      text = StringSubstr(text, 0, StringLen(text) - 1);
   if(StringSubstr(text, StringLen(text) - 1, 1) == ".")
      text = StringSubstr(text, 0, StringLen(text) - 1);
   return text;
}

string BuildPayload(const string symbolName, const MqlRates &rates[], const int count)
{
   string body = "{";
   body += "\"platform\":\"mt5\",";
   body += "\"apiKey\":\"" + JsonEscape(ApiKey) + "\",";
   body += "\"market\":\"" + JsonEscape(Market) + "\",";
   body += "\"symbol\":\"" + JsonEscape(symbolName) + "\",";
   body += "\"timeframe\":\"" + TimeframeToText(BackfillTimeframe) + "\",";
   body += "\"sourceUtcOffsetHours\":" + IntegerToString(SourceUtcOffsetHours) + ",";
   body += "\"candles\":[";

   for(int i = 0; i < count; i++)
   {
      if(i > 0) body += ",";
      body += "{";
      body += "\"time\":" + IntegerToString((int)rates[i].time) + ",";
      body += "\"open\":" + NumberToJson(rates[i].open) + ",";
      body += "\"high\":" + NumberToJson(rates[i].high) + ",";
      body += "\"low\":" + NumberToJson(rates[i].low) + ",";
      body += "\"close\":" + NumberToJson(rates[i].close) + ",";
      body += "\"tick_volume\":" + IntegerToString(rates[i].tick_volume) + ",";
      body += "\"real_volume\":" + IntegerToString(rates[i].real_volume);
      body += "}";
   }

   body += "]}";
   return body;
}

bool PostBatch(const string payload)
{
   char data[];
   char result[];
   string resultHeaders = "";
   string headers = "Content-Type: application/json\r\nX-MT45-API-Key: " + ApiKey + "\r\n";
   int bytes = StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(bytes > 0) ArrayResize(data, bytes - 1);

   ResetLastError();
   int status = WebRequest("POST", IngestUrl, headers, RequestTimeoutMs, data, result, resultHeaders);
   string response = CharArrayToString(result, 0, -1, CP_UTF8);
   if(status < 200 || status >= 300)
   {
      Print("Backfill POST failed. status=", status, " err=", GetLastError(), " response=", response);
      return false;
   }
   Print("Backfill POST ok. status=", status, " response=", response);
   return true;
}

void OnStart()
{
   if(ApiKey == "")
   {
      Print("ApiKey is required.");
      return;
   }

   string symbolName = SymbolAlias == "" ? _Symbol : SymbolAlias;
   datetime toTime = ToTime > 0 ? ToTime : TimeCurrent();
   datetime fromTime = FromTime > 0 ? FromTime : (toTime - MathMax(1, LookbackDays) * 86400);
   if(fromTime >= toTime)
   {
      Print("Invalid range. FromTime must be earlier than ToTime.");
      return;
   }

   if(!SymbolSelect(_Symbol, true))
      Print("SymbolSelect failed for chart symbol: ", _Symbol, " err=", GetLastError());

   int periodSeconds = PeriodSeconds(BackfillTimeframe);
   if(periodSeconds <= 0) periodSeconds = 60;
   int batch = MathMax(1, MathMin(BatchSize, 5000));
   datetime cursor = fromTime;
   int totalSent = 0;

   Print("TradingCore backfill start. symbol=", symbolName, " market=", Market,
         " timeframe=", TimeframeToText(BackfillTimeframe), " from=", TimeToString(fromTime),
         " to=", TimeToString(toTime), " batch=", batch);

   while(cursor <= toTime && !IsStopped())
   {
      MqlRates rates[];
      ArraySetAsSeries(rates, false);
      int copied = CopyRates(_Symbol, BackfillTimeframe, cursor, batch, rates);
      if(copied <= 0)
      {
         Print("CopyRates returned ", copied, " at ", TimeToString(cursor), " err=", GetLastError());
         break;
      }

      MqlRates filtered[];
      ArrayResize(filtered, 0);
      for(int i = 0; i < copied; i++)
      {
         if(rates[i].time < fromTime || rates[i].time > toTime) continue;
         int nextIndex = ArraySize(filtered);
         ArrayResize(filtered, nextIndex + 1);
         filtered[nextIndex] = rates[i];
      }

      int filteredCount = ArraySize(filtered);
      if(filteredCount > 0)
      {
         string payload = BuildPayload(symbolName, filtered, filteredCount);
         if(!PostBatch(payload)) break;
         totalSent += filteredCount;
         cursor = filtered[filteredCount - 1].time + periodSeconds;
      }
      else
      {
         cursor += periodSeconds * batch;
      }

      if(PauseMs > 0) Sleep(PauseMs);
      if(copied < batch && cursor <= toTime) cursor += periodSeconds;
   }

   Print("TradingCore backfill finished. sent=", totalSent);
}
