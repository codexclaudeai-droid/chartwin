export function normalizeAdminOperationNote(note: string): string {
  return note.trim();
}

export function canSubmitAdminOperationNote(note: string): boolean {
  return normalizeAdminOperationNote(note).length > 0;
}
