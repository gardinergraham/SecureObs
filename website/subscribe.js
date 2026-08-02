const apiUrl = "https://adequate-energy-production.up.railway.app";
const prices = {
  essential: { monthly: 149, yearly: 1490, unit: "ward" },
  professional: { monthly: 299, yearly: 2990, unit: "ward" },
  enterprise: { monthly: 1499, yearly: 14990, unit: "organisation" }
};

const form = document.querySelector("#subscription-form");
const planInput = document.querySelector("#plan");
const wardInput = document.querySelector("#wardQuantity");
const wardField = document.querySelector("#ward-field");
const total = document.querySelector("#checkout-total");
const message = document.querySelector("#form-message");
const button = document.querySelector("#checkout-button");

const initialPlan = new URLSearchParams(window.location.search).get("plan");
if (initialPlan && prices[initialPlan]) planInput.value = initialPlan;
if (new URLSearchParams(window.location.search).has("cancelled")) message.textContent = "Payment was cancelled. Nothing has been charged.";

function updateTotal() {
  const plan = planInput.value;
  const interval = document.querySelector('input[name="interval"]:checked').value;
  const quantity = plan === "enterprise" ? 1 : Math.max(1, Number(wardInput.value) || 1);
  wardField.hidden = plan === "enterprise";
  const price = prices[plan][interval] * quantity;
  const suffix = interval === "monthly" ? "month" : "year";
  total.textContent = `${plan[0].toUpperCase()}${plan.slice(1)}: £${price.toLocaleString("en-GB")} per ${suffix}, excluding VAT${plan === "enterprise" ? "" : ` for ${quantity} ward${quantity === 1 ? "" : "s"}`}.`;
}

form.addEventListener("change", updateTotal);
form.addEventListener("input", updateTotal);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  button.disabled = true;
  button.textContent = "Opening secure checkout…";
  const data = new FormData(form);
  try {
    const response = await fetch(`${apiUrl}/api/billing/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organisationName: data.get("organisationName"), contactName: data.get("contactName"),
        billingEmail: data.get("billingEmail"), billingPhone: data.get("billingPhone"),
        plan: data.get("plan"), interval: data.get("interval"), wardQuantity: Number(data.get("wardQuantity") || 1),
        acceptedTerms: document.querySelector("#acceptedTerms").checked
      })
    });
    const result = await response.json();
    if (!response.ok || !result.checkoutUrl) throw new Error(result.error || "Secure checkout could not be started");
    window.location.assign(result.checkoutUrl);
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : "Secure checkout could not be started.";
    button.disabled = false;
    button.textContent = "Continue to secure payment";
  }
});

updateTotal();
