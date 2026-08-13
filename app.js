const screens = document.querySelectorAll(".screen");
const navigationButtons = document.querySelectorAll("[data-screen]");
const bookingForm = document.getElementById("booking-form");
const statusText = document.getElementById("form-status");
const submitButton = document.getElementById("submit-button");
const dateInput = document.getElementById("date");

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
    pause: String(data.get("pause")),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  submitButton.disabled = true;
  submitButton.textContent = "Wird gesendet …";

  try {
    await window.db.collection("termine").add(appointment);
    bookingForm.reset();
    dateInput.min = getLocalDateString(new Date());
    statusText.textContent = "Eure Terminanfrage wurde gespeichert. Wir melden uns in der Schule bei euch.";
    statusText.classList.add("success");
  } catch (error) {
    console.error("Termin konnte nicht gespeichert werden:", error);
    statusText.textContent = "Das Speichern hat leider nicht funktioniert. Bitte versucht es später erneut oder kommt direkt in Raum 008 vorbei.";
    statusText.classList.add("error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Termin verbindlich anfragen";
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(console.error));
}
