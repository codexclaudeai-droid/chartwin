import {
  PAYMENT_STATUSES,
  USER_ROLES,
  assertAdminActor,
  assertSuperAdminActor,
  createAuditLogDraft,
  type Actor,
} from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { ChartServiceRepository, PublicServiceUserRecord, SalesTeamRecord } from './repository.ts';
import { getAsyncReferralProgramSettings, getReferralProgramSettings } from './referral-program.ts';
import { toPublicServiceUserRecord } from './user-serialization.ts';

export const DEFAULT_SALES_COMMISSION_PERCENT = 30;
export const DEFAULT_SALES_TEAM_COMMISSION_PERCENT = 30;
export const SALES_TEAM_PAGE_SIZE = 10;

export type AdminSalesManagementInput = {
  salespersonId?: string | null;
  teamId?: string | null;
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

export type AdminSalesTeamRecord = SalesTeamRecord;

export type AdminSalesTeamItem = AdminSalesTeamRecord & {
  salespersonCount: number;
  salesCount: number;
  salesUsd: number;
  points: number;
};

export type AdminSalesTeamSalespersonItem = PublicServiceUserRecord & {
  sequence: number;
  salesCount: number;
  salesUsd: number;
  points: number;
};

export type AdminSalesManagementSummary = {
  defaultPercent: number;
  defaultTeamPercent: number;
  teamPageSize: number;
  salespersonQuery: string;
  customerQuery: string;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  salespeople: AdminSalespersonItem[];
  selectedSalesperson: AdminSalespersonItem | null;
  customers: AdminSalesCustomerItem[];
  teams: AdminSalesTeamItem[];
  selectedTeam: AdminSalesTeamItem | null;
  selectedTeamSalespeople: AdminSalesTeamSalespersonItem[];
  teamTotals: {
    salesCount: number;
    salesUsd: number;
    points: number;
  };
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

export type SalesTeamSettings = {
  defaultPercent: number;
  teams: AdminSalesTeamRecord[];
  updatedByAdminId: string | null;
  updatedAt: string;
};

type SalesSource = {
  users: ReturnType<ChartServiceRepository['listUsers']>;
  payments: ReturnType<ChartServiceRepository['listPayments']>;
  plans: ReturnType<ChartServiceRepository['listPlans']>;
  settings: SalesCommissionSettings;
  teamSettings: SalesTeamSettings;
};

const salesCommissionSettingsStore = new WeakMap<object, SalesCommissionSettings>();

export function getAdminSalesManagementSummary(
  repository: ChartServiceRepository,
  input: AdminSalesManagementInput = {},
): AdminSalesManagementSummary {
  assertSalesAdminDataReady(repository);
  const pointSettings = getReferralProgramSettings(repository);
  return buildAdminSalesManagementSummary({
    users: repository.listUsers(),
    payments: repository.listPayments(),
    plans: repository.listPlans(),
    settings: getSalesCommissionSettings(repository, pointSettings.salespersonRewardPercent),
    teamSettings: createSalesTeamSettings(repository.listSalesTeams(), pointSettings.salespersonRewardPercent),
  }, input);
}

export async function getAsyncAdminSalesManagementSummary(
  repository: AsyncChartServiceRepository,
  input: AdminSalesManagementInput = {},
): Promise<AdminSalesManagementSummary> {
  assertSalesAdminDataReady(repository);
  const [users, payments, plans, pointSettings] = await Promise.all([
    repository.listUsers(),
    repository.listPayments(),
    repository.listPlans(),
    getAsyncReferralProgramSettings(repository),
  ]);
  const teams = await repository.listSalesTeams();

  return buildAdminSalesManagementSummary({
    users,
    payments,
    plans,
    settings: getSalesCommissionSettings(repository, pointSettings.salespersonRewardPercent),
    teamSettings: createSalesTeamSettings(teams, pointSettings.salespersonRewardPercent),
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

export function createAdminSalesTeam(
  repository: ChartServiceRepository,
  input: { admin: Actor; name: string; createdAt: string },
): AdminSalesTeamRecord {
  assertAdminActor(input.admin);
  const team = createSalesTeamRecord(repository, {
    ...input,
    commissionPercent: getReferralProgramSettings(repository).salespersonRewardPercent,
  });
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.sales.team.create',
    targetType: 'sales_team',
    targetId: team.id,
    beforeJson: null,
    afterJson: { team },
  }));
  return team;
}

export async function createAsyncAdminSalesTeam(
  repository: AsyncChartServiceRepository,
  input: { admin: Actor; name: string; createdAt: string },
): Promise<AdminSalesTeamRecord> {
  assertAdminActor(input.admin);
  const pointSettings = await getAsyncReferralProgramSettings(repository);
  const team = await createAsyncSalesTeamRecord(repository, {
    ...input,
    commissionPercent: pointSettings.salespersonRewardPercent,
  });
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.sales.team.create',
    targetType: 'sales_team',
    targetId: team.id,
    beforeJson: null,
    afterJson: { team },
  }));
  return team;
}

