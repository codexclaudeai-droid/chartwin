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
  phoneNumber: string | null;
  referralCode: string;
  referredByUserId: string | null;
  createdAt: string;
  passwordHash: string | null;
};

export type PublicServiceUserRecord = Omit<ServiceUserRecord, 'passwordHash'>;

export type AuthSessionRecord = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
};

export type EmailOutboxStatus = 'queued' | 'sent' | 'failed';

export type EmailOutboxRecord = {
  id: string;
  recipientEmail: string;
  template: string;
  subject: string;
  body: string;
  status: EmailOutboxStatus;
  createdAt: string;
  sentAt: string | null;
  lastError: string | null;
};

export type ReferralProgramSettingsRecord = {
  id: string;
  rewardPercent: number;
  updatedByAdminId: string | null;
  updatedAt: string;
};

export type SalesTeamRecord = {
  id: string;
  name: string;
  commissionPercent: number;
  salespersonIds: string[];
  createdAt: string;
  updatedAt: string;
  updatedByAdminId: string | null;
};

export type PaymentTransferSettingsRecord = {
  id: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  bankLogoUrl: string;
  usdtAddress: string;
  usdtNetwork: string;
  updatedByAdminId: string | null;
  updatedAt: string;
};

export type WebInfoSettingsRecord = {
  id: string;
  termsContent: string;
  privacyContent: string;
  updatedByAdminId: string | null;
  updatedAt: string;
};

export type SignupAgreementRecord = {
  id: string;
  userId: string;
  termsAcceptedAt: string;
  privacyAcceptedAt: string;
  termsContent: string;
  privacyContent: string;
  termsSettingsUpdatedAt: string;
  privacySettingsUpdatedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type EmailOutboxFilter = {
  status?: EmailOutboxStatus;
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
  listSessionsByUserId(userId: string): AuthSessionRecord[];
  saveSession(session: AuthSessionRecord): void;
  deleteSession(id: string): void;
  getPasswordResetTokenByTokenHash(tokenHash: string): PasswordResetTokenRecord | null;
  savePasswordResetToken(token: PasswordResetTokenRecord): void;
  listEmailOutboxRecords(filter?: EmailOutboxFilter): EmailOutboxRecord[];
  saveEmailOutboxRecord(record: EmailOutboxRecord): void;
  getSubscriptionById(id: string): SubscriptionRecord | null;
  getSubscriptionByUserId(userId: string): SubscriptionRecord | null;
  listSubscriptions(): SubscriptionRecord[];
  saveSubscription(subscription: SubscriptionRecord): void;
  getPaymentById(id: string): PaymentRequestRecord | null;
  listPayments(): PaymentRequestRecord[];
  savePayment(payment: PaymentRequestRecord): void;
  getReferralProgramSettings(): ReferralProgramSettingsRecord | null;
  saveReferralProgramSettings(settings: ReferralProgramSettingsRecord): void;
  listSalesTeams(): SalesTeamRecord[];
  saveSalesTeam(team: SalesTeamRecord): void;
  getPaymentTransferSettings(): PaymentTransferSettingsRecord | null;
  savePaymentTransferSettings(settings: PaymentTransferSettingsRecord): void;
  getWebInfoSettings(): WebInfoSettingsRecord | null;
  saveWebInfoSettings(settings: WebInfoSettingsRecord): void;
  listSignupAgreementsByUserId(userId: string): SignupAgreementRecord[];
  saveSignupAgreement(agreement: SignupAgreementRecord): void;
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
