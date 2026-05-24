export function formatNotificationBadgeCount(unreadCount: number): string | null {
  if (unreadCount <= 0) return null;
  if (unreadCount > 99) return '99+';
  return String(unreadCount);
}
