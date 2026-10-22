
importScripts(
  "https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyAsP7W465CjanN3SmjAsVoQv-YCsrtSVsg",
  authDomain: "dalta-d4f41.firebaseapp.com",
  databaseURL: "https://dalta-d4f41-default-rtdb.firebaseio.com",
  projectId: "dalta-d4f41",
  storageBucket: "dalta-d4f41.firebasestorage.app",
  messagingSenderId: "884646631155",
  appId: "1:884646631155:web:0ed37e925049063cfd0986",
  measurementId: "G-9EDQ9DYRQZ"
});

firebase.messaging();
