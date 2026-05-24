import { canAccessAdmin, type UserRole } from '../src/domain/chart-service/index.ts';

export function canShowAdminNavigation(role: string | null | undefined): boolean {
  if (!role) return false;
  return canAccessAdmin({ role: role as UserRole });
}
