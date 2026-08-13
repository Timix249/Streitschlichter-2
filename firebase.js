const firebaseConfig = {
  apiKey: "AIzaSyD_B7Kd4NGF585Y7RW3V4amkE1N-EGPL0g",
  authDomain: "streitschlichter-9f634.firebaseapp.com",
  projectId: "streitschlichter-9f634"
};

try {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  window.db = firebase.firestore();

  // Auth wird nur auf der Admin-Seite geladen. So bleibt die öffentliche
  // Terminseite auch ohne firebase-auth-compat fehlerfrei.
  window.auth = typeof firebase.auth === "function" ? firebase.auth() : null;
} catch (error) {
  console.error("Firebase konnte nicht initialisiert werden:", error);
  window.db = null;
  window.auth = null;
}
