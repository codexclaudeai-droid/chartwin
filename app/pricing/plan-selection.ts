type PlanLike = {
  id: string;
};

export function createPricingPlanHref(planId: string): string {
  const searchParams = new URLSearchParams();
  searchParams.set('plan', planId.trim());
  return `/pricing?${searchParams.toString()}`;
}

export function resolveInitialPricingPlanId(
  plans: PlanLike[],
  requestedPlanId: string | null | undefined,
): string {
  const fallbackPlanId = plans[0]?.id ?? 'plan_monthly';
  const normalizedPlanId = requestedPlanId?.trim();
  if (!normalizedPlanId) return fallbackPlanId;

  return plans.some((plan) => plan.id === normalizedPlanId)
    ? normalizedPlanId
    : fallbackPlanId;
}
