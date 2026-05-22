export function resolveSrouterBreakoutLevels(args: {
  presetMode: string;
  dynamicBreakoutLevel: number;
  dynamicBreakdownLevel: number;
  staticBreakoutLevel: number;
  staticBreakdownLevel: number;
}): {
  breakoutLevel: number;
  breakdownLevel: number;
};
