import {
  USER_ACCOUNT_STATUSES,
  USER_ROLES,
  validatePasswordPolicy,
  type SubscriptionPlan,
} from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import { createPasswordHash } from './passwords.ts';
import { isPasswordHashRuntimeCompatible } from './passwords.ts';
import { createUniqueRandomReferralCode } from './referral-codes.ts';
import type { ServiceUserRecord } from './repository.ts';

export type ChartServiceBootstrapAdminInput = {
  email?: string | null;
  password?: string | null;
  name?: string | null;
};

export type ChartServiceBootstrapOptions = {
  defaultPlans?: SubscriptionPlan[];
  initialAdmin?: ChartServiceBootstrapAdminInput | null;
};

export type ChartServiceBootstrapResult = {
  createdPlanCount: number;
  skippedPlanCount: number;
  createdAdmin: boolean;
  updatedAdmin: boolean;
  skippedAdmin: boolean;
};

export function getDefaultChartServiceSubscriptionPlans(): SubscriptionPlan[] {
  return [
    { id: 'plan_monthly', name: 'Monthly', durationDays: 30, basePriceUsd: 199, discountPercent: 0, isActive: true },
    { id: 'plan_half_year', name: 'Half Year', durationDays: 180, basePriceUsd: 1194, discountPercent: 15, isActive: true },
    { id: 'plan_yearly', name: 'Yearly', durationDays: 365, basePriceUsd: 2388, discountPercent: 30, isActive: true },
  ];
}

export async function bootstrapAsyncChartServiceRepository(
  repository: AsyncChartServiceRepository,
  options: ChartServiceBootstrapOptions = {},
): Promise<ChartServiceBootstrapResult> {
  const result: ChartServiceBootstrapResult = {
    createdPlanCount: 0,
    skippedPlanCount: 0,
    createdAdmin: false,
    updatedAdmin: false,
    skippedAdmin: false,
  };

  for (const plan of options.defaultPlans ?? getDefaultChartServiceSubscriptionPlans()) {
    if (await repository.getPlanById(plan.id)) {
      result.skippedPlanCount += 1;
      continue;
    }
    await repository.savePlan(plan);
    result.createdPlanCount += 1;
  }

  const initialAdmin = normalizeBootstrapAdminInput(options.initialAdmin);
  if (initialAdmin) {
    const existingAdmin = await repository.getUserByEmail(initialAdmin.email);
    if (existingAdmin) {
      const refreshedAdmin = createRefreshedInitialAdminUser(existingAdmin, initialAdmin);
      if (shouldRefreshInitialAdminUser(existingAdmin)) {
        await repository.saveUser(refreshedAdmin);
        result.updatedAdmin = true;
      } else {
        result.skippedAdmin = true;
      }
    } else {
      await repository.saveUser(await createInitialAdminUser(repository, initialAdmin));
      result.createdAdmin = true;
    }
  }

  return result;
}

function normalizeBootstrapAdminInput(
  input: ChartServiceBootstrapAdminInput | null | undefined,
): { email: string; password: string; name: string } | null {
  const email = input?.email?.trim().toLowerCase() ?? '';
  const password = input?.password ?? '';
  const name = input?.name?.trim() || email;

  if (!email && !password) {
    return null;
  }
  if (!email || !password) {
    throw new Error('Initial admin bootstrap requires both email and password.');
  }
  if (!email.includes('@')) {
    throw new Error('Initial admin email is invalid.');
  }

  const policy = validatePasswordPolicy(password);
  if (!policy.ok) {
    throw new Error(`Password policy failed: ${policy.missing.join(', ')}`);
  }

  return { email, password, name };
}

async function createInitialAdminUser(
  repository: AsyncChartServiceRepository,
  input: { email: string; password: string; name: string },
): Promise<ServiceUserRecord> {
  const user: ServiceUserRecord = {
    id: await repository.nextId('admin'),
    email: input.email,
    name: input.name,
    role: USER_ROLES.superAdmin,
    accountStatus: USER_ACCOUNT_STATUSES.active,
    phoneNumber: null,
    referralCode: '',
    referredByUserId: null,
    createdAt: new Date().toISOString(),
    passwordHash: createPasswordHash(input.password),
  };
  user.referralCode = createUniqueRandomReferralCode((await repository.listUsers()).map((item) => item.referralCode));
  return user;
}

function shouldRefreshInitialAdminUser(user: ServiceUserRecord): boolean {
  return user.role !== USER_ROLES.superAdmin ||
    user.accountStatus !== USER_ACCOUNT_STATUSES.active ||
    !isPasswordHashRuntimeCompatible(user.passwordHash);
}

function createRefreshedInitialAdminUser(
  user: ServiceUserRecord,
  input: { email: string; password: string; name: string },
): ServiceUserRecord {
  return {
    ...user,
    email: input.email,
    role: USER_ROLES.superAdmin,
    accountStatus: USER_ACCOUNT_STATUSES.active,
    passwordHash: createPasswordHash(input.password),
  };
}
