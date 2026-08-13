let calendar;
let unsubscribeAppointments;
let currentAppointments = [];
let currentRole = "viewer";

const loginPanel = document.getElementById("login-panel");
const calendarPanel = document.getElementById("calendar-panel");
const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const googleLoginButton = document.getElementById("google-login-button");
const logoutButton = document.getElementById("logout-button");
const authStatus = document.getElementById("auth-status");
const calendarStatus = document.getElementById("calendar-status");
const appointmentCount = document.getElementById("appointment-count");
const modal = document.getElementById("day-modal");
const modalTitle = document.getElementById("modal-title");
const modalList = document.getElementById("modal-list");
const notificationForm = document.getElementById("notification-form");
const notificationEmail = document.getElementById("notification-email");
const notificationStatus = document.getElementById("notification-status");

function showStatus(element, message, type = "") {
  element.textContent = message;
  element.className = `form-status ${type}`.trim();
}

function formatAuthError(error) {
  const messages = {
    "auth/invalid-credential": "E-Mail-Adresse oder Passwort ist falsch.",
    "auth/invalid-email": "Die E-Mail-Adresse ist ungültig.",
    "auth/popup-closed-by-user": "Die Google-Anmeldung wurde geschlossen.",
    "auth/popup-blocked": "Das Anmeldefenster wurde vom Browser blockiert.",
    "auth/too-many-requests": "Zu viele Anmeldeversuche. Bitte später erneut versuchen."
  };
  return messages[error?.code] || "Die Anmeldung ist fehlgeschlagen. Bitte versucht es erneut.";
}

function setLoggedIn(isLoggedIn) {
  loginPanel.classList.toggle("hidden", isLoggedIn);
  calendarPanel.classList.toggle("hidden", !isLoggedIn);
  logoutButton.classList.toggle("hidden", !isLoggedIn);
}

function renderCalendar(appointments) {
  const events = appointments.map(({ id, ...appointment }) => ({
    id,
    title: `${appointment.name} · ${appointment.pause}`,
    start: appointment.date,
    allDay: true
  }));

  if (calendar) calendar.destroy();
  calendar = new FullCalendar.Calendar(document.getElementById("calendar"), {
    initialView: "dayGridMonth",
    locale: "de",
    firstDay: 1,
    height: "auto",
    buttonText: { today: "Heute" },
    events,
    dateClick: (info) => openDay(info.dateStr),
    eventClick: (info) => openDay(info.event.startStr.slice(0, 10))
  });
  calendar.render();
}

function loadAppointments() {
  if (unsubscribeAppointments) unsubscribeAppointments();
  showStatus(calendarStatus, "Termine werden geladen …");

  unsubscribeAppointments = window.db.collection("termine").onSnapshot((snapshot) => {
    currentAppointments = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    currentAppointments.sort((a, b) => `${a.date}${a.pause}`.localeCompare(`${b.date}${b.pause}`));
    appointmentCount.textContent = `${currentAppointments.length} ${currentAppointments.length === 1 ? "Termin" : "Termine"}`;
    renderCalendar(currentAppointments);
    showStatus(calendarStatus, "");
  }, (error) => {
    console.error("Termine konnten nicht geladen werden:", error);
    showStatus(calendarStatus, "Die Termine konnten nicht geladen werden. Prüft bitte die Firestore-Berechtigungen.", "error");
  });
}

async function loadNotificationSettings() {
  try {
    const settings = await window.db.collection("settings").doc("notifications").get();
    notificationEmail.value = settings.exists && settings.data().email
      ? settings.data().email
      : "timurschule4@gmail.com";
  } catch (error) {
    console.error("E-Mail-Einstellung konnte nicht geladen werden:", error);
    showStatus(notificationStatus, "Die E-Mail-Einstellung konnte nicht geladen werden.", "error");
  }
}

function createAppointmentCard(appointment) {
  const article = document.createElement("article");
  article.className = "appointment-card";

  const details = document.createElement("div");
  const name = document.createElement("h3");
  name.textContent = appointment.name || "Ohne Namen";
  const meta = document.createElement("p");
  meta.textContent = `Klasse ${appointment.klasse || "–"} · ${appointment.pause || "Keine Pause"}`;
  details.append(name, meta);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.textContent = "Löschen";
  deleteButton.setAttribute("aria-label", `Termin von ${appointment.name || "unbekannt"} löschen`);
  deleteButton.hidden = currentRole === "viewer";
  deleteButton.addEventListener("click", () => deleteAppointment(appointment, deleteButton));

  article.append(details, deleteButton);
  return article;
}

