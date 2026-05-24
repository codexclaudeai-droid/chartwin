import {
  PAYMENT_STATUSES,
  USER_ROLES,
  assertAdminActor,
  assertSuperAdminActor,
  createAuditLogDraft,
  type Actor,
} from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { ChartServiceRepository, PublicServiceUserRecord } from './repository.ts';
import { toPublicServiceUserRecord } from './user-serialization.ts';

export const DEFAULT_SALES_COMMISSION_PERCENT = 30;

export type AdminSalesManagementInput = {
  salespersonId?: string | null;
  query?: string | null;
  customerQuery?: string | null;
  from?: string | null;
  to?: string | null;
};

export type AdminSalespersonItem = PublicServiceUserRecord & {
  commissionPercent: number;
  salesCount: number;
  salesUsd: number;
  points: number;
};

export type AdminSalesManagementRow = {
  paymentId: string;
  salesDate: string;
  email: string;
  customerName: string;
  subscriptionPlan: string;
  amountUsd: number;
  commissionPercent: number;
  points: number;
};

export type AdminSalesCustomerItem = PublicServiceUserRecord & {
  salesperson: PublicServiceUserRecord | null;
};

export type AdminSalesManagementSummary = {
  defaultPercent: number;
  salespersonQuery: string;
  customerQuery: string;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  salespeople: AdminSalespersonItem[];
  selectedSalesperson: AdminSalespersonItem | null;
  customers: AdminSalesCustomerItem[];
  rows: AdminSalesManagementRow[];
  totals: {
    salesCount: number;
    salesUsd: number;
    points: number;
  };
};

export type AdminCustomerSalespersonAssignment = {
  customer: PublicServiceUserRecord;
  salesperson: PublicServiceUserRecord | null;
};

export type SalesCommissionSettings = {
  defaultPercent: number;
  salespersonPercents: Record<string, number>;
  updatedByAdminId: string | null;
  updatedAt: string;
};

type SalesSource = {
  users: ReturnType<ChartServiceRepository['listUsers']>;
  payments: ReturnType<ChartServiceRepository['listPayments']>;
  plans: ReturnType<ChartServiceRepository['listPlans']>;
  settings: SalesCommissionSettings;
};

const salesCommissionSettingsStore = new WeakMap<object, SalesCommissionSettings>();

export function getAdminSalesManagementSummary(
  repository: ChartServiceRepository,
  input: AdminSalesManagementInput = {},
): AdminSalesManagementSummary {
  assertSalesAdminDataReady(repository);
  return buildAdminSalesManagementSummary({
    users: repository.listUsers(),
    payments: repository.listPayments(),
    plans: repository.listPlans(),
    settings: getSalesCommissionSettings(repository),
  }, input);
}

export async function getAsyncAdminSalesManagementSummary(
  repository: AsyncChartServiceRepository,
  input: AdminSalesManagementInput = {},
): Promise<AdminSalesManagementSummary> {
  assertSalesAdminDataReady(repository);
  const [users, payments, plans] = await Promise.all([
    repository.listUsers(),
    repository.listPayments(),
    repository.listPlans(),
  ]);

  return buildAdminSalesManagementSummary({
    users,
    payments,
    plans,
    settings: getSalesCommissionSettings(repository),
  }, input);
}

export function updateAdminSalesCommissionPercent(
  repository: ChartServiceRepository,
  input: {
    admin: Actor;
    salespersonId: string;
    commissionPercent: number;
    updatedAt: string;
  },
): SalesCommissionSettings {
  assertSuperAdminActor(input.admin);
  const salesperson = repository.getUserById(input.salespersonId);
  if (!salesperson || salesperson.role !== USER_ROLES.salesperson) {
    throw new Error('Salesperson not found');
  }

  const before = getSalesCommissionSettings(repository);
  const settings = setSalespersonCommissionPercent(repository, input);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.sales.commission_percent.update',
    targetType: 'salesperson',
    targetId: input.salespersonId,
    beforeJson: { settings: before },
    afterJson: { settings },
  }));

  return settings;
}

export async function updateAsyncAdminSalesCommissionPercent(
  repository: AsyncChartServiceRepository,
  input: {
    admin: Actor;
    salespersonId: string;
    commissionPercent: number;
    updatedAt: string;
  },
): Promise<SalesCommissionSettings> {
  assertSuperAdminActor(input.admin);
  const salesperson = await repository.getUserById(input.salespersonId);
  if (!salesperson || salesperson.role !== USER_ROLES.salesperson) {
    throw new Error('Salesperson not found');
  }

  const before = getSalesCommissionSettings(repository);
  const settings = setSalespersonCommissionPercent(repository, input);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.sales.commission_percent.update',
    targetType: 'salesperson',
    targetId: input.salespersonId,
    beforeJson: { settings: before },
    afterJson: { settings },
  }));

  return settings;
}

