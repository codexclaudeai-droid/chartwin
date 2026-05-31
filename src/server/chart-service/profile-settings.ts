import {
  validatePasswordPolicy,
  validateProfileImageUpload,
  type Actor,
} from '../../domain/chart-service/index.ts';
import { createPasswordHash, verifyPasswordHash } from './passwords.ts';
import type { ChartServiceRepository, ServiceUserRecord } from './repository.ts';

export function updateAuthenticatedUserProfile(
  repository: ChartServiceRepository,
  input: {
    actor: Actor;
    name: string;
    phoneNumber?: string | null;
    currentPassword?: string;
    newPassword?: string;
  },
): ServiceUserRecord {
  const user = repository.getUserById(input.actor.id);
  if (!user) throw new Error(`User not found: ${input.actor.id}`);

  const name = input.name.trim();
  if (!name) throw new Error('Profile name required');
  if (name.length > 80) throw new Error('Profile name too long');
  const phoneNumber = Object.hasOwn(input, 'phoneNumber')
    ? normalizeProfilePhoneNumber(input.phoneNumber)
    : user.phoneNumber;
  const passwordHash = getUpdatedPasswordHash(user, {
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
  });

  const updatedUser = {
    ...user,
    name,
    phoneNumber,
    passwordHash,
  };
  repository.saveUser(updatedUser);
  return updatedUser;
}

export function updateAuthenticatedUserProfileImage(
  repository: ChartServiceRepository,
  input: {
    actor: Actor;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl: string;
  },
): ServiceUserRecord {
  const user = repository.getUserById(input.actor.id);
  if (!user) throw new Error(`User not found: ${input.actor.id}`);

  const policy = validateProfileImageUpload(input);
  if (!policy.ok) throw new Error(`Profile image policy failed: ${policy.reason}`);
  assertProfileImageDataUrl(input.dataUrl, input.mimeType);

  const updatedUser = {
    ...user,
    profileImageDataUrl: input.dataUrl,
  };
  repository.saveUser(updatedUser);
  return updatedUser;
}

export function assertProfileImageDataUrl(dataUrl: string, mimeType: string): void {
  const prefix = `data:${mimeType.toLowerCase()};base64,`;
  if (!dataUrl.toLowerCase().startsWith(prefix)) {
    throw new Error('Profile image data URL invalid');
  }
  const encoded = dataUrl.slice(prefix.length);
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error('Profile image data URL invalid');
  }
}

function normalizeProfilePhoneNumber(value: string | null | undefined): string | null {
  const phoneNumber = String(value ?? '').trim();
  if (!phoneNumber) return null;
  if (phoneNumber.length > 30) throw new Error('Contact phone number too long');
  if (!/^[0-9+\-().\s]{7,30}$/.test(phoneNumber)) {
    throw new Error('Contact phone number invalid');
  }
  return phoneNumber;
}

function getUpdatedPasswordHash(
  user: ServiceUserRecord,
  input: { currentPassword?: string; newPassword?: string },
): string | null {
  const newPassword = input.newPassword?.trim() ?? '';
  if (!newPassword) return user.passwordHash;

  if (!verifyPasswordHash(input.currentPassword ?? '', user.passwordHash)) {
    throw new Error('Current password is incorrect');
  }
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.ok) {
    throw new Error(`Password policy failed: ${policy.missing.join(', ')}`);
  }
  return createPasswordHash(newPassword);
}
