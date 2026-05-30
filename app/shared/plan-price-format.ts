export type PlanPriceParts = {
  currency: '$';
  whole: string;
  fraction: string;
};

export function formatPlanPriceParts(amountUsd: number): PlanPriceParts {
  const roundedAmount = Math.round(amountUsd * 100) / 100;
  const [whole, fraction = ''] = roundedAmount.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).split('.');

  return {
    currency: '$',
    whole,
    fraction: fraction ? `.${fraction}` : '',
  };
}
