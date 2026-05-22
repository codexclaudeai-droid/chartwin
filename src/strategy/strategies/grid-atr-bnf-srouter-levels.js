export function resolveSrouterBreakoutLevels({
  presetMode,
  dynamicBreakoutLevel,
  dynamicBreakdownLevel,
  staticBreakoutLevel,
  staticBreakdownLevel,
}) {
  let breakoutLevel = Number(dynamicBreakoutLevel);
  let breakdownLevel = Number(dynamicBreakdownLevel);
  const mode = String(presetMode || 'AUTO').toUpperCase();
  const staticBreakout = Number(staticBreakoutLevel) || 0;
  const staticBreakdown = Number(staticBreakdownLevel) || 0;

  if (mode === 'CUSTOM') {
    if (staticBreakout > 0) breakoutLevel = staticBreakout;
    if (staticBreakdown > 0) breakdownLevel = staticBreakdown;
  }

  return {
    breakoutLevel,
    breakdownLevel,
  };
}
