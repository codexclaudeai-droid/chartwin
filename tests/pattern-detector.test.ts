import { getPatternSignalRange } from '../src/patterns/pattern-detector.ts';

function expectRange(
  actual: { startIndex: number; endIndex: number } | null,
  expected: { startIndex: number; endIndex: number },
): void {
  if (!actual || actual.startIndex !== expected.startIndex || actual.endIndex !== expected.endIndex) {
    throw new Error(`Expected ${expected.startIndex}-${expected.endIndex}, received ${actual?.startIndex}-${actual?.endIndex}`);
  }
}

const explicitRange = getPatternSignalRange({
  key: 'double-bottom-12-18',
  barIndex: 20,
  startIndex: 10,
  endIndex: 16,
});
expectRange(explicitRange, { startIndex: 10, endIndex: 16 });

const derivedRange = getPatternSignalRange({
  key: 'hs-24-30-36',
  barIndex: 40,
});
expectRange(derivedRange, { startIndex: 24, endIndex: 36 });