export function updateAdminCustomerSalesperson(
  repository: ChartServiceRepository,
  input: {
    admin: Actor;
    customerId: string;
    salespersonId: string | null;
  },
): AdminCustomerSalespersonAssignment {
  assertAdminActor(input.admin);
  const customer = repository.getUserById(input.customerId);
  if (!customer || !isAssignableCustomerRole(customer.role)) {
    throw new Error('Customer not found');
  }
  const salesperson = input.salespersonId
    ? repository.getUserById(input.salespersonId)
    : null;
  if (input.salespersonId && (!salesperson || salesperson.role !== USER_ROLES.salesperson)) {
    throw new Error('Salesperson not found');
  }
  if (salesperson?.id === customer.id) {
    throw new Error('Customer cannot be assigned to self as salesperson');
  }

  const updatedCustomer = {
    ...customer,
    referredByUserId: salesperson?.id ?? null,
  };
  repository.saveUser(updatedCustomer);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: salesperson ? 'admin.sales.customer.assign' : 'admin.sales.customer.unassign',
    targetType: 'user',
    targetId: customer.id,
    beforeJson: { user: customer },
    afterJson: { user: updatedCustomer, salespersonId: salesperson?.id ?? null },
  }));

  return {
    customer: toPublicServiceUserRecord(updatedCustomer),
    salesperson: salesperson ? toPublicServiceUserRecord(salesperson) : null,
  };
}

export async function updateAsyncAdminCustomerSalesperson(
  repository: AsyncChartServiceRepository,
  input: {
    admin: Actor;
    customerId: string;
    salespersonId: string | null;
  },
): Promise<AdminCustomerSalespersonAssignment> {
  assertAdminActor(input.admin);
  const customer = await repository.getUserById(input.customerId);
  if (!customer || !isAssignableCustomerRole(customer.role)) {
    throw new Error('Customer not found');
  }
  const salesperson = input.salespersonId
    ? await repository.getUserById(input.salespersonId)
    : null;
  if (input.salespersonId && (!salesperson || salesperson.role !== USER_ROLES.salesperson)) {
    throw new Error('Salesperson not found');
  }
  if (salesperson?.id === customer.id) {
    throw new Error('Customer cannot be assigned to self as salesperson');
  }

  const updatedCustomer = {
    ...customer,
    referredByUserId: salesperson?.id ?? null,
  };
  await repository.saveUser(updatedCustomer);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: salesperson ? 'admin.sales.customer.assign' : 'admin.sales.customer.unassign',
    targetType: 'user',
    targetId: customer.id,
    beforeJson: { user: customer },
    afterJson: { user: updatedCustomer, salespersonId: salesperson?.id ?? null },
  }));

  return {
    customer: toPublicServiceUserRecord(updatedCustomer),
    salesperson: salesperson ? toPublicServiceUserRecord(salesperson) : null,
  };
}

function buildAdminSalesManagementSummary(
  source: SalesSource,
  input: AdminSalesManagementInput,
): AdminSalesManagementSummary {
  const salespersonQuery = input.query?.trim().toLowerCase() ?? '';
  const customerQuery = input.customerQuery?.trim().toLowerCase() ?? '';
  const from = normalizeDateFilter(input.from);
  const to = normalizeDateFilter(input.to);
  const allSalespeople = source.users
    .filter((user) => user.role === USER_ROLES.salesperson)
    .sort((a, b) => a.email.localeCompare(b.email));
  const filteredSalespeople = allSalespeople.filter((user) => (
    !salespersonQuery ||
    user.email.toLowerCase().includes(salespersonQuery) ||
    user.name.toLowerCase().includes(salespersonQuery)
  ));
  const selectedSalesperson = filteredSalespeople.find((user) => user.id === input.salespersonId)
    ?? allSalespeople.find((user) => user.id === input.salespersonId)
    ?? filteredSalespeople[0]
    ?? allSalespeople[0]
    ?? null;

  const rows = selectedSalesperson
    ? buildSalesRows(source, selectedSalesperson.id, { from, to })
    : [];
  const salespersonItems = filteredSalespeople.map((user) => {
    const salespersonRows = buildSalesRows(source, user.id, { from, to });
    return toSalespersonItem(source, user, salespersonRows);
  });
  const selectedSalespersonItem = selectedSalesperson
    ? toSalespersonItem(source, selectedSalesperson, rows)
    : null;

  return {
    defaultPercent: source.settings.defaultPercent,
    salespersonQuery,
    customerQuery,
    dateRange: { from, to },
    salespeople: salespersonItems,
    selectedSalesperson: selectedSalespersonItem,
    customers: buildSalesCustomerItems(source, customerQuery),
    rows,
    totals: summarizeRows(rows),
  };
}

