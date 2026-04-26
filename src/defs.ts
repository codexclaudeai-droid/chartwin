// src/defs.ts

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartState {
  startIndex: number;
  endIndex: number;
}

// 강제로 모듈로 인식시키기 위한 코드 (삭제해도 됨)
export const _FORCE_MODULE = true;
