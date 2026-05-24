export function createTronScanTransactionUrl(transactionId: string): string {
  return `https://tronscan.org/#/transaction/${encodeURIComponent(transactionId)}`;
}