function buildSalesCustomerItems(
  source: SalesSource,
  customerQuery: string,
): AdminSalesCustomerItem[] {
  const userById = new Map(source.users.map((user) => [user.id, user]));
  return source.users
    .filter((user) => isAssignableCustomerRole(user.role))
    .filter((user) => (
      !customerQuery ||
      user.email.toLowerCase().includes(customerQuery) ||
      user.name.toLowerCase().includes(customerQuery)
    ))
    .sort((a, b) => a.email.localeCompare(b.email))
    .slice(0, 20)
    .map((user) => {
      const salesperson = user.referredByUserId
        ? userById.get(user.referredByUserId)
        : null;
      return {
        ...toPublicServiceUserRecord(user),
        salesperson: salesperson ? toPublicServiceUserRecord(salesperson) : null,
      };
    });
}

function buildSalesRows(
  source: SalesSource,
  salespersonId: string,
  dateRange: { from: string | null; to: string | null },
): AdminSalesManagementRow[] {
  const customerById = new Map(source.users.map((user) => [user.id, user]));
  const planById = new Map(source.plans.map((plan) => [plan.id, plan]));
  const commissionPercent = getCommissionPercent(source.settings, salespersonId);

  return source.payments
    .filter((payment) => payment.status === PAYMENT_STATUSES.confirmed)
    .filter((payment) => customerById.get(payment.userId)?.referredByUserId === salespersonId)
    .filter((payment) => isWithinDateRange(payment.confirmedAt ?? payment.updatedAt, dateRange))
    .map((payment) => {
      const customer = customerById.get(payment.userId);
      return {
        paymentId: payment.id,
        salesDate: (payment.confirmedAt ?? payment.updatedAt).slice(0, 10),
        email: customer?.email ?? payment.userId,
        customerName: customer?.name ?? 'Unknown',
        subscriptionPlan: planById.get(payment.planId)?.name ?? payment.planId,
        amountUsd: payment.amountUsd,
        commissionPercent,
        points: roundPoints(payment.amountUsd * commissionPercent / 100),
      };
    })
    .sort((a, b) => b.salesDate.localeCompare(a.salesDate));
}

function toSalespersonItem(
  source: SalesSource,
  user: SalesSource['users'][number],
  rows: AdminSalesManagementRow[],
): AdminSalespersonItem {
  const totals = summarizeRows(rows);
  return {
    ...toPublicServiceUserRecord(user),
    commissionPercent: getCommissionPercent(source.settings, user.id),
    salesCount: totals.salesCount,
    salesUsd: totals.salesUsd,
    points: totals.points,
  };
}

function summarizeRows(rows: AdminSalesManagementRow[]): AdminSalesManagementSummary['totals'] {
  return {
    salesCount: rows.length,
    salesUsd: roundPoints(rows.reduce((total, row) => total + row.amountUsd, 0)),
    points: roundPoints(rows.reduce((total, row) => total + row.points, 0)),
  };
}

function getSalesCommissionSettings(repository: object): SalesCommissionSettings {
  const existing = salesCommissionSettingsStore.get(repository);
  if (existing) return cloneSettings(existing);

  const settings = {
    defaultPercent: DEFAULT_SALES_COMMISSION_PERCENT,
    salespersonPercents: {},
    updatedByAdminId: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
  salesCommissionSettingsStore.set(repository, settings);
  return cloneSettings(settings);
}

function setSalespersonCommissionPercent(
  repository: object,
  input: { admin: Actor; salespersonId: string; commissionPercent: number; updatedAt: string },
): SalesCommissionSettings {
  const commissionPercent = normalizePercent(input.commissionPercent);
  const current = getSalesCommissionSettings(repository);
  const settings = {
    ...current,
    salespersonPercents: {
      ...current.salespersonPercents,
      [input.salespersonId]: commissionPercent,
    },
    updatedByAdminId: input.admin.id,
    updatedAt: input.updatedAt,
  };
  salesCommissionSettingsStore.set(repository, settings);
  return cloneSettings(settings);
}

function getCommissionPercent(settings: SalesCommissionSettings, salespersonId: string): number {
  return settings.salespersonPercents[salespersonId] ?? settings.defaultPercent;
}

function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Sales commission percent must be a number');
  if (value < 0 || value > 100) throw new Error('Sales commission percent must be between 0 and 100');
  return Math.round(value * 100) / 100;
}

function normalizeDateFilter(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function isWithinDateRange(
  isoDate: string,
  dateRange: { from: string | null; to: string | null },
): boolean {
  const date = isoDate.slice(0, 10);
  return (!dateRange.from || date >= dateRange.from) &&
    (!dateRange.to || date <= dateRange.to);
}

function cloneSettings(settings: SalesCommissionSettings): SalesCommissionSettings {
  return {
    ...settings,
    salespersonPercents: { ...settings.salespersonPercents },
  };
}

function isAssignableCustomerRole(role: string): boolean {
  return role !== USER_ROLES.admin &&
    role !== USER_ROLES.superAdmin &&
    role !== USER_ROLES.salesperson;
}

function assertSalesAdminDataReady(repository: object): void {
  assertAdminActor({ id: 'system', role: USER_ROLES.admin });
  if (!repository) throw new Error('Repository required');
}

function roundPoints(value: number): number {
  return Math.round(value * 100) / 100;
}