export function assignAdminSalespersonToTeam(
  repository: ChartServiceRepository,
  input: { admin: Actor; salespersonId: string; teamId: string; updatedAt: string },
): AdminSalesTeamRecord {
  assertAdminActor(input.admin);
  const salesperson = repository.getUserById(input.salespersonId);
  if (!salesperson || salesperson.role !== USER_ROLES.salesperson) {
    throw new Error('Salesperson not found');
  }
  const before = createSalesTeamSettings(repository.listSalesTeams());
  const settings = setSalespersonTeam(before.teams, input);
  const team = settings.teams.find((item) => item.id === input.teamId);
  if (!team) throw new Error('Sales team not found');
  repository.saveSalesTeam(team);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.sales.team.salesperson.assign',
    targetType: 'sales_team',
    targetId: team.id,
    beforeJson: { settings: before },
    afterJson: { team, salespersonId: salesperson.id },
  }));
  return team;
}

export async function assignAsyncAdminSalespersonToTeam(
  repository: AsyncChartServiceRepository,
  input: { admin: Actor; salespersonId: string; teamId: string; updatedAt: string },
): Promise<AdminSalesTeamRecord> {
  assertAdminActor(input.admin);
  const salesperson = await repository.getUserById(input.salespersonId);
  if (!salesperson || salesperson.role !== USER_ROLES.salesperson) {
    throw new Error('Salesperson not found');
  }
  const before = createSalesTeamSettings(await repository.listSalesTeams());
  const settings = setSalespersonTeam(before.teams, input);
  const team = settings.teams.find((item) => item.id === input.teamId);
  if (!team) throw new Error('Sales team not found');
  await repository.saveSalesTeam(team);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.sales.team.salesperson.assign',
    targetType: 'sales_team',
    targetId: team.id,
    beforeJson: { settings: before },
    afterJson: { team, salespersonId: salesperson.id },
  }));
  return team;
}

export function updateAdminSalesTeamCommissionPercent(
  repository: ChartServiceRepository,
  input: { admin: Actor; teamId: string; commissionPercent: number; updatedAt: string },
): AdminSalesTeamRecord {
  assertSuperAdminActor(input.admin);
  const before = createSalesTeamSettings(repository.listSalesTeams());
  const settings = setSalesTeamCommissionPercent(before.teams, input);
  const team = settings.teams.find((item) => item.id === input.teamId);
  if (!team) throw new Error('Sales team not found');
  repository.saveSalesTeam(team);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.sales.team.commission_percent.update',
    targetType: 'sales_team',
    targetId: team.id,
    beforeJson: { settings: before },
    afterJson: { team },
  }));
  return team;
}

