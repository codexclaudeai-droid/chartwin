export function normalizeSupportReply(body: string): string {
  return body.trim();
}

export function canSubmitSupportReply(body: string): boolean {
  return normalizeSupportReply(body).length > 0;
}
