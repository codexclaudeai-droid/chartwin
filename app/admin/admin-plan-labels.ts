export type AdminPlanPeriodInput =
  | string
  | {
      id?: string | null;
      planId?: string | null;
      name?: string | null;
      durationDays?: number | null;
    }
  | null
  | undefined;

const PLAN_PERIOD_LABEL_BY_ID: Record<string, string> = {
  plan_monthly: '1개월',
  plan_half_year: '6개월',
  plan_yearly: '12개월',
};

const PLAN_TIER_LABEL_BY_ID: Record<string, string> = {
  plan_monthly: 'Basic',
  plan_half_year: 'Pro',
  plan_yearly: 'Elite',
};

const PLAN_PERIOD_LABEL_BY_NAME: Record<string, string> = {
  monthly: '1개월',
  '1 month': '1개월',
  'one month': '1개월',
  'half year': '6개월',
  'half-year': '6개월',
  '6 months': '6개월',
  'six months': '6개월',
  yearly: '12개월',
  annual: '12개월',
  annually: '12개월',
  '1 year': '12개월',
  '12 months': '12개월',
};

const PLAN_TIER_LABEL_BY_NAME: Record<string, string> = {
  monthly: 'Basic',
  basic: 'Basic',
  '1 month': 'Basic',
  'one month': 'Basic',
  'half year': 'Pro',
  'half-year': 'Pro',
  '6 months': 'Pro',
  'six months': 'Pro',
  pro: 'Pro',
  yearly: 'Elite',
  annual: 'Elite',
  annually: 'Elite',
  '1 year': 'Elite',
  '12 months': 'Elite',
  elite: 'Elite',
};

export function formatAdminPlanPeriodLabel(plan: AdminPlanPeriodInput, fallback = '미지정'): string {
  if (!plan) return fallback;

  if (typeof plan === 'string') {
    return formatPlanNameFallback(plan, fallback);
  }

  const planId = plan.id?.trim();
  if (planId && PLAN_PERIOD_LABEL_BY_ID[planId]) {
    return PLAN_PERIOD_LABEL_BY_ID[planId];
  }

  if (typeof plan.durationDays === 'number') {
    if (plan.durationDays <= 31) return '1개월';
    if (plan.durationDays >= 170 && plan.durationDays <= 190) return '6개월';
    if (plan.durationDays >= 360 && plan.durationDays <= 370) return '12개월';
  }

  return formatPlanNameFallback(plan.name ?? '', fallback);
}

export function formatAdminPlanTierLabel(plan: AdminPlanPeriodInput, fallback = '플랜 미지정'): string {
  if (!plan) return fallback;

  if (typeof plan === 'string') {
    return formatPlanTierFallback(plan, fallback);
  }

  const planId = plan.planId?.trim() || plan.id?.trim();
  if (planId && PLAN_TIER_LABEL_BY_ID[planId]) {
    return PLAN_TIER_LABEL_BY_ID[planId];
  }

  if (typeof plan.durationDays === 'number') {
    if (plan.durationDays <= 31) return 'Basic';
    if (plan.durationDays >= 170 && plan.durationDays <= 190) return 'Pro';
    if (plan.durationDays >= 360 && plan.durationDays <= 370) return 'Elite';
  }

  return formatPlanTierFallback(plan.name ?? '', fallback);
}

function formatPlanNameFallback(name: string, fallback: string): string {
  const trimmedName = name.trim();
  if (!trimmedName) return fallback;

  return PLAN_PERIOD_LABEL_BY_NAME[trimmedName.toLowerCase()] ?? trimmedName;
}

function formatPlanTierFallback(name: string, fallback: string): string {
  const trimmedName = name.trim();
  if (!trimmedName) return fallback;

  return PLAN_TIER_LABEL_BY_NAME[trimmedName.toLowerCase()] ?? trimmedName;
}
