importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyD5RHWEUk_F4nO2sYytC7InGqIotFPLWvo",
  authDomain: "site-alerta-219e8.firebaseapp.com",
  projectId: "site-alerta-219e8",
  storageBucket: "site-alerta-219e8.appspot.com",
  messagingSenderId: "972115747427",
  appId: "1:972115747427:web:94007eddafd0efbfb88e56",
  measurementId: "G-DKXX5EMXG0"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: 'https://cdn-icons-png.flaticon.com/512/5368/5368327.png'
  });
});