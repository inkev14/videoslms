// Zieladresse für das Kontaktformular
const CONTACT_EMAIL = "info@lucapaglia.ch";
const FORMSUBMIT_ENDPOINT = `https://formsubmit.co/ajax/${CONTACT_EMAIL}`;

document.getElementById("year").textContent = new Date().getFullYear();

// Mobiles Menü
const navToggle = document.getElementById("navToggle");
const siteHeader = document.querySelector(".site-header");
navToggle.addEventListener("click", () => {
  const isOpen = siteHeader.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});
document.querySelectorAll(".nav a").forEach((link) => {
  link.addEventListener("click", () => siteHeader.classList.remove("open"));
});

// Kontaktformular
const form = document.getElementById("contactForm");
const status = document.getElementById("formStatus");
const submitBtn = document.getElementById("submitBtn");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Honeypot: wenn befüllt, stillschweigend abbrechen (Bot)
  if (form._honey.value) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Wird gesendet...";
  status.textContent = "";
  status.className = "form-status";

  const data = new FormData(form);
  data.append("_subject", `Neue Kontaktanfrage von ${data.get("name")}`);

  try {
    const response = await fetch(FORMSUBMIT_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: data,
    });

    if (!response.ok) throw new Error("Request failed");

    status.textContent =
      "Danke für Ihre Nachricht! Ich melde mich in Kürze bei Ihnen zurück.";
    status.classList.add("success");
    form.reset();
  } catch (err) {
    status.innerHTML = `Da ist leider etwas schiefgelaufen. Bitte schreiben Sie mir direkt an <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.`;
    status.classList.add("error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Nachricht senden";
  }
});
