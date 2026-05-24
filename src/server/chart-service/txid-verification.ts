import {
  TRANSACTION_VERIFICATION_STATUSES,
  type PaymentRequestRecord,
  type TransactionVerificationStatus,
} from '../../domain/chart-service/index.ts';

export const TRON_USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRONSCAN_TRANSACTION_API_URL = 'https://apilist.tronscanapi.com/api/transaction-info?hash=';

export type TronScanTransactionPayload = Record<string, unknown>;

export type PaymentTransactionVerificationResult = {
  status: TransactionVerificationStatus;
  message: string;
};

type ParsedTransfer = {
  contractAddress: string;
  toAddress: string;
  amount: number;
  symbol: string;
};

export function createTronScanTransactionUrl(transactionId: string): string {
  return `https://tronscan.org/#/transaction/${encodeURIComponent(transactionId)}`;
}

export async function fetchTronScanTransaction(transactionId: string): Promise<TronScanTransactionPayload> {
  const response = await fetch(`${TRONSCAN_TRANSACTION_API_URL}${encodeURIComponent(transactionId)}`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`TronScan request failed: ${response.status}`);
  }
  return await response.json() as TronScanTransactionPayload;
}

export function verifyTronUsdtTransactionPayload(input: {
  payment: PaymentRequestRecord;
  expectedAddress: string;
  transactionPayload: TronScanTransactionPayload;
}): PaymentTransactionVerificationResult {
  const transactionId = input.payment.transactionId?.trim();
  if (!transactionId) {
    return failedResult('USDT TXID is missing.');
  }

  const payloadHash = readFirstString(input.transactionPayload, ['hash', 'txID', 'txid', 'transaction_id']);
  if (payloadHash && !sameText(payloadHash, transactionId)) {
    return mismatchResult('TronScan transaction hash does not match the submitted TXID.');
  }

  const confirmed = readBoolean(input.transactionPayload.confirmed ?? input.transactionPayload.confirm);
  if (confirmed === false) {
    return mismatchResult('TronScan transaction is not confirmed yet.');
  }

  const contractRet = readFirstString(input.transactionPayload, ['contractRet', 'contract_ret', 'ret']);
  if (contractRet && !/success/i.test(contractRet)) {
    return mismatchResult(`TronScan transaction result is ${contractRet}.`);
  }

  const transfers = parseTronScanTransfers(input.transactionPayload)
    .filter((transfer) => sameText(transfer.contractAddress, TRON_USDT_TRC20_CONTRACT) || sameText(transfer.symbol, 'USDT'));
  if (transfers.length === 0) {
    return mismatchResult('TronScan USDT TRC20 transfer was not found.');
  }

  const expectedAddress = input.expectedAddress.trim();
  const recipientTransfer = transfers.find((transfer) => sameText(transfer.toAddress, expectedAddress));
  if (!recipientTransfer) {
    return mismatchResult('TronScan recipient address does not match the configured USDT address.');
  }
  if (recipientTransfer.amount + Number.EPSILON < input.payment.amountUsd) {
    return mismatchResult(`TronScan amount ${recipientTransfer.amount} USDT is below requested ${input.payment.amountUsd} USDT.`);
  }

  return {
    status: TRANSACTION_VERIFICATION_STATUSES.verified,
    message: `TronScan confirmed ${recipientTransfer.amount} USDT to ${expectedAddress}.`,
  };
}

export function createFailedTransactionVerificationResult(error: unknown): PaymentTransactionVerificationResult {
  const message = error instanceof Error ? error.message : 'TronScan lookup failed.';
  return failedResult(message);
}

function parseTronScanTransfers(payload: TronScanTransactionPayload): ParsedTransfer[] {
  const transferSources = [
    payload.trc20TransferInfo,
    payload.trc20TransferInfoList,
    payload.transfersAllList,
    payload.tokenTransferInfo,
  ];
  return transferSources.flatMap((source) => {
    const rows = Array.isArray(source) ? source : source && typeof source === 'object' ? [source] : [];
    return rows.map(parseTransfer).filter((transfer): transfer is ParsedTransfer => transfer !== null);
  });
}

function parseTransfer(value: unknown): ParsedTransfer | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const tokenInfo = row.tokenInfo && typeof row.tokenInfo === 'object'
    ? row.tokenInfo as Record<string, unknown>
    : {};
  const contractAddress = readFirstString(row, ['contract_address', 'contractAddress', 'token_contract_address'])
    ?? readFirstString(tokenInfo, ['tokenId', 'contract_address'])
    ?? '';
  const toAddress = readFirstString(row, ['to_address', 'toAddress', 'to']) ?? '';
  const symbol = readFirstString(row, ['symbol', 'tokenAbbr']) ?? readFirstString(tokenInfo, ['tokenAbbr', 'tokenName']) ?? '';
  const decimals = readNumber(row.decimals ?? row.tokenDecimal ?? tokenInfo.tokenDecimal) ?? 6;
  const rawAmount = readFirstString(row, ['amount_str', 'quant', 'amount', 'value']) ?? '0';
  const amount = parseTransferAmount(rawAmount, decimals);

  if (!contractAddress || !toAddress || !Number.isFinite(amount)) return null;
  return { contractAddress, toAddress, amount, symbol };
}

function parseTransferAmount(value: string, decimals: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Number.NaN;
  if (value.includes('.')) return numeric;
  return numeric / 10 ** decimals;
}

function readFirstString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function sameText(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function mismatchResult(message: string): PaymentTransactionVerificationResult {
  return { status: TRANSACTION_VERIFICATION_STATUSES.mismatch, message };
}

function failedResult(message: string): PaymentTransactionVerificationResult {
  return { status: TRANSACTION_VERIFICATION_STATUSES.failed, message };
}
