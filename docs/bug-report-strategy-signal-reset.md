# 버그 리포트: 전략 리포트 수치 캔들 경계 시 0 초기화

- **발견일**: 2026-05-04
- **수정 커밋**: `61ddc62`
- **수정 파일**: `src/chart/SimpleChart.ts`

---

## 증상

- 캔들이 새로 생성되는 순간(캔들 경계)마다 전략 리포트의 총손익·승률·최대감소·수익지수 등 모든 성과 수치가 **0으로 초기화**
- 어떤 경우에는 완전히 0이 되지 않고 수치가 변동 (새로운 시그널 없이도)
- 모든 타임프레임, 모든 전략에서 동일하게 재현

---

## 시스템 구조

```
[웹소켓 틱 수신]
    │
    ├─ updateLastCandle()   ← 캔들 진행 중 가격 갱신
    └─ addNewCandle()       ← 캔들 마감 후 새 캔들 시작
           │
           └─ requestStrategyCompute(changedFrom)
                  │
                  └─ strategyWorker.postMessage({ candles, previousSignals, changedFrom })
                              │ (비동기)
                              └─ 시그널 배열 반환 → this.strategySignals 갱신

[1초 주기 인터벌]
    └─ refreshStrategyReport()
           └─ strategyReport.refresh()
                  │
                  └─ chart.getStrategySignalSeries()  ← strategySignals 읽어서
                         └─ reportWorker.postMessage() → 성과 수치 계산
```

두 개의 독립적인 워커가 비동기로 동작한다:
- **strategyWorker**: 시그널 배열(`[-1, 0, 1, ...]`) 계산
- **reportWorker**: 시그널 배열로 손익·승률 계산

---

## 버그 위치

`src/chart/SimpleChart.ts` — strategyWorker 소스 문자열 내부 (구 line 2292)

```javascript
// 버그 코드
const previous = payload.previousSignals ?? [];
const signals = previous.length === candles.length
  ? [...previous]
  : new Array(candles.length).fill(0);  // ← 문제 지점
```

---

## 발생 메커니즘

### 정상 상태 (캔들 진행 중)

```
candles.length    = N
previous.length   = N   (길이 일치)

→ signals = [...previous]       ✅ 기존 시그널 보존
→ from = N-302 부터 재계산
→ 결과 정상
```

### 버그 발생 순간 (새 캔들 추가)

```
addNewCandle() 호출
  → candles.length  : N → N+1  (새 캔들 추가)
  → previous.length : N        (strategyWorker 아직 응답 전, 여전히 N개)

strategyWorker 내부:
  previous.length(N) ≠ candles.length(N+1)
  → else 분기 실행
  → signals = new Array(N+1).fill(0)   ← 전부 0으로 초기화 ❌

changedFrom = N-2
from = max(0, N-2-300) = N-302

→ 인덱스 [N-302 ~ N]  : 재계산 (정상)
→ 인덱스 [0 ~ N-303]  : 0 그대로 방치 ❌
```

### 결과

```
시그널 배열:
인덱스:  0  1  2  ...  N-303  N-302       ...      N-1   N
값:      0  0  0  ...  0      (재계산된 값) ... (재계산)  0

→ 초반 수백 개 캔들의 시그널이 전부 0
→ 해당 구간의 거래 내역 소실
→ 전체 성과 수치 0 또는 급감
```

---

## 오류 정도가 달라지는 이유

| 조건 | 결과 |
|------|------|
| 캔들 수 N ≤ 302 | `from = 0` → 처음부터 전체 재계산 → 정상 |
| N > 302, 최근 300봉 안에 모든 거래 | 일부 수치 변동만 발생 |
| N > 302, 거래가 초반 구간에도 분포 | 초기화 오류 뚜렷하게 발생 |

→ 캔들 수와 거래 분포에 따라 오류 정도가 달라지므로 간헐적으로 보였음

---

## 왜 `updateLastCandle`에서는 버그 없었나

```typescript
// updateLastCandle: 배열 크기 변화 없음
this.data[i] = { ...this.data[i], ...td };
requestStrategyCompute(Math.max(0, i - 1));

// strategyWorker에서:
// previous.length === candles.length (둘 다 N)
// → 항상 정상 분기 실행
```

`updateLastCandle`은 기존 캔들을 덮어쓸 뿐 배열 크기가 변하지 않아 항상 길이가 일치했음.
버그는 **배열 크기가 늘어나는 `addNewCandle`에서만** 발생.

---

## 수정 내용

```javascript
// 수정 전
const signals = previous.length === candles.length
  ? [...previous]
  : new Array(candles.length).fill(0);

// 수정 후
let signals;
if (previous.length === candles.length) {
  signals = [...previous];
} else if (previous.length < candles.length) {
  // 새 캔들 추가: 기존 시그널 보존 + 새 자리만 0 패딩
  signals = [...previous, ...new Array(candles.length - previous.length).fill(0)];
} else {
  // 캔들 감소: 초과분 잘라냄
  signals = previous.slice(0, candles.length);
}
```

### 수정 후 동작

```
addNewCandle() 호출 시:
  candles.length = N+1,  previous.length = N

  → signals = [...N개 기존 시그널, 0]   ✅ 기존 시그널 완전 보존

from = N-302

→ 인덱스 [N-302 ~ N] 재계산
→ 인덱스 [0 ~ N-303] 기존 시그널 유지   ✅
→ 전체 거래 내역 정상 집계              ✅
```

---

## 요약

| 항목 | 내용 |
|------|------|
| **버그 위치** | `SimpleChart.ts` strategyWorker 소스, signals 초기화 로직 |
| **트리거 조건** | `addNewCandle()` 호출 시 (`previous.length ≠ candles.length`) |
| **발생 주기** | 타임프레임 캔들 경계마다 (1분봉이면 1분, 1시간봉이면 1시간) |
| **핵심 원인** | 길이 불일치 시 기존 시그널을 버리고 전부 0으로 초기화 |
| **오류 범위** | 전체 캔들 중 마지막 ~300개 이전 구간의 시그널 전부 소실 |
| **해결** | 기존 시그널 배열을 보존하고 새 캔들 자리만 0으로 패딩 |
