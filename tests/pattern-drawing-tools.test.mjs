import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const drawingTypesSource = fs.readFileSync(new URL('../src/ui/workspace/drawing-types.ts', import.meta.url), 'utf8');
const drawingUtilsSource = fs.readFileSync(new URL('../src/ui/workspace/drawing-utils.ts', import.meta.url), 'utf8');
const leftToolboxSource = fs.readFileSync(new URL('../src/ui/workspace/left-toolbox.ts', import.meta.url), 'utf8');
const mobileToolboxSource = fs.readFileSync(new URL('../src/ui/workspace/mobile-toolbox.ts', import.meta.url), 'utf8');
const simpleChartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');
const shapeRendererSource = fs.readFileSync(new URL('../src/chart/drawings/drawing-shape-renderer.ts', import.meta.url), 'utf8');
const patternRendererSource = fs.readFileSync(new URL('../src/chart/drawings/drawing-pattern-renderer.ts', import.meta.url), 'utf8');
const hitTestSource = fs.readFileSync(new URL('../src/chart/drawings/drawing-hit-test.ts', import.meta.url), 'utf8');
const transformSource = fs.readFileSync(new URL('../src/chart/drawings/drawing-transform.ts', import.meta.url), 'utf8');

const patternToolIds = [
  'xabcd-pattern',
  'cypher-pattern',
  'head-shoulders-pattern',
  'abcd-pattern',
  'triangle-pattern',
  'three-drives-pattern',
  'elliott-impulse-wave',
  'elliott-correction-wave',
  'elliott-triangle-wave',
  'elliott-double-combo-wave',
  'elliott-triple-combo-wave',
];

test('drawing tool types include TradingView-style pattern tools', () => {
  for (const id of patternToolIds) {
    assert.match(drawingTypesSource, new RegExp(`'${id}'`));
  }
  assert.match(drawingTypesSource, /PatternDrawingToolId/);
});

test('desktop toolbox exposes a pattern menu with chart and Elliott sections', () => {
  assert.match(leftToolboxSource, /id: 'patterns'/);
  assert.match(leftToolboxSource, /title: '차트 패턴'/);
  assert.match(leftToolboxSource, /title: '엘리엇 파동'/);
  for (const id of patternToolIds) {
    assert.match(leftToolboxSource, new RegExp(`id: '${id}'`));
  }
});

test('mobile drawing panel exposes the same pattern category', () => {
  assert.match(mobileToolboxSource, /key: 'patterns'/);
  assert.match(mobileToolboxSource, /label: '패턴'/);
  for (const id of patternToolIds) {
    assert.match(mobileToolboxSource, new RegExp(`id: '${id}'`));
  }
});

test('pattern drawings use shared drawing lifecycle and editing plumbing', () => {
  assert.match(simpleChartSource, /isPatternDrawingKind/);
  assert.match(simpleChartSource, /getPatternPointCount/);
  assert.match(simpleChartSource, /createPatternDrawing/);
  assert.match(shapeRendererSource, /renderDrawingPattern/);
  assert.match(hitTestSource, /isPatternDrawingKind/);
  assert.match(transformSource, /isPatternDrawingKind/);
});

test('XABCD pattern renderer draws harmonic guides, ratios, and price axis labels', () => {
  assert.match(patternRendererSource, /function renderXabcdPattern/);
  assert.match(patternRendererSource, /function calculateXabcdRatios/);
  assert.match(patternRendererSource, /screenPoints\.length < 3/);
  assert.match(patternRendererSource, /AB_XA/);
  assert.match(patternRendererSource, /BC_AB/);
  assert.match(patternRendererSource, /CD_BC/);
  assert.match(patternRendererSource, /XD_XA/);
  assert.match(patternRendererSource, /screenPoints\.length >= 3/);
  assert.match(patternRendererSource, /screenPoints\.length >= 4/);
  assert.match(patternRendererSource, /screenPoints\.length >= 5/);
  assert.match(patternRendererSource, /setLineDash\(\[1, 4\]\)/);
  assert.match(patternRendererSource, /drawPriceArrowBox/);
  assert.match(patternRendererSource, /formatPrice\(anchor\.price\)/);
  assert.match(patternRendererSource, /!isDraft/);
});

