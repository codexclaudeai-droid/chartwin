import type { Actor } from '../../domain/chart-service/index.ts';
import type { ChartServiceRepository, ServiceUserRecord } from './repository.ts';

export function updateAuthenticatedUserProfile(
  repository: ChartServiceRepository,
  input: { actor: Actor; name: string },
): ServiceUserRecord {
  const user = repository.getUserById(input.actor.id);
  if (!user) throw new Error(`User not found: ${input.actor.id}`);

  const name = input.name.trim();
  if (!name) throw new Error('Profile name required');
  if (name.length > 80) throw new Error('Profile name too long');

  const updatedUser = {
    ...user,
    name,
  };
  repository.saveUser(updatedUser);
  return updatedUser;
}

