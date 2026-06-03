import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldShowCrosshairGuides } from '../src/chart/interaction/crosshair-guide-visibility.ts';

test('desktop keeps crosshair guides visible while any drawing stays selected for editing', () => {
  assert.equal(shouldShowCrosshairGuides({
    isTouchDevice: false,
    noDrawingInteraction: false,
    selectedDrawingActive: true,
    drawingToolActive: false,
    drawingMoveActive: false,
    isCrosshairMode: false,
    onYAxis: false,
    onXAxis: false,
  }), true);
});

test('axis hover still hides crosshair guides even during drawing selection', () => {
  assert.equal(shouldShowCrosshairGuides({
    isTouchDevice: false,
    noDrawingInteraction: false,
    selectedDrawingActive: true,
    drawingToolActive: false,
    drawingMoveActive: false,
    isCrosshairMode: false,
    onYAxis: true,
    onXAxis: false,
  }), false);
});