test('head and shoulders pattern uses seven anchors with live neckline rendering', () => {
  assert.match(drawingUtilsSource, /case 'head-shoulders-pattern':\s+return \['', '왼어깨', '', '머리', '', '오른어깨', ''\]/u);
  assert.match(simpleChartSource, /시작점, 왼어깨, 왼목, 머리, 오른목, 오른어깨, 끝점 순서로 7개 점/u);
  assert.match(patternRendererSource, /function renderHeadShouldersPattern/);
  assert.match(patternRendererSource, /function drawHeadShouldersNeckline/);
  assert.match(patternRendererSource, /function drawHeadShouldersFillAboveNeckline/);
  assert.match(patternRendererSource, /function getSegmentLineIntersection/);
  assert.match(patternRendererSource, /screenPoints\.length < 2/);
  assert.match(patternRendererSource, /screenPoints\.length >= 5/);
  assert.match(patternRendererSource, /const neckLeft = screenPoints\[2\]/);
  assert.match(patternRendererSource, /const neckRight = screenPoints\[4\]/);
  assert.match(patternRendererSource, /fillPeakAboveNeckline\(ctx, metrics, screenPoints\[0\], screenPoints\[1\], neckLeft, neckLeft, neckRight\)/);
  assert.match(patternRendererSource, /fillPeakAboveNeckline\(ctx, metrics, neckLeft, screenPoints\[3\], neckRight, neckLeft, neckRight\)/);
  assert.match(patternRendererSource, /const rightShoulderBase = screenPoints\[6\] \?\? \{ x: screenPoints\[5\]\.x, y: getProjectedY\(neckLeft, neckRight, screenPoints\[5\]\.x\) \}/);
  assert.match(patternRendererSource, /fillPeakAboveNeckline\(ctx, metrics, neckRight, screenPoints\[5\], rightShoulderBase, neckLeft, neckRight\)/);
  assert.match(patternRendererSource, /const peakNeckY = getProjectedY\(neckLeft, neckRight, peak\.x\)/);
  assert.match(patternRendererSource, /const leftNeck = getSegmentLineIntersection\(leftBase, peak, neckLeft, neckRight\)/);
  assert.match(patternRendererSource, /const rightNeck = getSegmentLineIntersection\(peak, rightBase, neckLeft, neckRight\)/);
  assert.match(patternRendererSource, /const leftBaseNeckY = getProjectedY\(neckLeft, neckRight, leftBase\.x\)/);
  assert.match(patternRendererSource, /const rightBaseNeckY = getProjectedY\(neckLeft, neckRight, rightBase\.x\)/);
  assert.match(patternRendererSource, /if \(!isSamePoint\(leftBase, neckLeft\) && leftBase\.y < leftBaseNeckY - 1e-6\) return/);
  assert.match(patternRendererSource, /if \(!isSamePoint\(rightBase, neckRight\) && rightBase\.y < rightBaseNeckY - 1e-6\) return/);
  assert.match(patternRendererSource, /if \(!leftNeck \|\| !rightNeck\) return/);
  assert.doesNotMatch(patternRendererSource, /getSegmentLineIntersection\(leftBase, peak, neckLeft, neckRight\) \?\? leftBase/);
  assert.doesNotMatch(patternRendererSource, /rect\(metrics\.chartLeft, -100000/);
  assert.match(patternRendererSource, /drawHeadShouldersLabel\(ctx, screenPoints\[1\], '왼어깨'/u);
  assert.match(patternRendererSource, /drawHeadShouldersLabel\(ctx, screenPoints\[3\], '머리'/u);
  assert.match(patternRendererSource, /drawHeadShouldersLabel\(ctx, screenPoints\[5\], '오른어깨'/u);
  assert.match(patternRendererSource, /drawXabcdAxisPriceLabel\(ctx, metrics, screenPoints\[index\]\.y, formatPrice\(anchor\.price\), fontStack\)/);
  assert.match(shapeRendererSource, /shape\.kind !== 'head-shoulders-pattern'/);
});

test('triangle pattern previews dotted triangle after C anchor and completes on D', () => {
  assert.match(drawingUtilsSource, /case 'triangle-pattern':\s+return \['A', 'B', 'C', 'D'\]/);
  assert.match(patternRendererSource, /function renderTrianglePattern/);
  assert.match(patternRendererSource, /function getTriangleGuideApex/);
  assert.match(patternRendererSource, /function getTriangleOuterLabelPoint/);
  assert.match(patternRendererSource, /params\.shape\.kind !== 'triangle-pattern' \|\| screenPoints\.length < 3/);
  assert.match(patternRendererSource, /const d = screenPoints\[3\] \?\? c/);
  assert.match(patternRendererSource, /const triangleBoundary = \[a, leftTop, apex\]/);
  assert.match(patternRendererSource, /const labelPoint = getTriangleOuterLabelPoint\(point, triangleBoundary\)/);
  assert.match(patternRendererSource, /y: getProjectedY\(b, d, fallbackX\)/);
  assert.match(patternRendererSource, /drawSegment\(ctx, leftTop, apex\)/);
  assert.match(patternRendererSource, /drawSegment\(ctx, a, apex\)/);
  assert.match(patternRendererSource, /drawSegment\(ctx, a, leftTop\)/);
  assert.match(patternRendererSource, /for \(let i = 0; i < screenPoints\.length - 1; i \+= 1\)/);
  assert.match(patternRendererSource, /setLineDash\(\[2, 8\]\)/);
  assert.match(patternRendererSource, /renderTrianglePattern\(params, screenPoints, labels, isActive\)/);
});

test('triangle pattern toolbar can add anchors after D', () => {
  assert.match(simpleChartSource, /private addTrianglePatternAnchorAfterD\(\): void/);
  assert.match(simpleChartSource, /selected\.kind !== 'triangle-pattern'/);
  assert.match(simpleChartSource, /points\.length < 4 \|\| points\.length >= 9/);
  assert.match(simpleChartSource, /const \[a, b, c, d\] = points/);
  assert.match(simpleChartSource, /const projectPrice = \(left: DrawingAnchor, right: DrawingAnchor, index: number\): number =>/);
  assert.match(simpleChartSource, /const shouldUseLowerGuide = points\.length % 2 === 0/);
  assert.match(simpleChartSource, /const guideStart = shouldUseLowerGuide \? a : b/);
  assert.match(simpleChartSource, /const guideEnd = shouldUseLowerGuide \? c : d/);
  assert.match(simpleChartSource, /price: projectPrice\(guideStart, guideEnd, nextIndex\)/);
  assert.match(simpleChartSource, /selected\.points = nextPoints/);
  assert.match(simpleChartSource, /addTriangleAnchorBtn\.dataset\.k = 'triangle-anchor-add'/);
  assert.match(simpleChartSource, /this\.addTrianglePatternAnchorAfterD\(\)/);
  assert.match(simpleChartSource, /private removeTrianglePatternAnchorAfterD\(\): void/);
  assert.match(simpleChartSource, /if \(points\.length <= 4\) return/);
  assert.match(simpleChartSource, /const nextPoints = points\.slice\(0, -1\)/);
  assert.match(simpleChartSource, /removeTriangleAnchorBtn\.dataset\.k = 'triangle-anchor-remove'/);
  assert.match(simpleChartSource, /trianglePointCount > 4/);
  assert.match(simpleChartSource, /this\.removeTrianglePatternAnchorAfterD\(\)/);
  assert.match(patternRendererSource, /const triangleLabels = \['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'\]/);
  assert.match(patternRendererSource, /for \(let i = 0; i < screenPoints\.length - 1; i \+= 1\)/);
  assert.match(patternRendererSource, /minWidth: 22,\s+height: 24/s);
});

test('triangle extension anchors stay snapped to alternating guide lines while editing', () => {
  assert.match(transformSource, /function projectAnchorPriceOnLine/);
  assert.match(transformSource, /function interpolateAnchorOnLine/);
  assert.match(transformSource, /function getAnchorLineRatio/);
  assert.match(transformSource, /function snapTriangleExtensionAnchors\(\s*points: DrawingAnchor\[\],\s*previousPoints: DrawingAnchor\[\],\s*movedPointIndex: number \| null,/);
  assert.match(transformSource, /if \(index < 4\) return point/);
  assert.match(transformSource, /const useLowerGuide = index % 2 === 0/);
  assert.match(transformSource, /const guideA = useLowerGuide \? a : b/);
  assert.match(transformSource, /const guideB = useLowerGuide \? c : d/);
  assert.match(transformSource, /const shouldPreserveGuideRatio = movedPointIndex == null \|\| movedPointIndex < 4/);
  assert.match(transformSource, /const ratio = getAnchorLineRatio\(previousGuideA, previousGuideB, previousPoint\)/);
  assert.match(transformSource, /return interpolateAnchorOnLine\(guideA, guideB, ratio\)/);
  assert.match(transformSource, /base\.kind === 'triangle-pattern'[\s\S]*?snapTriangleExtensionAnchors\(points, previousPoints, pointIndex\)/);
});

test('three drives pattern uses seven anchors with dotted ratio guides', () => {
  assert.match(drawingUtilsSource, /case 'three-drives-pattern':\s+return \['1', 'A', '2', 'B', '3', 'C', '4'\]/);
  assert.match(simpleChartSource, /1, A, 2, B, 3, C, 4 순서로 7개 점을 탭하세요/);
  assert.match(patternRendererSource, /function renderThreeDrivesPattern/);
  assert.match(patternRendererSource, /function calculateThreeDriveRatios/);
  assert.match(patternRendererSource, /A_B/);
  assert.match(patternRendererSource, /B_C/);
  assert.match(patternRendererSource, /params\.shape\.kind !== 'three-drives-pattern' \|\| screenPoints\.length < 4/);
  assert.match(patternRendererSource, /if \(screenPoints\.length >= 4\) drawSegment\(ctx, a, b\)/);
  assert.match(patternRendererSource, /if \(screenPoints\.length >= 6\) drawSegment\(ctx, b, c\)/);
  assert.match(patternRendererSource, /drawRatioBadge\(ctx, ratios\.A_B\.toFixed\(2\), a, b, fontStack, 0\)/);
  assert.match(patternRendererSource, /drawRatioBadge\(ctx, ratios\.B_C\.toFixed\(2\), b, c, fontStack, 0\)/);
  assert.match(patternRendererSource, /renderThreeDrivesPattern\(params, screenPoints, labels, isActive\)/);
});

test('ABCD pattern previews dotted ratio guides between A-C and B-D', () => {
  assert.match(patternRendererSource, /function renderAbcdPattern/);
  assert.match(patternRendererSource, /function calculateAbcdRatios/);
  assert.match(patternRendererSource, /AC_AB/);
  assert.match(patternRendererSource, /BD_BC/);
  assert.match(patternRendererSource, /params\.shape\.kind !== 'abcd-pattern' \|\| screenPoints\.length < 3/);
  assert.match(patternRendererSource, /if \(screenPoints\.length >= 3\) drawSegment\(ctx, a, c\)/);
  assert.match(patternRendererSource, /if \(screenPoints\.length >= 4\) drawSegment\(ctx, b, d\)/);
  assert.match(patternRendererSource, /drawRatioBadge\(ctx, ratios\.AC_AB\.toFixed\(3\), a, c, fontStack, 0\)/);
  assert.match(patternRendererSource, /drawRatioBadge\(ctx, ratios\.BD_BC\.toFixed\(3\), b, d, fontStack, 0\)/);
  assert.match(patternRendererSource, /renderAbcdPattern\(params, anchors, screenPoints, labels, isActive\)/);
});

test('Elliott pattern drawings include a zero anchor before wave labels', () => {
  assert.match(drawingTypesSource, /'elliott-impulse-wave'/);
  assert.match(drawingUtilsSource, /return \['0', '1', '2', '3', '4', '5'\]/);
  assert.match(drawingUtilsSource, /return \['0', 'A', 'B', 'C'\]/);
  assert.match(drawingUtilsSource, /return \['0', 'A', 'B', 'C', 'D', 'E'\]/);
  assert.match(drawingUtilsSource, /return \['0', 'W', 'X', 'Y'\]/);
  assert.match(drawingUtilsSource, /return \['0', 'W', 'X', 'Y', 'X', 'Z'\]/);
  assert.match(leftToolboxSource, /엘리엇 충격 파동 \(0·1·2·3·4·5\)/);
  assert.match(leftToolboxSource, /엘리엇 조정 파동 \(0·A·B·C\)/);
  assert.match(leftToolboxSource, /엘리엇 삼각 파동 \(0·A·B·C·D·E\)/);
  assert.match(leftToolboxSource, /엘리엇 이중 콤보 파동 \(0·W·X·Y\)/);
  assert.match(leftToolboxSource, /엘리엇 삼중 콤보 파동 \(0·W·X·Y·X·Z\)/);
  assert.match(mobileToolboxSource, /title: '0·1·2·3·4·5'/);
  assert.match(mobileToolboxSource, /title: '0·A·B·C'/);
  assert.match(mobileToolboxSource, /title: '0·A·B·C·D·E'/);
  assert.match(mobileToolboxSource, /title: '0·W·X·Y'/);
  assert.match(mobileToolboxSource, /title: '0·W·X·Y·X·Z'/);
});
