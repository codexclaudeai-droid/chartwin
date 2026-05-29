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
  assert.equal(settings.bankLogoUrl.length > 0, true);
  assert.equal(settings.usdtAddress.length > 0, true);
  assert.equal(settings.usdtNetwork.length > 0, true);
});

test('admin can update payment transfer settings and persist them through repository state', () => {
  const repository = createMockChartServiceRepository();

  const updated = updatePaymentTransferSettings(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    bankName: 'KB국민은행',
    bankAccountNumber: '123-456-7890',
    bankAccountHolder: 'TradingCore',
    bankLogoUrl: '/bank-logos/kb.svg',
    usdtAddress: 'TXYZ123456789',
    usdtNetwork: 'TRC20',
    updatedAt: '2026-05-25T03:00:00.000Z',
  });

  assert.equal(updated.bankName, 'KB국민은행');
  assert.equal(updated.bankLogoUrl, '/bank-logos/kb.svg');
  assert.equal(updated.updatedByAdminId, 'admin_1');
  assert.equal(repository.getPaymentTransferSettings()?.usdtNetwork, 'TRC20');
});

test('admin payment transfer setting updates are recorded in audit logs', () => {
  const repository = createMockChartServiceRepository();

  updatePaymentTransferSettings(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    bankName: 'KB Bank',
    bankAccountNumber: '123-456-7890',
    bankAccountHolder: 'TradingCore',
    bankLogoUrl: '/bank-logos/kb.svg',
    usdtAddress: 'TXYZ123456789',
    usdtNetwork: 'TRC20',
    updatedAt: '2026-05-25T03:00:00.000Z',
  });

  const [auditLog] = repository.listAuditLogs();
  assert.equal(auditLog?.actorAdminId, 'admin_1');
  assert.equal(auditLog?.action, 'payment_transfer_settings.update');
  assert.equal(auditLog?.targetType, 'payment_transfer_settings');
  assert.equal(auditLog?.targetId, 'default');
});

test('payment transfer settings reject blank required instructions', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(() => updatePaymentTransferSettings(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    bankName: 'KB국민은행',
    bankAccountNumber: '   ',
    bankAccountHolder: 'TradingCore',
    bankLogoUrl: '/bank-logos/kb.svg',
    usdtAddress: 'TXYZ123456789',
    usdtNetwork: 'TRC20',
    updatedAt: '2026-05-25T03:00:00.000Z',
  }), /Bank account number is required/);
});