export async function updateAsyncAdminSalesTeamCommissionPercent(
  repository: AsyncChartServiceRepository,
  input: { admin: Actor; teamId: string; commissionPercent: number; updatedAt: string },
): Promise<AdminSalesTeamRecord> {
  assertSuperAdminActor(input.admin);
  const before = createSalesTeamSettings(await repository.listSalesTeams());
  const settings = setSalesTeamCommissionPercent(before.teams, input);
  const team = settings.teams.find((item) => item.id === input.teamId);
  if (!team) throw new Error('Sales team not found');
  await repository.saveSalesTeam(team);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.sales.team.commission_percent.update',
    targetType: 'sales_team',
    targetId: team.id,
    beforeJson: { settings: before },
    afterJson: { team },
  }));
  return team;
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
  const selectedTeam = source.teamSettings.teams.find((team) => team.id === input.teamId)
    ?? source.teamSettings.teams[0]
    ?? null;
  const teamRows = selectedTeam
    ? buildSalesRowsForSalespeople(source, selectedTeam.salespersonIds, { from, to }, selectedTeam.commissionPercent)
    : [];

  return {
    defaultPercent: source.settings.defaultPercent,
    defaultTeamPercent: source.teamSettings.defaultPercent,
    teamPageSize: SALES_TEAM_PAGE_SIZE,
    salespersonQuery,
    customerQuery,
    dateRange: { from, to },
    salespeople: salespersonItems,
    selectedSalesperson: selectedSalespersonItem,
    customers: buildSalesCustomerItems(source, customerQuery),
    teams: buildSalesTeamItems(source, { from, to }),
    selectedTeam: selectedTeam ? toSalesTeamItem(source, selectedTeam, teamRows) : null,
    selectedTeamSalespeople: selectedTeam ? buildTeamSalespersonItems(source, selectedTeam, { from, to }) : [],
    teamTotals: summarizeRows(teamRows),
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

function buildSalesRowsForSalespeople(
  source: SalesSource,
  salespersonIds: string[],
  dateRange: { from: string | null; to: string | null },
  commissionPercent: number,
): AdminSalesManagementRow[] {
  const teamSalespersonIds = new Set(salespersonIds);
  const customerById = new Map(source.users.map((user) => [user.id, user]));
  const planById = new Map(source.plans.map((plan) => [plan.id, plan]));

  return source.payments
    .filter((payment) => payment.status === PAYMENT_STATUSES.confirmed)
    .filter((payment) => {
      const customer = customerById.get(payment.userId);
      return customer?.referredByUserId ? teamSalespersonIds.has(customer.referredByUserId) : false;
    })
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

function buildSalesTeamItems(
  source: SalesSource,
  dateRange: { from: string | null; to: string | null },
): AdminSalesTeamItem[] {
  return source.teamSettings.teams.map((team) => {
    const rows = buildSalesRowsForSalespeople(source, team.salespersonIds, dateRange, team.commissionPercent);
    return toSalesTeamItem(source, team, rows);
  });
}

function toSalesTeamItem(
  source: SalesSource,
  team: AdminSalesTeamRecord,
  rows: AdminSalesManagementRow[],
): AdminSalesTeamItem {
  const totals = summarizeRows(rows);
  return {
    ...cloneTeam(team),
    salespersonCount: team.salespersonIds.filter((id) => source.users.some((user) => user.id === id)).length,
    salesCount: totals.salesCount,
    salesUsd: totals.salesUsd,
    points: totals.points,
  };
}

function buildTeamSalespersonItems(
  source: SalesSource,
  team: AdminSalesTeamRecord,
  dateRange: { from: string | null; to: string | null },
): AdminSalesTeamSalespersonItem[] {
  const userById = new Map(source.users.map((user) => [user.id, user]));
  return team.salespersonIds
    .map((salespersonId) => userById.get(salespersonId))
    .filter((user): user is NonNullable<typeof user> => Boolean(user))
    .slice(0, SALES_TEAM_PAGE_SIZE)
    .map((user, index) => {
      const rows = buildSalesRowsForSalespeople(source, [user.id], dateRange, team.commissionPercent);
      const totals = summarizeRows(rows);
      return {
        ...toPublicServiceUserRecord(user),
        sequence: index + 1,
        salesCount: totals.salesCount,
        salesUsd: totals.salesUsd,
        points: totals.points,
      };
    });
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

function getSalesCommissionSettings(
  repository: object,
  defaultPercent = DEFAULT_SALES_COMMISSION_PERCENT,
): SalesCommissionSettings {
  const existing = salesCommissionSettingsStore.get(repository);
  if (existing) {
    const settings = {
      ...existing,
      defaultPercent,
    };
    salesCommissionSettingsStore.set(repository, settings);
    return cloneSettings(settings);
  }

  const settings = {
    defaultPercent,
    salespersonPercents: {},
    updatedByAdminId: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
  salesCommissionSettingsStore.set(repository, settings);
  return cloneSettings(settings);
}

function createSalesTeamSettings(
  teams: AdminSalesTeamRecord[],
  defaultPercent = DEFAULT_SALES_TEAM_COMMISSION_PERCENT,
): SalesTeamSettings {
  return {
    defaultPercent,
    teams: teams.map(cloneTeam),
    updatedByAdminId: teams[0]?.updatedByAdminId ?? null,
    updatedAt: teams[0]?.updatedAt ?? '1970-01-01T00:00:00.000Z',
  };
}

function createSalesTeamRecord(
  repository: ChartServiceRepository,
  input: { admin: Actor; name: string; createdAt: string; commissionPercent: number },
): AdminSalesTeamRecord {
  const team = buildNewSalesTeam(repository.nextId('sales_team'), input);
  repository.saveSalesTeam(team);
  return cloneTeam(team);
}

async function createAsyncSalesTeamRecord(
  repository: AsyncChartServiceRepository,
  input: { admin: Actor; name: string; createdAt: string; commissionPercent: number },
): Promise<AdminSalesTeamRecord> {
  const team = buildNewSalesTeam(await repository.nextId('sales_team'), input);
  await repository.saveSalesTeam(team);
  return cloneTeam(team);
}

function buildNewSalesTeam(
  id: string,
  input: { admin: Actor; name: string; createdAt: string; commissionPercent: number },
): AdminSalesTeamRecord {
  const name = input.name.trim();
  if (!name) throw new Error('Sales team name required');
  return {
    id,
    name,
    commissionPercent: normalizePercent(input.commissionPercent),
    salespersonIds: [],
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    updatedByAdminId: input.admin.id,
  };
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

function setSalespersonTeam(
  existingTeams: AdminSalesTeamRecord[],
  input: { admin: Actor; salespersonId: string; teamId: string; updatedAt: string },
): SalesTeamSettings {
  const current = createSalesTeamSettings(existingTeams);
  if (!current.teams.some((team) => team.id === input.teamId)) throw new Error('Sales team not found');
  const teams = current.teams.map((team) => {
    const nextSalespersonIds = team.salespersonIds.filter((id) => id !== input.salespersonId);
    if (team.id === input.teamId) nextSalespersonIds.push(input.salespersonId);
    return {
      ...team,
      salespersonIds: [...new Set(nextSalespersonIds)],
      updatedAt: team.id === input.teamId ? input.updatedAt : team.updatedAt,
      updatedByAdminId: team.id === input.teamId ? input.admin.id : team.updatedByAdminId,
    };
  });
  const settings = {
    ...current,
    teams,
    updatedByAdminId: input.admin.id,
    updatedAt: input.updatedAt,
  };
  return cloneTeamSettings(settings);
}

function setSalesTeamCommissionPercent(
  existingTeams: AdminSalesTeamRecord[],
  input: { admin: Actor; teamId: string; commissionPercent: number; updatedAt: string },
): SalesTeamSettings {
  const commissionPercent = normalizePercent(input.commissionPercent);
  const current = createSalesTeamSettings(existingTeams);
  if (!current.teams.some((team) => team.id === input.teamId)) throw new Error('Sales team not found');
  const teams = current.teams.map((team) => team.id === input.teamId
    ? {
      ...team,
      commissionPercent,
      updatedAt: input.updatedAt,
      updatedByAdminId: input.admin.id,
    }
    : team);
  const settings = {
    ...current,
    teams,
    updatedByAdminId: input.admin.id,
    updatedAt: input.updatedAt,
  };
  return cloneTeamSettings(settings);
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

function cloneTeamSettings(settings: SalesTeamSettings): SalesTeamSettings {
  return {
    ...settings,
    teams: settings.teams.map(cloneTeam),
  };
}

function cloneTeam(team: AdminSalesTeamRecord): AdminSalesTeamRecord {
  return {
    ...team,
    salespersonIds: [...team.salespersonIds],
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
