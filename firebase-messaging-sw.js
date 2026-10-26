/* Firebase Cloud Messaging service worker for أكاديمية دلتا أبين الرياضية */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAsP7W465CjanN3SmjAsVoQv-YCsrtSVsg',
  authDomain: 'dalta-d4f41.firebaseapp.com',
  databaseURL: 'https://dalta-d4f41-default-rtdb.firebaseio.com',
  projectId: 'dalta-d4f41',
  storageBucket: 'dalta-d4f41.firebasestorage.app',
  messagingSenderId: '884646631155',
  appId: '1:884646631155:web:0ed37e925049063cfd0986',
  measurementId: 'G-9EDQ9DYRQZ'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const data = payload && payload.data ? payload.data : {};
  const notification = payload && payload.notification ? payload.notification : {};
  const title = notification.title || data.title || 'أكاديمية دلتا أبين الرياضية';
  const options = {
    body: notification.body || data.body || 'لديك إشعار جديد من الأكاديمية.',
    icon: data.icon || '/favicon.ico',
    data: { url: data.url || '/' }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification && event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/';
  event.waitUntil((async function() {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
