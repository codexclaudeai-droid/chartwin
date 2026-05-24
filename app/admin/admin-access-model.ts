import { canShowAdminNavigation } from '../admin-nav-model.ts';

export type AdminAccessState = 'login_required' | 'forbidden' | 'allowed';

export type AdminAccessInput = {
  authenticated: boolean;
  role: string | null | undefined;
};

export function getAdminAccessState(input: AdminAccessInput): AdminAccessState {
  if (!input.authenticated || !input.role) return 'login_required';
  return canShowAdminNavigation(input.role) ? 'allowed' : 'forbidden';
}
