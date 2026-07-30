const demoForm = document.querySelector("#demo-form");
const demoFormMessage = document.querySelector("#demo-form-message");

demoForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  demoFormMessage.textContent = "";
  demoFormMessage.className = "form-message";

  if (!demoForm.checkValidity()) {
    demoFormMessage.textContent = "Please complete the required fields before preparing your request.";
    demoFormMessage.classList.add("form-message-error");
    demoForm.reportValidity();
    return;
  }

  const data = new FormData(demoForm);
  const interests = data.getAll("interests");
  const value = (name) => String(data.get(name) ?? "").trim() || "Not provided";
  const subject = `SecureObs demo request — ${value("organisation")}`;
  const body = [
    "Hello SecureObs,",
    "",
    "I would like to arrange a tailored SecureObs demonstration.",
    "",
    `Contact name: ${value("contactName")}`,
    `Job role: ${value("jobRole")}`,
    `Organisation: ${value("organisation")}`,
    `Work email: ${value("email")}`,
    `Telephone: ${value("telephone")}`,
    `Service type: ${value("serviceType")}`,
    `Number of sites: ${value("siteCount")}`,
    `Number of wards or units: ${value("wardCount")}`,
    "",
    "Areas of interest:",
    interests.length ? interests.map((interest) => `- ${interest}`).join("\n") : "- Not specified",
    "",
    "Current process:",
    value("currentProcess"),
    "",
    "What we would like to improve:",
    value("goals"),
    "",
    `Preferred date or week: ${value("preferredDate")}`,
    `Preferred time: ${value("preferredTime")}`,
    "",
    "I consent to SecureObs contacting me about this demonstration request."
  ].join("\n");

  demoFormMessage.textContent = "Your email application is opening. Review the request and select Send.";
  demoFormMessage.classList.add("form-message-success");
  window.location.href = `mailto:secure.observations@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
