# Chart Service Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable domain foundation for chart service access, manual subscription approval, payment confirmation, refund/cancel handling, referral ledgers, and smoke-test fixtures before migrating the UI to Next.js.

**Architecture:** Keep the existing chart code untouched and add framework-neutral TypeScript domain modules under `src/domain`. The modules expose pure functions and typed state transitions so they can be consumed first by the current app, then by Next.js route handlers, and later by a separated backend service.

**Tech Stack:** TypeScript, Node test runner, current Vite/TypeScript project, no new runtime dependencies in this slice.

---

## File Ownership

- Create: `src/domain/chart-service/types.ts`
- Create: `src/domain/chart-service/access.ts`
- Create: `src/domain/chart-service/subscriptions.ts`
- Create: `src/domain/chart-service/payments.ts`
- Create: `src/domain/chart-service/referrals.ts`
- Create: `src/domain/chart-service/security.ts`
- Create: `src/domain/chart-service/fixtures.ts`
- Create: `src/domain/chart-service/index.ts`
- Create: `tests/chart-service-domain.test.mjs`
- Create: `tests/chart-service-security.test.mjs`
- Modify: `tsconfig.json`
- Modify only if needed: `package.json` scripts after tests are stable

Do not modify these in this slice:

- `src/chart/SimpleChart.ts`
- `src/app/init.ts`
- `src/ui/workspace/*`
- `server/data-gateway.mjs`
- `public/signal.html`

## Task 1: Domain Types

**Files:**

- Create: `src/domain/chart-service/types.ts`
- Test: `tests/chart-service-domain.test.mjs`

- [ ] **Step 1: Write the failing type import smoke test**

Create `tests/chart-service-domain.test.mjs` with this content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('chart service domain exports role and subscription constants', async () => {
  const domain = await import('../src/domain/chart-service/index.ts');

  assert.equal(domain.USER_ROLES.member, 'member');
  assert.equal(domain.SUBSCRIPTION_STATUSES.active, 'active');
});
```

- [ ] **Step 2: Run test to verify it fails before implementation**

Run:

```powershell
npm.cmd run build
node --test tests\chart-service-domain.test.mjs
```

Expected: build or test fails because `src/domain/chart-service/index.ts` does not exist yet.

- [ ] **Step 3: Create `src/domain/chart-service/types.ts`**

```ts
export const USER_ROLES = {
  guest: 'guest',
  member: 'member',
  trial: 'trial',
  subscriber: 'subscriber',
  salesperson: 'salesperson',
  admin: 'admin',
  superAdmin: 'super_admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const SUBSCRIPTION_STATUSES = {
  none: 'none',
  trialRequested: 'trial_requested',
  trialActive: 'trial_active',
  trialExpired: 'trial_expired',
  paymentRequested: 'payment_requested',
  paymentPending: 'payment_pending',
  active: 'active',
  expiring: 'expiring',
  expired: 'expired',
  cancelRequested: 'cancel_requested',
  cancelled: 'cancelled',
  refundRequested: 'refund_requested',
  refunded: 'refunded',
} as const;

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[keyof typeof SUBSCRIPTION_STATUSES];

export const PAYMENT_STATUSES = {
  requested: 'requested',
  pending: 'pending',
  confirmed: 'confirmed',
  rejected: 'rejected',
  cancelled: 'cancelled',
  refunded: 'refunded',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES];

export const REFERRAL_LEDGER_STATUSES = {
  pending: 'pending',
  confirmed: 'confirmed',
  reversed: 'reversed',
} as const;

export type ReferralLedgerStatus = typeof REFERRAL_LEDGER_STATUSES[keyof typeof REFERRAL_LEDGER_STATUSES];

export type Actor = {
  id: string;
  role: UserRole;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  durationDays: number;
  basePriceUsd: number;
  discountPercent: number;
  isActive: boolean;
};

