import {
  USER_ROLES,
  type Actor,
  type AuditLogDraft,
} from './types.ts';

export type PasswordPolicyResult = {
  ok: boolean;
  missing: Array<'length' | 'uppercase' | 'lowercase' | 'number' | 'special'>;
};

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const missing: PasswordPolicyResult['missing'] = [];
  if (password.length < 8) missing.push('length');
  if (!/[A-Z]/.test(password)) missing.push('uppercase');
  if (!/[a-z]/.test(password)) missing.push('lowercase');
  if (!/[0-9]/.test(password)) missing.push('number');
  if (!/[^A-Za-z0-9]/.test(password)) missing.push('special');
  return { ok: missing.length === 0, missing };
}

export type ProfileImageUploadInput = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export type UploadPolicyResult = {
  ok: boolean;
  reason: 'ok' | 'unsupported_type' | 'mime_mismatch' | 'too_large';
};

const MAX_PROFILE_IMAGE_BYTES = 300_000;
const PROFILE_IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function validateProfileImageUpload(input: ProfileImageUploadInput): UploadPolicyResult {
  if (input.sizeBytes > MAX_PROFILE_IMAGE_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  const extension = input.filename.split('.').pop()?.toLowerCase() ?? '';
  const expectedMime = PROFILE_IMAGE_MIME_BY_EXTENSION[extension];
  if (!expectedMime) {
    return { ok: false, reason: 'unsupported_type' };
  }
  if (input.mimeType.toLowerCase() !== expectedMime) {
    return { ok: false, reason: 'mime_mismatch' };
  }
  return { ok: true, reason: 'ok' };
}

export function assertAdminActor(actor: Actor): void {
  if (actor.role !== USER_ROLES.admin && actor.role !== USER_ROLES.superAdmin) {
    throw new Error('Admin role required');
  }
}

export function assertSuperAdminActor(actor: Actor): void {
  if (actor.role !== USER_ROLES.superAdmin) {
    throw new Error('Super admin role required');
  }
}

export function createAuditLogDraft(input: {
  actor: Actor;
  action: string;
  targetType: string;
  targetId: string;
  beforeJson: unknown;
  afterJson: unknown;
}): AuditLogDraft {
  assertAdminActor(input.actor);
  return {
    actorAdminId: input.actor.id,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    beforeJson: input.beforeJson,
    afterJson: input.afterJson,
  };
}
