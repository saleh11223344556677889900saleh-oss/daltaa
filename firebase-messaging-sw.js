/* ضعه في جذر الموقع بحيث يفتح على: https://موقعك/firebase-messaging-sw.js */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAsP7W465CjanN3SmjAsVoQv-YCsrtSVsg',
  authDomain: 'dalta-d4f41.firebaseapp.com',
  databaseURL: 'https://dalta-d4f41-default-rtdb.firebaseio.com',
  projectId: 'dalta-d4f41',
  storageBucket: 'dalta-d4f41.firebasestorage.app',
  messagingSenderId: '884646631155',
  appId: '1:884646631155:web:0ed37e925049063cfd0986'
});

const messaging = firebase.messaging();

// الرسائل تُرسل data فقط، وهذا الملف هو من يعرض الإشعار (لتفادي التكرار)
messaging.onBackgroundMessage(function (payload) {
  const d = payload.data || {};
  return self.registration.showNotification(d.title || 'أكاديمية دلتا أبين', {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '/' }
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (const c of list) { if (c.url.startsWith(self.location.origin) && 'focus' in c) { c.navigate(url); return c.focus(); } }
    return clients.openWindow(url);
  }));
});
