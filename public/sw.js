/**
 * F16-07 — Service Worker for Web Push Notifications
 * Handles push events, shows native OS notifications with tag collapse,
 * and navigates to actionUrl on click.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'New notification', body: event.data.text() }
  }

  const options = {
    body: data.body || '',
    icon: '/images/logo-icon-3c4d76.png',
    badge: '/images/logo-icon-3c4d76.png',
    tag: data.tag || 'default',
    renotify: true,
    data: { actionUrl: data.actionUrl || '/' },
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options).then(() => {
      // Notify all open tabs so they can update badge + show in-app toast
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'PUSH_NOTIFICATION',
            payload: {
              id: data.id || `push-${Date.now()}`,
              title: data.title,
              message: data.body,
              type: data.tag,
              actionUrl: data.actionUrl,
            },
          })
        })
      })
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const actionUrl = event.notification.data?.actionUrl || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing tab if found
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then((focused) => {
              if (focused && 'navigate' in focused) {
                return focused.navigate(actionUrl)
              }
            })
          }
        }
        // No existing tab — open new one
        return self.clients.openWindow(actionUrl)
      }),
  )
})
