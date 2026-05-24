import type {
  Actor,
  AuditLogDraft,
  NotificationRecord,
  PaymentRequestRecord,
  ReferralLedgerRecord,
  SubscriptionPlan,
  SubscriptionRecord,
  SupportMessageRecord,
  SupportThreadRecord,
  UserAccountStatus,
  UserRole,
} from '../../domain/chart-service/index.ts';

export type ServiceUserRecord = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accountStatus: UserAccountStatus;
  passwordHash: string | null;
};

export type PublicServiceUserRecord = Omit<ServiceUserRecord, 'passwordHash'>;

export type AuthSessionRecord = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type ChartServiceRepository = {
  nextId(prefix: string): string;
  listPlans(): SubscriptionPlan[];
  getPlanById(id: string): SubscriptionPlan | null;
  savePlan(plan: SubscriptionPlan): void;
  listUsers(): ServiceUserRecord[];
  getUserById(id: string): ServiceUserRecord | null;
  getUserByEmail(email: string): ServiceUserRecord | null;
  saveUser(user: ServiceUserRecord): void;
  getSessionById(id: string): AuthSessionRecord | null;
  saveSession(session: AuthSessionRecord): void;
  deleteSession(id: string): void;
  getSubscriptionById(id: string): SubscriptionRecord | null;
  getSubscriptionByUserId(userId: string): SubscriptionRecord | null;
  listSubscriptions(): SubscriptionRecord[];
  saveSubscription(subscription: SubscriptionRecord): void;
  getPaymentById(id: string): PaymentRequestRecord | null;
  listPayments(): PaymentRequestRecord[];
  savePayment(payment: PaymentRequestRecord): void;
  listReferralLedgersByPaymentId(paymentRequestId: string): ReferralLedgerRecord[];
  saveReferralLedger(ledger: ReferralLedgerRecord): void;
  getSupportThreadById(id: string): SupportThreadRecord | null;
  listSupportThreads(): SupportThreadRecord[];
  saveSupportThread(thread: SupportThreadRecord): void;
  listSupportMessagesByThreadId(threadId: string): SupportMessageRecord[];
  saveSupportMessage(message: SupportMessageRecord): void;
  listNotificationsByUserId(userId: string): NotificationRecord[];
  saveNotification(notification: NotificationRecord): void;
  appendAuditLog(auditLog: AuditLogDraft): void;
  listAuditLogs(): AuditLogDraft[];
};

export type AdminOperationInput = {
  admin: Actor;
};
