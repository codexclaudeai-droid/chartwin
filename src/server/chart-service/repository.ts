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
  profileImageDataUrl: string | null;
  referralCode: string;
  referredByUserId: string | null;
  createdAt: string;
  passwordHash: string | null;
  emailVerifiedAt: string | null;
};

export type PublicServiceUserRecord = Omit<ServiceUserRecord, 'passwordHash'>;

export type SocialAuthProvider = 'google' | 'naver' | 'kakao';

export type SocialAuthAccountRecord = {
  id: string;
  provider: SocialAuthProvider;
  providerUserId: string;
  userId: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthSessionRecord = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type PushSubscriptionRecord = {
  endpoint: string;
  userId: string;
  p256dh: string;
  auth: string;
  expirationTime: number | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
};

export type EmailVerificationTokenRecord = {
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
  senderEmail: string;
  recipientEmail: string;
  template: string;
  subject: string;
  body: string;
  status: EmailOutboxStatus;
  createdAt: string;
  sentAt: string | null;
  lastError: string | null;
};

export type PurgedUnverifiedUserAccountRecord = {
  user: ServiceUserRecord;
  deletedSessionCount: number;
  deletedEmailOutboxCount: number;
};

export type ReferralProgramSettingsRecord = {
  id: string;
  subscriberCashbackPercent: number;
  rewardPercent: number;
  salespersonRewardPercent: number;
  salesTeamRewardPercent: number;
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

export type FreeTrialPolicySettingsRecord = {
  id: string;
  baseDurationDays: number;
  eventEnabled: boolean;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  eventDurationDays: number | null;
  eventAllowReapply: boolean;
  updatedByAdminId: string | null;
  updatedAt: string;
};

export type FreeTrialUserAllowanceRecord = {
  userId: string;
  remainingCount: number;
  note: string | null;
  updatedByAdminId: string | null;
  updatedAt: string;
};

export type FreeTrialUsageSource = 'standard' | 'global_event' | 'user_allowance';

export type FreeTrialUsageRecord = {
  id: string;
  userId: string;
  subscriptionId: string;
  source: FreeTrialUsageSource;
  startedAt: string;
  endsAt: string;
  durationDays: number;
  policySnapshot: Record<string, unknown>;
  createdAt: string;
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
  planServices: Record<string, string[]>;
  updatedByAdminId: string | null;
  updatedAt: string;
};

export type ChartUserSettingsRecord = {
  userId: string;
  settings: Record<string, unknown>;
  updatedAt: string;
};

export type SignalAdminSettingsRecord = {
  id: string;
  hiddenSymbols: string[];
  disabledSymbols: string[];
  hiddenStrategyIds: string[];
  strategyMgmtVisible: boolean;
  selectedStrategyId: string;
  updatedAt: string;
};

export type TelegramSignalEventType = 'buy' | 'sell' | 'stop_loss' | 'take_profit';

export type TelegramConnectionTestStatus = 'success' | 'failed';

export type TelegramDeliveryStatus = 'sent' | 'failed';

export type TelegramBotProfileRecord = {
  id: string;
  name: string;
  botToken: string;
  chatId: string;
  isEnabled: boolean;
  eventTypes: TelegramSignalEventType[];
  strategyIds: string[];
  symbolIds: string[];
  timeframeIds: string[];
  lastTestedAt: string | null;
  lastTestStatus: TelegramConnectionTestStatus | null;
  lastTestError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TelegramDeliveryLogRecord = {
  id: string;
  profileId: string;
  eventType: TelegramSignalEventType;
  strategyId: string;
  symbolId: string;
  message: string;
  status: TelegramDeliveryStatus;
  telegramMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type TelegramSignalWatchStateRecord = {
  key: string;
  strategyId: string;
  symbolId: string;
  timeframe: string;
  lastCheckedCandleTime: number;
  lastSignalCandleTime: number | null;
  lastSignalEventType: TelegramSignalEventType | null;
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

export type PublicBoardCategory = 'notice' | 'qna' | 'faq';

export type PublicBoardPostRecord = {
  id: string;
  category: PublicBoardCategory;
  title: string;
  body: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  updatedByAdminId: string | null;
};

export type NoticePopupRecord = {
  id: string;
  title: string;
  bodyHtml: string;
  isActive: boolean;
  sortOrder: number;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByAdminId: string | null;
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
  purgeUnverifiedUserByEmail(email: string): PurgedUnverifiedUserAccountRecord | null;
  getSocialAuthAccount(provider: SocialAuthProvider, providerUserId: string): SocialAuthAccountRecord | null;
  listSocialAuthAccountsByUserId(userId: string): SocialAuthAccountRecord[];
  saveSocialAuthAccount(account: SocialAuthAccountRecord): void;
  getSessionById(id: string): AuthSessionRecord | null;
  listSessionsByUserId(userId: string): AuthSessionRecord[];
  saveSession(session: AuthSessionRecord): void;
  deleteSession(id: string): void;
  listPushSubscriptionsByUserId(userId: string): PushSubscriptionRecord[];
  savePushSubscription(subscription: PushSubscriptionRecord): void;
  deletePushSubscription(userId: string, endpoint: string): void;
  getPasswordResetTokenByTokenHash(tokenHash: string): PasswordResetTokenRecord | null;
  savePasswordResetToken(token: PasswordResetTokenRecord): void;
  getEmailVerificationTokenByTokenHash(tokenHash: string): EmailVerificationTokenRecord | null;
  saveEmailVerificationToken(token: EmailVerificationTokenRecord): void;
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
  getFreeTrialPolicySettings(): FreeTrialPolicySettingsRecord | null;
  saveFreeTrialPolicySettings(settings: FreeTrialPolicySettingsRecord): void;
  getFreeTrialUserAllowanceByUserId(userId: string): FreeTrialUserAllowanceRecord | null;
  saveFreeTrialUserAllowance(allowance: FreeTrialUserAllowanceRecord): void;
  listFreeTrialUsageRecordsByUserId(userId: string): FreeTrialUsageRecord[];
  saveFreeTrialUsageRecord(record: FreeTrialUsageRecord): void;
  getPaymentTransferSettings(): PaymentTransferSettingsRecord | null;
  savePaymentTransferSettings(settings: PaymentTransferSettingsRecord): void;
  getWebInfoSettings(): WebInfoSettingsRecord | null;
  saveWebInfoSettings(settings: WebInfoSettingsRecord): void;
  getChartUserSettings(userId: string): ChartUserSettingsRecord | null;
  saveChartUserSettings(settings: ChartUserSettingsRecord): void;
  getSignalAdminSettings(id: string): SignalAdminSettingsRecord | null;
  saveSignalAdminSettings(settings: SignalAdminSettingsRecord): void;
  listTelegramBotProfiles(): TelegramBotProfileRecord[];
  getTelegramBotProfileById(id: string): TelegramBotProfileRecord | null;
  saveTelegramBotProfile(profile: TelegramBotProfileRecord): void;
  deleteTelegramBotProfile(id: string): void;
  listTelegramDeliveryLogs(limit?: number): TelegramDeliveryLogRecord[];
  saveTelegramDeliveryLog(log: TelegramDeliveryLogRecord): void;
  getTelegramSignalWatchState(key: string): TelegramSignalWatchStateRecord | null;
  saveTelegramSignalWatchState(state: TelegramSignalWatchStateRecord): void;
  listSignupAgreementsByUserId(userId: string): SignupAgreementRecord[];
  saveSignupAgreement(agreement: SignupAgreementRecord): void;
  listReferralLedgersByPaymentId(paymentRequestId: string): ReferralLedgerRecord[];
  saveReferralLedger(ledger: ReferralLedgerRecord): void;
  listPublicBoardPosts(): PublicBoardPostRecord[];
  savePublicBoardPost(post: PublicBoardPostRecord): void;
  listNoticePopups(): NoticePopupRecord[];
  saveNoticePopup(popup: NoticePopupRecord): void;
  deleteNoticePopup(id: string): void;
  getSupportThreadById(id: string): SupportThreadRecord | null;
  listSupportThreads(): SupportThreadRecord[];
  saveSupportThread(thread: SupportThreadRecord): void;
  deleteSupportThread(id: string): void;
  getSupportMessageById(id: string): SupportMessageRecord | null;
  listSupportMessagesByThreadId(threadId: string): SupportMessageRecord[];
  saveSupportMessage(message: SupportMessageRecord): void;
  deleteSupportMessage(id: string): void;
  deleteSupportMessagesByThreadId(threadId: string): void;
  listNotificationsByUserId(userId: string): NotificationRecord[];
  saveNotification(notification: NotificationRecord): void;
  appendAuditLog(auditLog: AuditLogDraft): void;
  listAuditLogs(): AuditLogDraft[];
};

export type AdminOperationInput = {
  admin: Actor;
};
