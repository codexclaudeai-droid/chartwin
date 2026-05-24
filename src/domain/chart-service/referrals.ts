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
