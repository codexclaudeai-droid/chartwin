import { assertAdminActor, type Actor } from '../../domain/chart-service/index.ts';
import type {
  AsyncChartServiceRepository,
} from './async-repository.ts';
import type {
  ChartServiceRepository,
  PaymentTransferSettingsRecord,
} from './repository.ts';

export const DEFAULT_PAYMENT_TRANSFER_SETTINGS_ID = 'default';

export function getDefaultPaymentTransferSettings(): PaymentTransferSettingsRecord {
  return {
    id: DEFAULT_PAYMENT_TRANSFER_SETTINGS_ID,
    bankName: '은행명 입력 필요',
    bankAccountNumber: '계좌번호 입력 필요',
    bankAccountHolder: '예금주 입력 필요',
    bankLogoUrl: '/bank-logos/generic-bank.svg',
    usdtAddress: 'USDT 주소 입력 필요',
    usdtNetwork: 'TRC20',
    updatedByAdminId: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

export function getPaymentTransferSettingsForDisplay(
  repository: ChartServiceRepository,
): PaymentTransferSettingsRecord {
  if (typeof repository.getPaymentTransferSettings !== 'function') {
    return getDefaultPaymentTransferSettings();
  }
  return repository.getPaymentTransferSettings() ?? getDefaultPaymentTransferSettings();
}

export async function getAsyncPaymentTransferSettingsForDisplay(
  repository: AsyncChartServiceRepository,
): Promise<PaymentTransferSettingsRecord> {
  if (typeof repository.getPaymentTransferSettings !== 'function') {
    return getDefaultPaymentTransferSettings();
  }
  return await repository.getPaymentTransferSettings() ?? getDefaultPaymentTransferSettings();
}

export function updatePaymentTransferSettings(
  repository: ChartServiceRepository,
  input: PaymentTransferSettingsInput,
): PaymentTransferSettingsRecord {
  assertAdminActor(input.admin);
  const settings = createPaymentTransferSettingsRecord(input);
  repository.savePaymentTransferSettings(settings);
  return settings;
}

export async function updateAsyncPaymentTransferSettings(
  repository: AsyncChartServiceRepository,
  input: PaymentTransferSettingsInput,
): Promise<PaymentTransferSettingsRecord> {
  assertAdminActor(input.admin);
  const settings = createPaymentTransferSettingsRecord(input);
  await repository.savePaymentTransferSettings(settings);
  return settings;
}

type PaymentTransferSettingsInput = {
  admin: Actor;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  bankLogoUrl: string;
  usdtAddress: string;
  usdtNetwork: string;
  updatedAt: string;
};

function createPaymentTransferSettingsRecord(
  input: PaymentTransferSettingsInput,
): PaymentTransferSettingsRecord {
  return {
    id: DEFAULT_PAYMENT_TRANSFER_SETTINGS_ID,
    bankName: normalizeRequiredText(input.bankName, 'Bank name is required'),
    bankAccountNumber: normalizeRequiredText(input.bankAccountNumber, 'Bank account number is required'),
    bankAccountHolder: normalizeRequiredText(input.bankAccountHolder, 'Bank account holder is required'),
    bankLogoUrl: normalizeRequiredText(input.bankLogoUrl, 'Bank logo URL is required'),
    usdtAddress: normalizeRequiredText(input.usdtAddress, 'USDT address is required'),
    usdtNetwork: normalizeRequiredText(input.usdtNetwork, 'USDT network is required').toUpperCase(),
    updatedByAdminId: input.admin.id,
    updatedAt: input.updatedAt,
  };
}

function normalizeRequiredText(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(message);
  }
  return normalized;
}
