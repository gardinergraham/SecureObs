const DEMO_API_URL = "https://adequate-energy-demo.up.railway.app";
const form = document.querySelector("#trial-form");
const resultPanel = document.querySelector("#trial-result");
const message = document.querySelector("#trial-message");
const submitButton = document.querySelector("#trial-submit");
let credentials = null;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  if (!form.checkValidity()) {
    message.textContent = "Please complete the required fields and accept the trial conditions.";
    form.reportValidity();
    return;
  }

  const values = Object.fromEntries(new FormData(form).entries());
  submitButton.disabled = true;
  submitButton.textContent = "Creating your private trial…";
  try {
    const response = await fetch(`${DEMO_API_URL}/api/demo/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organisationName: values.organisationName,
        contactName: values.contactName,
        email: values.email,
        phone: values.phone,
        website: values.website,
        acceptedTerms: form.elements.acceptedTerms.checked
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.trial) throw new Error(payload.error || "The trial could not be created. Please contact SecureObs.");

    credentials = payload.trial;
    document.querySelector("#trial-staff-code").textContent = credentials.staffCode;
    document.querySelector("#trial-pin").textContent = credentials.loginPin;
    document.querySelector("#trial-expiry").textContent = new Date(credentials.expiresAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });
    form.classList.add("hidden");
    resultPanel.classList.remove("hidden");
    resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : "The trial could not be created.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create my private trial";
  }
});

document.querySelector("#copy-credentials").addEventListener("click", async () => {
  if (!credentials) return;
  const text = `SecureObs Demo\nSTAFFCODE: ${credentials.staffCode}\nPIN: ${credentials.loginPin}\nExpires: ${new Date(credentials.expiresAt).toLocaleString("en-GB")}\nDemo data only — never enter real patient information.`;
  await navigator.clipboard.writeText(text);
  document.querySelector("#copy-credentials").textContent = "Sign-in details copied";
});
