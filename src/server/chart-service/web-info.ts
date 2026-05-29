import { assertAdminActor, createAuditLogDraft, type Actor } from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type {
  ChartServiceRepository,
  WebInfoSettingsRecord,
} from './repository.ts';

export const DEFAULT_WEB_INFO_SETTINGS_ID = 'default';
export const DEFAULT_PLAN_SERVICES: Record<string, string[]> = {
  plan_monthly: [
    'TC Chart 접근',
    '유료 시그널 열람',
    '마이프로필 구독 상태 확인',
    '30일 단위로 부담 없이 이용',
  ],
  plan_half_year: [
    'TC Chart 접근',
    '유료 시그널 열람',
    '마이프로필 구독 상태 확인',
    '6개월 추천 플랜 할인 적용',
    '입금확인 요청 우선 검토',
  ],
  plan_yearly: [
    'TC Chart 접근',
    '유료 시그널 열람',
    '마이프로필 구독 상태 확인',
    '12개월 장기 할인 적용',
    '장기 이용자 운영 안내',
  ],
};

export function getDefaultWebInfoSettings(): WebInfoSettingsRecord {
  return {
    id: DEFAULT_WEB_INFO_SETTINGS_ID,
    termsContent: [
      'TradingCore 서비스 이용약관',
      '1. 회원은 본 서비스를 합법적인 목적과 본인의 책임 범위 안에서 이용합니다.',
      '2. 차트, 시그널, 알림 정보는 투자 참고 자료이며 수익을 보장하지 않습니다.',
      '3. 구독, 입금확인, 환불 및 취소 처리는 관리자 확인 절차에 따라 진행됩니다.',
    ].join('\n'),
    privacyContent: [
      'TradingCore 개인정보보호정책',
      '1. 회원가입과 고객 응대를 위해 이름, 이메일, 연락번호를 수집합니다.',
      '2. 수집 정보는 계정 관리, 구독 처리, 고객센터 응대 목적으로 사용합니다.',
      '3. 법령 또는 회원 동의 없이 개인정보를 외부에 제공하지 않습니다.',
    ].join('\n'),
    planServices: clonePlanServices(DEFAULT_PLAN_SERVICES),
    updatedByAdminId: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

export function getWebInfoSettingsForDisplay(
  repository: ChartServiceRepository,
): WebInfoSettingsRecord {
  if (typeof repository.getWebInfoSettings !== 'function') {
    return getDefaultWebInfoSettings();
  }
  return mergeWebInfoSettingsWithDefaults(repository.getWebInfoSettings());
}

export async function getAsyncWebInfoSettingsForDisplay(
  repository: AsyncChartServiceRepository,
): Promise<WebInfoSettingsRecord> {
  if (typeof repository.getWebInfoSettings !== 'function') {
    return getDefaultWebInfoSettings();
  }
  return mergeWebInfoSettingsWithDefaults(await repository.getWebInfoSettings());
}

export function updateWebInfoSettings(
  repository: ChartServiceRepository,
  input: WebInfoSettingsInput,
): WebInfoSettingsRecord {
  assertAdminActor(input.admin);
  const before = getWebInfoSettingsForDisplay(repository);
  const settings = createWebInfoSettingsRecord(input);
  repository.saveWebInfoSettings(settings);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.web_info.settings.update',
    targetType: 'web_info_settings',
    targetId: settings.id,
    beforeJson: { settings: before },
    afterJson: { settings },
  }));
  return settings;
}

export async function updateAsyncWebInfoSettings(
  repository: AsyncChartServiceRepository,
  input: WebInfoSettingsInput,
): Promise<WebInfoSettingsRecord> {
  assertAdminActor(input.admin);
  const before = await getAsyncWebInfoSettingsForDisplay(repository);
  const settings = createWebInfoSettingsRecord(input);
  await repository.saveWebInfoSettings(settings);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.web_info.settings.update',
    targetType: 'web_info_settings',
    targetId: settings.id,
    beforeJson: { settings: before },
    afterJson: { settings },
  }));
  return settings;
}

type WebInfoSettingsInput = {
  admin: Actor;
  termsContent: string;
  privacyContent: string;
  planServices?: Record<string, string[]>;
  updatedAt: string;
};

function createWebInfoSettingsRecord(input: WebInfoSettingsInput): WebInfoSettingsRecord {
  return {
    id: DEFAULT_WEB_INFO_SETTINGS_ID,
    termsContent: normalizeRequiredContent(input.termsContent, 'Terms content is required'),
    privacyContent: normalizeRequiredContent(input.privacyContent, 'Privacy content is required'),
    planServices: normalizePlanServices(input.planServices ?? DEFAULT_PLAN_SERVICES),
    updatedByAdminId: input.admin.id,
    updatedAt: input.updatedAt,
  };
}

function mergeWebInfoSettingsWithDefaults(settings: WebInfoSettingsRecord | null): WebInfoSettingsRecord {
  const defaults = getDefaultWebInfoSettings();
  if (!settings) return defaults;
  return {
    ...settings,
    planServices: {
      ...clonePlanServices(defaults.planServices),
      ...normalizePlanServices(settings.planServices ?? defaults.planServices),
    },
  };
}

function normalizePlanServices(planServices: Record<string, string[]>): Record<string, string[]> {
  const normalized = Object.fromEntries(
    Object.entries(planServices).map(([planId, services]) => {
      const normalizedServices = services.map((service) => service.trim());
      if (normalizedServices.some((service) => service.length === 0)) {
        throw new Error('Plan services must not include blank items');
      }
      return [planId, normalizedServices];
    }),
  );
  if (Object.values(normalized).some((services) => services.length === 0)) {
    throw new Error('Plan services must not include blank items');
  }
  return normalized;
}

function clonePlanServices(planServices: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(planServices).map(([planId, services]) => [planId, [...services]]),
  );
}

function normalizeRequiredContent(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(message);
  }
  if (normalized.length > 20_000) {
    throw new Error('Web info content too long');
  }
  return normalized;
}
