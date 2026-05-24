export function getAdminMutationErrorStatus(error: unknown): 400 | 401 | 403 {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('Super admin role required')) return 403;
  if (
    message.includes('Session required') ||
    message.includes('Session not found') ||
    message.includes('Session expired') ||
    message.includes('Account suspended') ||
    message.includes('Admin role required')
  ) {
    return 401;
  }

  return 400;
}

export function getAuthenticatedMutationErrorStatus(error: unknown): 400 | 401 {
  const message = error instanceof Error ? error.message : '';
  if (
    message.includes('Session required') ||
    message.includes('Session not found') ||
    message.includes('Session expired') ||
    message.includes('Account suspended')
  ) {
    return 401;
  }

  return 400;
}
