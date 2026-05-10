// strategies.ts

export type SignalType = "BUY" | "SELL" | "EXIT";

export interface TradeSignal {
  day: number;
  type: SignalType;
  price: number;
  reason: string;
}

// === Grid Strategy ===
export class GridStrategy {
  static entry(balance: number, price: number, day: number): TradeSignal | null {
    const gridStep = 10;
    if (price % gridStep < 1) {
      return { day, type: "BUY", price, reason: "Grid entry" };
    }
    if (price % gridStep > gridStep - 1) {
      return { day, type: "SELL", price, reason: "Grid entry" };
    }
    return null;
  }

  static exit(balance: number, price: number, day: number): TradeSignal | null {
    if (balance > balance * 1.05) {
      return { day, type: "EXIT", price, reason: "Grid profit exit" };
    }
    return null;
  }
}

// === BNF Strategy ===
export class BNFStrategy {
  static entry(balance: number, price: number, day: number): TradeSignal | null {
    if (price > breakoutLevel) {
      return { day, type: "BUY", price, reason: "BNF trend breakout" };
    }
    if (price < stopLossLevel) {
      return { day, type: "SELL", price, reason: "BNF trend breakdown" };
    }
    return null;
  }

  static exit(balance: number, price: number, day: number): TradeSignal | null {
    if (balance < balance * 0.9) {
      return { day, type: "EXIT", price, reason: "BNF stop loss" };
    }
    return null;
  }
}

// === ATR Strategy ===
export class ATRStrategy {
  static entry(balance: number, price: number, atr: number, day: number): TradeSignal | null {
    const gridStep = atr * 1.5;
    if (price % gridStep < 1) {
      return { day, type: "BUY", price, reason: "ATR dynamic entry" };
    }
    if (price % gridStep > gridStep - 1) {
      return { day, type: "SELL", price, reason: "ATR dynamic entry" };
    }
    return null;
  }

  static exit(balance: number, price: number, atr: number, day: number): TradeSignal | null {
    if (price > atr * 3) {
      return { day, type: "EXIT", price, reason: "ATR volatility exit" };
    }
    return null;
  }
}

// === Trend Strategy ===
export class TrendStrategy {
  static entry(balance: number, price: number, maFast: number, maSlow: number, day: number): TradeSignal | null {
    if (maFast > maSlow) {
      return { day, type: "BUY", price, reason: "Trend up entry" };
    }
    if (maFast < maSlow) {
      return { day, type: "SELL", price, reason: "Trend down entry" };
    }
    return null;
  }

  static exit(balance: number, price: number, maFast: number, maSlow: number, day: number): TradeSignal | null {
    if (Math.abs(maFast - maSlow) < price * 0.01) {
      return { day, type: "EXIT", price, reason: "Trend neutral exit" };
    }
    return null;
  }
}

// === Strategy Router ===
export type MarketState = "RANGE" | "TREND" | "VOLATILE";

export class StrategyRouter {
  static run(
    state: MarketState,
    balance: number,
    price: number,
    day: number,
    atr?: number,
    maFast?: number,
    maSlow?: number
  ): TradeSignal | null {
    switch (state) {
      case "RANGE":
        return GridStrategy.entry(balance, price, day) || GridStrategy.exit(balance, price, day);

      case "TREND":
        return (
          BNFStrategy.entry(balance, price, day) ||
          BNFStrategy.exit(balance, price, day) ||
          TrendStrategy.entry(balance, price, maFast ?? 0, maSlow ?? 0, day) ||
          TrendStrategy.exit(balance, price, maFast ?? 0, maSlow ?? 0, day)
        );

      case "VOLATILE":
        return (
          ATRStrategy.entry(balance, price, atr ?? 0, day) ||
          ATRStrategy.exit(balance, price, atr ?? 0, day)
        );

      default:
        return null;
    }
  }
}