function openDay(date) {
  const appointments = currentAppointments.filter((appointment) => appointment.date === date);
  modalTitle.textContent = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(new Date(`${date}T12:00:00`));
  modalList.replaceChildren();

  if (!appointments.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Für diesen Tag gibt es keine Termine.";
    modalList.append(empty);
  } else {
    appointments.forEach((appointment) => modalList.append(createAppointmentCard(appointment)));
  }

  modal.classList.remove("hidden");
  document.getElementById("close-modal-button").focus();
}

function closeModal() {
  modal.classList.add("hidden");
}

async function deleteAppointment(appointment, button) {
  const confirmed = window.confirm(`Termin von ${appointment.name || "unbekannt"} am ${appointment.date} wirklich löschen?`);
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Wird gelöscht …";
  try {
    await window.db.collection("termine").doc(appointment.id).delete();
    modalList.querySelector(`[aria-label="${CSS.escape(button.getAttribute("aria-label"))}"]`)?.closest("article")?.remove();
    if (!modalList.children.length) closeModal();
    showStatus(calendarStatus, "Der Termin wurde gelöscht.", "success");
  } catch (error) {
    console.error("Termin konnte nicht gelöscht werden:", error);
    button.disabled = false;
    button.textContent = "Löschen";
    showStatus(calendarStatus, "Der Termin konnte nicht gelöscht werden. Prüft bitte die Firestore-Berechtigungen.", "error");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginButton.disabled = true;
  showStatus(authStatus, "Anmeldung läuft …");
  try {
    await window.auth.signInWithEmailAndPassword(document.getElementById("email").value.trim(), document.getElementById("password").value);
    loginForm.reset();
  } catch (error) {
    showStatus(authStatus, formatAuthError(error), "error");
  } finally {
    loginButton.disabled = false;
  }
});

googleLoginButton.addEventListener("click", async () => {
  try {
    await window.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  } catch (error) {
    showStatus(authStatus, formatAuthError(error), "error");
  }
});

logoutButton.addEventListener("click", () => window.auth.signOut());
notificationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = notificationEmail.value.trim().toLowerCase();
  if (!notificationEmail.reportValidity()) return;
  const button = notificationForm.querySelector("button");
  button.disabled = true;
  try {
    await window.db.collection("settings").doc("notifications").set({ email }, { merge: true });
    showStatus(notificationStatus, "Die Empfängeradresse wurde gespeichert.", "success");
  } catch (error) {
    console.error("E-Mail-Einstellung konnte nicht gespeichert werden:", error);
    showStatus(notificationStatus, "Die Empfängeradresse konnte nicht gespeichert werden.", "error");
  } finally {
    button.disabled = false;
  }
});
document.getElementById("close-modal-button").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !modal.classList.contains("hidden")) closeModal(); });

if (!window.auth || !window.db || typeof FullCalendar === "undefined") {
  showStatus(authStatus, "Die Admin-Funktionen konnten nicht geladen werden. Bitte ladet die Seite neu.", "error");
} else {
  window.auth.onAuthStateChanged(async (user) => {
    let allowed = false;
    if (user) {
      if (user.email?.toLowerCase() === "timurschule4@gmail.com") { currentRole = "owner"; allowed = true; }
      else {
        const access = await window.db.collection("admins").doc(user.email.toLowerCase()).get().catch(()=>null);
        if (access?.exists) { currentRole = access.data().role; allowed = ["owner","admin","viewer"].includes(currentRole); }
      }
      if (allowed) await window.db.collection("admins").doc(user.email.toLowerCase()).set({lastLogin:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
    }
    setLoggedIn(allowed);
    if (allowed) {
      showStatus(authStatus, "");
      loadAppointments();
      notificationForm.classList.toggle("hidden", currentRole !== "owner");
      if (currentRole === "owner") loadNotificationSettings();
    } else {
      if (user) { showStatus(authStatus, "Dieses Konto ist nicht freigeschaltet.", "error"); await window.auth.signOut(); }
      if (unsubscribeAppointments) unsubscribeAppointments();
      if (calendar) calendar.destroy();
      currentAppointments = [];
      closeModal();
    }
  });
}
