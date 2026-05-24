export const ADMIN_SUPPORT_THREAD_QUERY_PARAM = 'supportThread';

export function createAdminSupportThreadPath(threadId: string): string {
  return `/admin?${ADMIN_SUPPORT_THREAD_QUERY_PARAM}=${encodeURIComponent(threadId)}#admin-support`;
}
