export const ADMIN_SUPPORT_THREAD_QUERY_PARAM = 'supportThread';

export function createAdminSupportThreadUrl(threadId: string): string {
  return `/admin?${ADMIN_SUPPORT_THREAD_QUERY_PARAM}=${encodeURIComponent(threadId)}#admin-support`;
}

export function getAdminSupportThreadDomId(threadId: string): string {
  return `admin-support-thread-${threadId}`;
}

export function getAdminSupportReplyInputId(threadId: string): string {
  return `admin-support-reply-${threadId}`;
}
