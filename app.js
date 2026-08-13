const screens = document.querySelectorAll(".screen");
const navigationButtons = document.querySelectorAll("[data-screen]");
const bookingForm = document.getElementById("booking-form");
const statusText = document.getElementById("form-status");
const submitButton = document.getElementById("submit-button");
const dateInput = document.getElementById("date");
const EMAILJS_SERVICE_ID = "service_w4i13lo";
const EMAILJS_TEMPLATE_ID = "template_0q5mj2y";
const EMAILJS_PUBLIC_KEY = "7BOB9DwXLbs2aEOQl";
const DEFAULT_ADMIN_EMAIL = "timurschule4@gmail.com";

function getLocalDateString(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().split("T")[0];
}

function showScreen(id) {
  screens.forEach((screen) => {
    const isActive = screen.id === id;
    screen.hidden = !isActive;
    screen.classList.toggle("active", isActive);
  });

  navigationButtons.forEach((button) => {
    const isActive = button.dataset.screen === id;
    button.classList.toggle("active", isActive);
    if (isActive) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  document.getElementById(id)?.querySelector("h2")?.focus({ preventScroll: true });
}

async function notifyAdmin(appointment) {
  if (!window.emailjs) return false;
  let adminEmail = DEFAULT_ADMIN_EMAIL;
  try {
    const settings = await window.db.collection("settings").doc("notifications").get();
    if (settings.exists && settings.data().email) adminEmail = settings.data().email;
  } catch (error) {
    console.warn("Benachrichtigungseinstellung konnte nicht geladen werden:", error);
  }

  await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    admin_email: adminEmail,
    name: appointment.name,
    klasse: appointment.klasse,
    date: appointment.date,
    pause: appointment.pause
  }, { publicKey: EMAILJS_PUBLIC_KEY });
  return true;
}

navigationButtons.forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.screen));
});

dateInput.min = getLocalDateString(new Date());

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusText.className = "form-status";

  if (!bookingForm.reportValidity()) return;
  if (!window.db) {
    statusText.textContent = "Die Terminbuchung ist gerade nicht erreichbar. Bitte versucht es später erneut oder kommt direkt in Raum 008 vorbei.";
    statusText.classList.add("error");
    return;
  }

  const data = new FormData(bookingForm);
  const appointment = {
    name: String(data.get("name")).trim(),
    klasse: String(data.get("klasse")).trim(),
    date: String(data.get("date")),
    pause: String(data.get("pause"))
  };

  submitButton.disabled = true;
  submitButton.textContent = "Wird gesendet …";

  try {
    await window.db.collection("termine").add(appointment);
    try {
      await notifyAdmin(appointment);
    } catch (emailError) {
      console.error("E-Mail-Benachrichtigung fehlgeschlagen:", emailError);
    }
    bookingForm.reset();
    dateInput.min = getLocalDateString(new Date());
    statusText.textContent = "Eure Terminanfrage wurde gespeichert. Wir melden uns in der Schule bei euch.";
    statusText.classList.add("success");
  } catch (error) {
    console.error("Termin konnte nicht gespeichert werden:", error);
    statusText.textContent = error?.code === "permission-denied"
      ? "Firebase erlaubt das Speichern noch nicht. Die Firestore-Regeln müssen Schreibzugriff auf Termine erlauben."
      : "Das Speichern hat leider nicht funktioniert. Bitte versucht es später erneut oder kommt direkt in Raum 008 vorbei.";
    statusText.classList.add("error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Termin verbindlich anfragen";
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(console.error));
}