export type SubscriptionRecord = {
  id: string;
  userId: string;
  planId: string | null;
  status: SubscriptionStatus;
  startsAt: string | null;
  endsAt: string | null;
  approvedByAdminId: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentRequestRecord = {
  id: string;
  userId: string;
  planId: string;
  subscriptionId: string;
  method: 'bank_transfer' | 'usdt';
  amountUsd: number;
  amountKrw: number | null;
  exchangeRate: number | null;
  referralPointsUsed: number;
  status: PaymentStatus;
  depositorName: string | null;
  adminNote: string | null;
  confirmedByAdminId: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReferralLedgerRecord = {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  paymentRequestId: string;
  amountUsd: number;
  percent: number;
  points: number;
  status: ReferralLedgerStatus;
  confirmAfter: string;
  confirmedAt: string | null;
  reversedAt: string | null;
  createdAt: string;
};

export type AuditLogDraft = {
  actorAdminId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeJson: unknown;
  afterJson: unknown;
};
```

- [ ] **Step 4: Create `src/domain/chart-service/index.ts`**

```ts
export * from './types.ts';
```

- [ ] **Step 5: Run test to verify it passes**

Before running the command, modify `tsconfig.json` so the new domain files are typechecked by the build:

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "esnext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/main.ts", "src/domain/**/*.ts"],
  "exclude": ["src/backup"]
}
```

Run:

```powershell
npm.cmd run build
node --test tests\chart-service-domain.test.mjs
```

Expected: PASS for the export smoke test.

- [ ] **Step 6: Commit**

```powershell
git add tsconfig.json src/domain/chart-service/types.ts src/domain/chart-service/index.ts tests/chart-service-domain.test.mjs
git commit -m "Add chart service domain types"
```

## Task 2: Access Rules

**Files:**

- Create: `src/domain/chart-service/access.ts`
- Modify: `src/domain/chart-service/index.ts`
- Modify: `tests/chart-service-domain.test.mjs`

- [ ] **Step 1: Add failing access tests**

Append to `tests/chart-service-domain.test.mjs`:

```js
test('chart access allows trial and subscriber users', async () => {
  const { canUseFullChart, canViewPaidSignals } = await import('../src/domain/chart-service/index.ts');

  assert.equal(canUseFullChart({ role: 'trial', subscriptionStatus: 'trial_active' }), true);
  assert.equal(canUseFullChart({ role: 'subscriber', subscriptionStatus: 'active' }), true);
  assert.equal(canViewPaidSignals({ role: 'subscriber', subscriptionStatus: 'active' }), true);
});

test('chart access blocks member and expired users from paid signals', async () => {
  const { canUseFullChart, canViewPaidSignals } = await import('../src/domain/chart-service/index.ts');

  assert.equal(canUseFullChart({ role: 'member', subscriptionStatus: 'none' }), false);
  assert.equal(canViewPaidSignals({ role: 'subscriber', subscriptionStatus: 'expired' }), false);
  assert.equal(canViewPaidSignals({ role: 'trial', subscriptionStatus: 'trial_expired' }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd run build
node --test tests\chart-service-domain.test.mjs
```

Expected: FAIL because `canUseFullChart` and `canViewPaidSignals` are not exported.

- [ ] **Step 3: Create `src/domain/chart-service/access.ts`**

```ts
import {
  SUBSCRIPTION_STATUSES,
  USER_ROLES,
  type SubscriptionStatus,
  type UserRole,
} from './types.ts';

export type AccessContext = {
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
};

export function canUseFullChart(context: AccessContext): boolean {
  if (context.role === USER_ROLES.admin || context.role === USER_ROLES.superAdmin) return true;
  if (context.subscriptionStatus === SUBSCRIPTION_STATUSES.trialActive) return true;
  return context.subscriptionStatus === SUBSCRIPTION_STATUSES.active ||
    context.subscriptionStatus === SUBSCRIPTION_STATUSES.expiring;
}

export function canViewPaidSignals(context: AccessContext): boolean {
  if (context.role === USER_ROLES.admin || context.role === USER_ROLES.superAdmin) return true;
  return context.subscriptionStatus === SUBSCRIPTION_STATUSES.trialActive ||
    context.subscriptionStatus === SUBSCRIPTION_STATUSES.active ||
    context.subscriptionStatus === SUBSCRIPTION_STATUSES.expiring;
}

export function canAccessAdmin(context: Pick<AccessContext, 'role'>): boolean {
  return context.role === USER_ROLES.admin || context.role === USER_ROLES.superAdmin;
}

export function canManageAdmins(context: Pick<AccessContext, 'role'>): boolean {
  return context.role === USER_ROLES.superAdmin;
}
```

- [ ] **Step 4: Export access functions**

Modify `src/domain/chart-service/index.ts`:

```ts
export * from './types.ts';
export * from './access.ts';
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```powershell
npm.cmd run build
node --test tests\chart-service-domain.test.mjs
```

Expected: PASS for access tests.

- [ ] **Step 6: Commit**

```powershell
git add src/domain/chart-service/access.ts src/domain/chart-service/index.ts tests/chart-service-domain.test.mjs
git commit -m "Add chart service access rules"
```

## Task 3: Subscription State Transitions

**Files:**

- Create: `src/domain/chart-service/subscriptions.ts`
- Modify: `src/domain/chart-service/index.ts`
- Modify: `tests/chart-service-domain.test.mjs`

- [ ] **Step 1: Add failing subscription transition tests**

Append to `tests/chart-service-domain.test.mjs`:

```js
test('admin can approve payment pending subscription', async () => {
  const { approveSubscription, createSubscriptionFixture } = await import('../src/domain/chart-service/index.ts');

  const now = '2026-05-23T08:00:00.000Z';
  const subscription = createSubscriptionFixture({ status: 'payment_pending', planId: 'plan_monthly' });
  const approved = approveSubscription(subscription, {
    adminId: 'admin_1',
    approvedAt: now,
    durationDays: 30,
  });

  assert.equal(approved.status, 'active');
  assert.equal(approved.approvedByAdminId, 'admin_1');
  assert.equal(approved.startsAt, now);
  assert.equal(approved.endsAt, '2026-06-22T08:00:00.000Z');
});

test('subscription approval rejects invalid source status', async () => {
  const { approveSubscription, createSubscriptionFixture } = await import('../src/domain/chart-service/index.ts');

  assert.throws(() => approveSubscription(
    createSubscriptionFixture({ status: 'expired' }),
    { adminId: 'admin_1', approvedAt: '2026-05-23T08:00:00.000Z', durationDays: 30 },
  ), /Cannot approve subscription from status expired/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd run build
node --test tests\chart-service-domain.test.mjs
```

Expected: FAIL because subscription functions and fixture do not exist.

- [ ] **Step 3: Create fixture helper file**

Create `src/domain/chart-service/fixtures.ts`:

```ts
import {
  SUBSCRIPTION_STATUSES,
  type PaymentRequestRecord,
  type PaymentStatus,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from './types.ts';

const DEFAULT_NOW = '2026-05-23T00:00:00.000Z';

export function createSubscriptionFixture(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    id: 'sub_1',
    userId: 'user_1',
    planId: null,
    status: SUBSCRIPTION_STATUSES.none,
    startsAt: null,
    endsAt: null,
    approvedByAdminId: null,
    approvedAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    ...overrides,
    status: (overrides.status ?? SUBSCRIPTION_STATUSES.none) as SubscriptionStatus,
  };
}

export function createPaymentRequestFixture(overrides: Partial<PaymentRequestRecord> = {}): PaymentRequestRecord {
  return {
    id: 'pay_1',
    userId: 'user_1',
    planId: 'plan_monthly',
    subscriptionId: 'sub_1',
    method: 'bank_transfer',
    amountUsd: 199,
    amountKrw: 0,
    exchangeRate: null,
    referralPointsUsed: 0,
    status: 'pending' as PaymentStatus,
    depositorName: 'Tester',
    adminNote: null,
    confirmedByAdminId: null,
    confirmedAt: null,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    ...overrides,
  };
}
```

- [ ] **Step 4: Create subscription transition file**

Create `src/domain/chart-service/subscriptions.ts`:

```ts
import {
  SUBSCRIPTION_STATUSES,
  type SubscriptionRecord,
} from './types.ts';

function addDays(isoDate: string, days: number): string {
  const next = new Date(isoDate);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

export function approveSubscription(
  subscription: SubscriptionRecord,
  input: { adminId: string; approvedAt: string; durationDays: number },
): SubscriptionRecord {
  if (
    subscription.status !== SUBSCRIPTION_STATUSES.paymentPending &&
    subscription.status !== SUBSCRIPTION_STATUSES.paymentRequested
  ) {
    throw new Error(`Cannot approve subscription from status ${subscription.status}`);
  }
  if (input.durationDays <= 0) {
    throw new Error('Subscription duration must be greater than zero');
  }
  return {
    ...subscription,
    status: SUBSCRIPTION_STATUSES.active,
    startsAt: input.approvedAt,
    endsAt: addDays(input.approvedAt, input.durationDays),
    approvedByAdminId: input.adminId,
    approvedAt: input.approvedAt,
    updatedAt: input.approvedAt,
  };
}

export function cancelSubscription(
  subscription: SubscriptionRecord,
  input: { adminId: string; cancelledAt: string },
): SubscriptionRecord {
  if (
    subscription.status !== SUBSCRIPTION_STATUSES.active &&
    subscription.status !== SUBSCRIPTION_STATUSES.expiring &&
    subscription.status !== SUBSCRIPTION_STATUSES.cancelRequested
  ) {
    throw new Error(`Cannot cancel subscription from status ${subscription.status}`);
  }
  return {
    ...subscription,
    status: SUBSCRIPTION_STATUSES.cancelled,
    cancelledAt: input.cancelledAt,
    updatedAt: input.cancelledAt,
  };
}

export function refundSubscription(
  subscription: SubscriptionRecord,
  input: { adminId: string; refundedAt: string },
): SubscriptionRecord {
  if (
    subscription.status !== SUBSCRIPTION_STATUSES.active &&
    subscription.status !== SUBSCRIPTION_STATUSES.expiring &&
    subscription.status !== SUBSCRIPTION_STATUSES.refundRequested
  ) {
    throw new Error(`Cannot refund subscription from status ${subscription.status}`);
  }
  return {
    ...subscription,
    status: SUBSCRIPTION_STATUSES.refunded,
    refundedAt: input.refundedAt,
    updatedAt: input.refundedAt,
  };
}
```

- [ ] **Step 5: Export subscription and fixture functions**

Modify `src/domain/chart-service/index.ts`:

```ts
export * from './types.ts';
export * from './access.ts';
export * from './subscriptions.ts';
export * from './fixtures.ts';
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```powershell
npm.cmd run build
node --test tests\chart-service-domain.test.mjs
```

Expected: PASS for subscription transition tests.

- [ ] **Step 7: Commit**

```powershell
git add src/domain/chart-service/subscriptions.ts src/domain/chart-service/fixtures.ts src/domain/chart-service/index.ts tests/chart-service-domain.test.mjs
git commit -m "Add subscription state transitions"
```

## Task 4: Manual Payment Confirmation

**Files:**

- Create: `src/domain/chart-service/payments.ts`
- Modify: `src/domain/chart-service/index.ts`
- Modify: `tests/chart-service-domain.test.mjs`

- [ ] **Step 1: Add failing payment tests**

Append to `tests/chart-service-domain.test.mjs`:

```js
test('admin confirmation marks payment as confirmed', async () => {
  const { confirmPaymentRequest, createPaymentRequestFixture } = await import('../src/domain/chart-service/index.ts');

  const payment = createPaymentRequestFixture({ status: 'pending' });
  const confirmed = confirmPaymentRequest(payment, {
    adminId: 'admin_1',
    confirmedAt: '2026-05-23T09:00:00.000Z',
    adminNote: 'Bank transfer checked',
  });

  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.confirmedByAdminId, 'admin_1');
  assert.equal(confirmed.adminNote, 'Bank transfer checked');
});

test('refunding a payment requires confirmed status', async () => {
  const { refundPaymentRequest, createPaymentRequestFixture } = await import('../src/domain/chart-service/index.ts');

  assert.throws(() => refundPaymentRequest(
    createPaymentRequestFixture({ status: 'pending' }),
    { adminId: 'admin_1', refundedAt: '2026-05-23T09:00:00.000Z', adminNote: 'duplicate' },
  ), /Cannot refund payment from status pending/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd run build
node --test tests\chart-service-domain.test.mjs
```

Expected: FAIL because payment functions are not exported.

- [ ] **Step 3: Create `src/domain/chart-service/payments.ts`**

```ts
import {
  PAYMENT_STATUSES,
  type PaymentRequestRecord,
} from './types.ts';

export function confirmPaymentRequest(
  payment: PaymentRequestRecord,
  input: { adminId: string; confirmedAt: string; adminNote?: string },
): PaymentRequestRecord {
  if (payment.status !== PAYMENT_STATUSES.pending && payment.status !== PAYMENT_STATUSES.requested) {
    throw new Error(`Cannot confirm payment from status ${payment.status}`);
  }
  return {
    ...payment,
    status: PAYMENT_STATUSES.confirmed,
    confirmedByAdminId: input.adminId,
    confirmedAt: input.confirmedAt,
    adminNote: input.adminNote ?? payment.adminNote,
    updatedAt: input.confirmedAt,
  };
}

export function rejectPaymentRequest(
  payment: PaymentRequestRecord,
  input: { adminId: string; rejectedAt: string; adminNote: string },
): PaymentRequestRecord {
  if (payment.status !== PAYMENT_STATUSES.pending && payment.status !== PAYMENT_STATUSES.requested) {
    throw new Error(`Cannot reject payment from status ${payment.status}`);
  }
  return {
    ...payment,
    status: PAYMENT_STATUSES.rejected,
    adminNote: input.adminNote,
    updatedAt: input.rejectedAt,
  };
}

export function refundPaymentRequest(
  payment: PaymentRequestRecord,
  input: { adminId: string; refundedAt: string; adminNote: string },
): PaymentRequestRecord {
  if (payment.status !== PAYMENT_STATUSES.confirmed) {
    throw new Error(`Cannot refund payment from status ${payment.status}`);
  }
  return {
    ...payment,
    status: PAYMENT_STATUSES.refunded,
    adminNote: input.adminNote,
    updatedAt: input.refundedAt,
  };
}
```

- [ ] **Step 4: Export payment functions**

Modify `src/domain/chart-service/index.ts`:

```ts
export * from './types.ts';
export * from './access.ts';
export * from './subscriptions.ts';
export * from './payments.ts';
export * from './fixtures.ts';
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```powershell
npm.cmd run build
node --test tests\chart-service-domain.test.mjs
```

Expected: PASS for payment tests.

- [ ] **Step 6: Commit**

```powershell
git add src/domain/chart-service/payments.ts src/domain/chart-service/index.ts tests/chart-service-domain.test.mjs
git commit -m "Add manual payment transitions"
```

## Task 5: Referral Ledger Confirmation and Reversal

**Files:**

- Create: `src/domain/chart-service/referrals.ts`
- Modify: `src/domain/chart-service/index.ts`
- Modify: `src/domain/chart-service/fixtures.ts`
- Modify: `tests/chart-service-domain.test.mjs`

- [ ] **Step 1: Add failing referral tests**

Append to `tests/chart-service-domain.test.mjs`:

```js
test('referral points confirm after refund window', async () => {
  const { confirmReferralLedger, createReferralLedgerFixture } = await import('../src/domain/chart-service/index.ts');

  const ledger = createReferralLedgerFixture({
    status: 'pending',
    confirmAfter: '2026-05-30T00:00:00.000Z',
  });
  const confirmed = confirmReferralLedger(ledger, '2026-05-31T00:00:00.000Z');

  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.confirmedAt, '2026-05-31T00:00:00.000Z');
});

test('referral points do not confirm before refund window', async () => {
  const { confirmReferralLedger, createReferralLedgerFixture } = await import('../src/domain/chart-service/index.ts');

  assert.throws(() => confirmReferralLedger(
    createReferralLedgerFixture({ confirmAfter: '2026-05-30T00:00:00.000Z' }),
    '2026-05-29T23:59:59.000Z',
  ), /Cannot confirm referral ledger before confirmAfter/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd run build
node --test tests\chart-service-domain.test.mjs
```

Expected: FAIL because referral functions and fixture do not exist.

- [ ] **Step 3: Replace `src/domain/chart-service/fixtures.ts` with referral fixture included**

```ts
import {
  SUBSCRIPTION_STATUSES,
  type PaymentRequestRecord,
  type PaymentStatus,
  type ReferralLedgerRecord,
  type ReferralLedgerStatus,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from './types.ts';

const DEFAULT_NOW = '2026-05-23T00:00:00.000Z';

export function createSubscriptionFixture(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    id: 'sub_1',
    userId: 'user_1',
    planId: null,
    status: SUBSCRIPTION_STATUSES.none,
    startsAt: null,
    endsAt: null,
    approvedByAdminId: null,
    approvedAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    ...overrides,
    status: (overrides.status ?? SUBSCRIPTION_STATUSES.none) as SubscriptionStatus,
  };
}

export function createPaymentRequestFixture(overrides: Partial<PaymentRequestRecord> = {}): PaymentRequestRecord {
  return {
    id: 'pay_1',
    userId: 'user_1',
    planId: 'plan_monthly',
    subscriptionId: 'sub_1',
    method: 'bank_transfer',
    amountUsd: 199,
    amountKrw: 0,
    exchangeRate: null,
    referralPointsUsed: 0,
    status: 'pending' as PaymentStatus,
    depositorName: 'Tester',
    adminNote: null,
    confirmedByAdminId: null,
    confirmedAt: null,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    ...overrides,
  };
}

export function createReferralLedgerFixture(overrides: Partial<ReferralLedgerRecord> = {}): ReferralLedgerRecord {
  return {
    id: 'ref_ledger_1',
    referrerUserId: 'user_referrer',
    referredUserId: 'user_referred',
    paymentRequestId: 'pay_1',
    amountUsd: 199,
    percent: 20,
    points: 39.8,
    status: 'pending' as ReferralLedgerStatus,
    confirmAfter: '2026-05-30T00:00:00.000Z',
    confirmedAt: null,
    reversedAt: null,
    createdAt: DEFAULT_NOW,
    ...overrides,
  };
}
```

- [ ] **Step 4: Create `src/domain/chart-service/referrals.ts`**

```ts
import {
  REFERRAL_LEDGER_STATUSES,
  type ReferralLedgerRecord,
} from './types.ts';

export function confirmReferralLedger(
  ledger: ReferralLedgerRecord,
  confirmedAt: string,
): ReferralLedgerRecord {
  if (ledger.status !== REFERRAL_LEDGER_STATUSES.pending) {
    throw new Error(`Cannot confirm referral ledger from status ${ledger.status}`);
  }
  if (new Date(confirmedAt).getTime() < new Date(ledger.confirmAfter).getTime()) {
    throw new Error('Cannot confirm referral ledger before confirmAfter');
  }
  return {
    ...ledger,
    status: REFERRAL_LEDGER_STATUSES.confirmed,
    confirmedAt,
  };
}

export function reverseReferralLedger(
  ledger: ReferralLedgerRecord,
  reversedAt: string,
): ReferralLedgerRecord {
  if (ledger.status === REFERRAL_LEDGER_STATUSES.reversed) {
    return ledger;
  }
  return {
    ...ledger,
    status: REFERRAL_LEDGER_STATUSES.reversed,
    reversedAt,
  };
}
```

- [ ] **Step 5: Export referral functions**

Modify `src/domain/chart-service/index.ts`:

```ts
export * from './types.ts';
export * from './access.ts';
export * from './subscriptions.ts';
export * from './payments.ts';
export * from './referrals.ts';
export * from './fixtures.ts';
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```powershell
npm.cmd run build
node --test tests\chart-service-domain.test.mjs
```

Expected: PASS for referral tests.

- [ ] **Step 7: Commit**

```powershell
git add src/domain/chart-service/referrals.ts src/domain/chart-service/fixtures.ts src/domain/chart-service/index.ts tests/chart-service-domain.test.mjs
git commit -m "Add referral ledger transitions"
```

## Task 6: Combined Admin Operation Harness

**Files:**

- Modify: `tests/chart-service-domain.test.mjs`

- [ ] **Step 1: Add failing end-to-end domain harness test**

Append to `tests/chart-service-domain.test.mjs`:

```js
test('manual admin flow confirms payment, activates subscription, and later reverses referral on refund', async () => {
  const {
    approveSubscription,
    confirmPaymentRequest,
    createPaymentRequestFixture,
    createReferralLedgerFixture,
    createSubscriptionFixture,
    refundPaymentRequest,
    refundSubscription,
    reverseReferralLedger,
  } = await import('../src/domain/chart-service/index.ts');

  const payment = createPaymentRequestFixture({ status: 'pending' });
  const subscription = createSubscriptionFixture({ status: 'payment_pending', planId: 'plan_monthly' });
  const ledger = createReferralLedgerFixture({ status: 'pending' });

  const confirmedPayment = confirmPaymentRequest(payment, {
    adminId: 'admin_1',
    confirmedAt: '2026-05-23T09:00:00.000Z',
    adminNote: 'manual bank transfer confirmed',
  });
  const activeSubscription = approveSubscription(subscription, {
    adminId: 'admin_1',
    approvedAt: '2026-05-23T09:00:00.000Z',
    durationDays: 30,
  });

  assert.equal(confirmedPayment.status, 'confirmed');
  assert.equal(activeSubscription.status, 'active');

  const refundedPayment = refundPaymentRequest(confirmedPayment, {
    adminId: 'admin_1',
    refundedAt: '2026-05-25T09:00:00.000Z',
    adminNote: 'customer refund completed',
  });
  const refundedSubscription = refundSubscription(activeSubscription, {
    adminId: 'admin_1',
    refundedAt: '2026-05-25T09:00:00.000Z',
  });
  const reversedLedger = reverseReferralLedger(ledger, '2026-05-25T09:00:00.000Z');

  assert.equal(refundedPayment.status, 'refunded');
  assert.equal(refundedSubscription.status, 'refunded');
  assert.equal(reversedLedger.status, 'reversed');
});
```

- [ ] **Step 2: Run test to verify it passes**

Run:

```powershell
npm.cmd run build
node --test tests\chart-service-domain.test.mjs
```

Expected: PASS for all chart service domain tests.

- [ ] **Step 3: Run existing tests**

Run:

```powershell
node --test tests\*.test.mjs
```

Expected: Existing tests and the new domain test pass.

- [ ] **Step 4: Commit**

```powershell
git add tests/chart-service-domain.test.mjs
git commit -m "Add chart service admin flow harness"
```

## Task 7: Next.js Migration Readiness Notes

**Files:**

- Modify: `docs/02-design/features/chart-service-fullstack.design.md`

- [ ] **Step 1: Add a foundation completion note**

Append this section to `docs/02-design/features/chart-service-fullstack.design.md`:

```md
## 17. Foundation Slice Completion Criteria

Before starting the Next.js migration, the repository should contain framework-neutral domain modules for:

- role and subscription status constants
- chart and signal access checks
- subscription approval, cancellation, and refund transitions
- manual payment confirmation, rejection, and refund transitions
- referral ledger confirmation and reversal
- seed-style fixtures for smoke tests

These modules should pass `npm.cmd run build` and `node --test tests\chart-service-domain.test.mjs`.
```

- [ ] **Step 2: Run documentation diff**

Run:

```powershell
git diff -- docs\02-design\features\chart-service-fullstack.design.md
```

Expected: Only the new Section 17 is shown.

- [ ] **Step 3: Commit**

```powershell
git add docs/02-design/features/chart-service-fullstack.design.md
git commit -m "Document chart service foundation completion criteria"
```

## Self-Review Checklist

- [ ] Every task avoids `src/chart/SimpleChart.ts`.
- [ ] Every status string used in tests exists in `SUBSCRIPTION_STATUSES`, `PAYMENT_STATUSES`, or `REFERRAL_LEDGER_STATUSES`.
- [ ] Every function imported by tests is exported from `src/domain/chart-service/index.ts`.
- [ ] Payment confirmation and subscription approval are separate operations, matching the manual admin process.
- [ ] Refund reverses payment/subscription/referral state.
- [ ] The plan builds a backend-separable domain layer before introducing Next.js.

## Execution Recommendation

Use subagent-driven development when executing this plan. Each task owns a small file set and can be reviewed independently before moving to the next task.
