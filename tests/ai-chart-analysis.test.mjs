import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const aiSourcePath = new URL('../src/ui/workspace/ai-chart-analysis.ts', import.meta.url);
const topBarSource = fs.readFileSync(new URL('../src/ui/workspace/top-bar.ts', import.meta.url), 'utf8');
const initSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');

test('top bar wires browser-aware AI chart analysis action', () => {
  assert.match(topBarSource, /onAnalyzeChartWithAi: \(\) => void/);
  assert.match(topBarSource, /aiAnalysisSvgIcon/);
  assert.match(topBarSource, /iconBtn\(aiAnalysisSvgIcon, 'AI 차트분석', onAnalyzeChartWithAi\)/);
  assert.match(initSource, /openAiChartAnalysis/);
  assert.match(initSource, /getActivePane\(\)\.chart/);
});

test('AI chart analysis helper builds prompt, copies chart context, and opens browser AI target', () => {
  assert.equal(fs.existsSync(aiSourcePath), true);
  const aiSource = fs.readFileSync(aiSourcePath, 'utf8');

  assert.match(aiSource, /detectAiBrowserTarget/);
  assert.match(aiSource, /Gemini/);
  assert.match(aiSource, /Copilot/);
  assert.match(aiSource, /navigator\.clipboard\.write/);
  assert.match(aiSource, /ClipboardItem/);
  assert.match(aiSource, /getCompositeDataUrl/);
  assert.match(aiSource, /window\.open\(target\.url, '_blank', 'noopener,noreferrer'\)/);
  assert.match(aiSource, /최근 캔들/);
});
