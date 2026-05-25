import { assertAdminActor, type Actor } from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type {
  ChartServiceRepository,
  WebInfoSettingsRecord,
} from './repository.ts';

export const DEFAULT_WEB_INFO_SETTINGS_ID = 'default';

export function getDefaultWebInfoSettings(): WebInfoSettingsRecord {
  return {
    id: DEFAULT_WEB_INFO_SETTINGS_ID,
    termsContent: [
      'TC Chart 서비스 이용약관',
      '1. 회원은 본 서비스를 합법적인 목적과 본인의 책임 범위 안에서 이용합니다.',
      '2. 차트, 시그널, 알림 정보는 투자 참고 자료이며 수익을 보장하지 않습니다.',
      '3. 구독, 입금확인, 환불 및 취소 처리는 관리자 확인 절차에 따라 진행됩니다.',
    ].join('\n'),
    privacyContent: [
      'TC Chart 개인정보보호정책',
      '1. 회원가입과 고객 응대를 위해 이름, 이메일, 연락번호를 수집합니다.',
      '2. 수집 정보는 계정 관리, 구독 처리, 고객센터 응대 목적으로 사용합니다.',
      '3. 법령 또는 회원 동의 없이 개인정보를 외부에 제공하지 않습니다.',
    ].join('\n'),
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
  return repository.getWebInfoSettings() ?? getDefaultWebInfoSettings();
}

export async function getAsyncWebInfoSettingsForDisplay(
  repository: AsyncChartServiceRepository,
): Promise<WebInfoSettingsRecord> {
  if (typeof repository.getWebInfoSettings !== 'function') {
    return getDefaultWebInfoSettings();
  }
  return await repository.getWebInfoSettings() ?? getDefaultWebInfoSettings();
}

export function updateWebInfoSettings(
  repository: ChartServiceRepository,
  input: WebInfoSettingsInput,
): WebInfoSettingsRecord {
  assertAdminActor(input.admin);
  const settings = createWebInfoSettingsRecord(input);
  repository.saveWebInfoSettings(settings);
  return settings;
}

export async function updateAsyncWebInfoSettings(
  repository: AsyncChartServiceRepository,
  input: WebInfoSettingsInput,
): Promise<WebInfoSettingsRecord> {
  assertAdminActor(input.admin);
  const settings = createWebInfoSettingsRecord(input);
  await repository.saveWebInfoSettings(settings);
  return settings;
}

type WebInfoSettingsInput = {
  admin: Actor;
  termsContent: string;
  privacyContent: string;
  updatedAt: string;
};

function createWebInfoSettingsRecord(input: WebInfoSettingsInput): WebInfoSettingsRecord {
  return {
    id: DEFAULT_WEB_INFO_SETTINGS_ID,
    termsContent: normalizeRequiredContent(input.termsContent, 'Terms content is required'),
    privacyContent: normalizeRequiredContent(input.privacyContent, 'Privacy content is required'),
    updatedByAdminId: input.admin.id,
    updatedAt: input.updatedAt,
  };
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
