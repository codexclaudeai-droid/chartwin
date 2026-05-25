import type { AsyncChartServiceRepository } from './async-repository.ts';
import type {
  ChartServiceRepository,
  SignupAgreementRecord,
  WebInfoSettingsRecord,
} from './repository.ts';

export type SignupAgreementEvidenceInput = {
  userId: string;
  acceptedAt: string;
  webInfoSettings: WebInfoSettingsRecord;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function saveSignupAgreementEvidence(
  repository: ChartServiceRepository,
  input: SignupAgreementEvidenceInput,
): SignupAgreementRecord {
  const agreement = createSignupAgreementRecord(repository.nextId('signup_agreement'), input);
  repository.saveSignupAgreement(agreement);
  return agreement;
}

export async function saveAsyncSignupAgreementEvidence(
  repository: AsyncChartServiceRepository,
  input: SignupAgreementEvidenceInput,
): Promise<SignupAgreementRecord> {
  const agreement = createSignupAgreementRecord(await repository.nextId('signup_agreement'), input);
  await repository.saveSignupAgreement(agreement);
  return agreement;
}

function createSignupAgreementRecord(
  id: string,
  input: SignupAgreementEvidenceInput,
): SignupAgreementRecord {
  return {
    id,
    userId: input.userId,
    termsAcceptedAt: input.acceptedAt,
    privacyAcceptedAt: input.acceptedAt,
    termsContent: input.webInfoSettings.termsContent,
    privacyContent: input.webInfoSettings.privacyContent,
    termsSettingsUpdatedAt: input.webInfoSettings.updatedAt,
    privacySettingsUpdatedAt: input.webInfoSettings.updatedAt,
    ipAddress: normalizeOptionalText(input.ipAddress),
    userAgent: normalizeOptionalText(input.userAgent),
    createdAt: input.acceptedAt,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}
