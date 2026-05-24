import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMockChartServiceRepository,
  getPaymentTransferSettingsForDisplay,
  updatePaymentTransferSettings,
} from '../src/server/chart-service/index.ts';

test('payment transfer settings default to bank and USDT placeholders for display', () => {
  const repository = createMockChartServiceRepository();

  const settings = getPaymentTransferSettingsForDisplay(repository);

  assert.equal(settings.bankAccountNumber.length > 0, true);
  assert.equal(settings.bankAccountHolder.length > 0, true);
  assert.equal(settings.usdtAddress.length > 0, true);
  assert.equal(settings.usdtNetwork.length > 0, true);
});

test('admin can update payment transfer settings and persist them through repository state', () => {
  const repository = createMockChartServiceRepository();

  const updated = updatePaymentTransferSettings(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    bankName: 'KB국민은행',
    bankAccountNumber: '123-456-7890',
    bankAccountHolder: 'TC Chart',
    usdtAddress: 'TXYZ123456789',
    usdtNetwork: 'TRC20',
    updatedAt: '2026-05-25T03:00:00.000Z',
  });

  assert.equal(updated.bankName, 'KB국민은행');
  assert.equal(updated.updatedByAdminId, 'admin_1');
  assert.equal(repository.getPaymentTransferSettings()?.usdtNetwork, 'TRC20');
});

test('payment transfer settings reject blank required instructions', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(() => updatePaymentTransferSettings(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    bankName: 'KB국민은행',
    bankAccountNumber: '   ',
    bankAccountHolder: 'TC Chart',
    usdtAddress: 'TXYZ123456789',
    usdtNetwork: 'TRC20',
    updatedAt: '2026-05-25T03:00:00.000Z',
  }), /Bank account number is required/);
});
