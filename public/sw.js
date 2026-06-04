self.addEventListener('push', (event) => {
  event.waitUntil(showLatestNotification());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openNotificationsPage());
});

async function showLatestNotification() {
  const fallbackTitle = 'TradingCore 알림';
  const fallbackBody = '새 알림이 도착했습니다.';

  try {
    const response = await fetch('/api/notifications?summary=1', {
      credentials: 'include',
      cache: 'no-store',
    });
    const payload = response.ok ? await response.json() : null;
    const unreadCount = payload?.summary?.unreadCount ?? 0;
    const body = unreadCount > 0
      ? `읽지 않은 알림 ${unreadCount}건이 있습니다.`
      : fallbackBody;

    await self.registration.showNotification(fallbackTitle, {
      body,
      icon: '/android-chrome-192x192.png',
      badge: '/favicon-32x32.png',
      data: { url: '/notifications?tab=unread' },
    });
  } catch {
    await self.registration.showNotification(fallbackTitle, {
      body: fallbackBody,
      icon: '/android-chrome-192x192.png',
      badge: '/favicon-32x32.png',
      data: { url: '/notifications?tab=unread' },
    });
  }
}

async function openNotificationsPage() {
  const url = '/notifications?tab=unread';
  const windowClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  const existingClient = windowClients.find((client) => (
    new URL(client.url).origin === self.location.origin
  ));

  if (existingClient) {
    await existingClient.navigate(url);
    return existingClient.focus();
  }

  return self.clients.openWindow(url);
}
