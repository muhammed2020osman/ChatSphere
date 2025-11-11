/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// Take control of all clients immediately
clientsClaim();

// Precache all assets generated during build
precacheAndRoute(self.__WB_MANIFEST);

// Set up App Shell-style routing
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  ({ request, url }: { request: Request; url: URL }) => {
    if (request.mode !== 'navigate') {
      return false;
    }
    if (url.pathname.startsWith('/_')) {
      return false;
    }
    if (url.pathname.match(fileExtensionRegexp)) {
      return false;
    }
    return true;
  },
  createHandlerBoundToURL('/index.html')
);

// Cache Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 4,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
    ],
  })
);

// Cache images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Cache API responses with Network First strategy
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Helper function to update app badge
async function updateAppBadge(count: number | null) {
  if ('setAppBadge' in navigator) {
    try {
      if (count === null || count === 0) {
        await (navigator as any).clearAppBadge();
      } else {
        await (navigator as any).setAppBadge(count);
      }
      console.log(`[Service Worker] Badge updated to: ${count}`);
    } catch (error) {
      console.error('[Service Worker] Error updating badge:', error);
    }
  }
}

// Helper function to get current unread count and update badge
async function updateBadgeFromNotifications() {
  try {
    // Get all notifications
    const notifications = await self.registration.getNotifications();
    const unreadCount = notifications.filter(n => !n.data?.isRead).length;
    await updateAppBadge(unreadCount);
  } catch (error) {
    console.error('[Service Worker] Error updating badge from notifications:', error);
  }
}

// Push event handler
self.addEventListener('push', (event: PushEvent) => {
  console.log('[Service Worker] Push received:', event);
  console.log('[Service Worker] Push event data:', event.data);

  let notificationData: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: any;
  } = {
    title: 'New notification',
    body: 'You have a new notification',
  };

  if (event.data) {
    try {
      const dataText = event.data.text();
      console.log('[Service Worker] Push data text:', dataText);
      notificationData = JSON.parse(dataText);
      console.log('[Service Worker] Parsed notification data:', notificationData);
    } catch (error) {
      console.error('[Service Worker] Error parsing push data:', error);
      // Try to use default notification
    }
  }

  // Ensure we have valid notification data
  if (!notificationData.title || !notificationData.body) {
    console.warn('[Service Worker] Invalid notification data, using defaults');
    notificationData = {
      title: 'New notification',
      body: 'You have a new notification',
    };
  }

  const options: NotificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon || '/icons/icon-192x192.png',
    badge: notificationData.badge || '/icons/icon-192x192.png',
    data: {
      ...notificationData.data,
      isRead: false,
      timestamp: Date.now(),
    },
    tag: notificationData.data?.type || 'notification',
    requireInteraction: false,
    renotify: true,
    vibrate: [200, 100, 200], // Vibrate pattern for Android
    silent: false,
    timestamp: Date.now(),
    // Android-specific options
    ...(notificationData.data?.channelId && {
      tag: `channel-${notificationData.data.channelId}`,
    }),
  };

  console.log('[Service Worker] Showing notification with options:', options);

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(notificationData.title, options),
      updateBadgeFromNotifications(), // Update badge after showing notification
    ])
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[Service Worker] Notification clicked:', event);

  event.notification.close();

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || '/';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Check if there's already a window/tab open (for PWA, match any client)
        for (const client of clientList) {
          // For PWA, focus any open window/tab from the same origin
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin) {
            // Focus the existing window
            if ('focus' in client) {
              client.focus();
            }
            // Use postMessage to navigate if client supports it
            if ('postMessage' in client) {
              client.postMessage({
                type: 'navigate',
                url: urlToOpen,
              });
            }
            return;
          }
        }
        // If no existing window, open a new one
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
      .catch((error) => {
        console.error('[Service Worker] Error handling notification click:', error);
        // Fallback: try to open the URL anyway
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});

// Message handler for communication from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Handle badge update requests
  if (event.data && event.data.type === 'UPDATE_BADGE') {
    const count = event.data.count;
    updateAppBadge(count);
  }
  
  // Handle notification read status
  if (event.data && event.data.type === 'NOTIFICATION_READ') {
    updateBadgeFromNotifications();
  }
});

