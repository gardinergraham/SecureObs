const API_URL =
  window.SECUREOBS_API_URL || "https://adequate-energy-production.up.railway.app";
const SESSION_KEY = "secureobs-family-session";

const authView = document.querySelector("#auth-view");
const portalView = document.querySelector("#portal-view");
const loginForm = document.querySelector("#login-form");
const activateForm = document.querySelector("#activate-form");
const loginTab = document.querySelector("#login-tab");
const activateTab = document.querySelector("#activate-tab");
const authMessage = document.querySelector("#auth-message");
const signOutButton = document.querySelector("#sign-out");
const contributionForm = document.querySelector("#contribution-form");

loginTab.addEventListener("click", () => showAuthMode("login"));
activateTab.addEventListener("click", () => showAuthMode("activate"));
signOutButton.addEventListener("click", signOut);
loginForm.addEventListener("submit", (event) => authenticate(event, "login"));
activateForm.addEventListener("submit", (event) => authenticate(event, "activate"));
contributionForm.addEventListener("submit", submitContribution);

restoreSession();

function showAuthMode(mode) {
  const login = mode === "login";
  loginTab.classList.toggle("active", login);
  loginTab.setAttribute("aria-selected", String(login));
  activateTab.classList.toggle("active", !login);
  activateTab.setAttribute("aria-selected", String(!login));
  loginForm.classList.toggle("hidden", !login);
  activateForm.classList.toggle("hidden", login);
  hideMessage(authMessage);
}

async function authenticate(event, mode) {
  event.preventDefault();
  hideMessage(authMessage);
  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  const values = Object.fromEntries(new FormData(form).entries());
  if (mode === "activate" && values.pin !== values.confirmPin) {
    showMessage(authMessage, "The two PIN entries do not match.");
    return;
  }
  submitButton.disabled = true;
  try {
    const body =
      mode === "activate"
        ? {
            username: values.username,
            activationCode: values.activationCode,
            pin: values.pin
          }
        : { username: values.username, pin: values.pin };
    const result = await api(`/api/family-portal/${mode}`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
    form.reset();
    renderPortal(result.portal);
  } catch (error) {
    showMessage(authMessage, error.message);
  } finally {
    submitButton.disabled = false;
  }
}

async function restoreSession() {
  const session = readSession();
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    signOut();
    return;
  }
  try {
    const result = await api("/api/family-portal/me", {}, session.token);
    renderPortal(result.portal);
  } catch {
    signOut();
  }
}

function renderPortal(portal) {
  authView.classList.add("hidden");
  portalView.classList.remove("hidden");
  signOutButton.classList.remove("hidden");

  setText("#patient-name", portal.patient.name);
  setText(
    "#sharing-summary",
    `Shared with ${portal.contact.name} · ${portal.contact.relationship} · ${portal.patient.wardName}`
  );
  const permissions = document.querySelector("#permission-list");
  permissions.replaceChildren(
    ...portal.contact.categories.map((category) => element("span", category))
  );

  const cards = document.querySelector("#portal-cards");
  cards.replaceChildren();
  if (portal.progressSummary) cards.append(renderProgress(portal.progressSummary));
  if (portal.patientVoice) cards.append(renderPatientVoice(portal.patientVoice));
  if ("carePlan" in portal) cards.append(renderCarePlan(portal.carePlan));
  if ("approvedNotes" in portal) cards.append(renderNotes(portal.approvedNotes));

  const contributionSection = document.querySelector("#contribution-section");
  contributionSection.classList.toggle("hidden", !portal.contact.canContribute);
  renderContributionHistory(portal.contributions || []);
}

function renderProgress(progress) {
  return card("Current progress summary", [
    detailList([
      ["Current ward status", progress.wardStatus],
      ["Latest recorded location", progress.latestRecordedLocation],
      ["Latest recorded presentation", progress.latestRecordedPresentation],
      ["Observation support", progress.observationSupport]
    ]),
    paragraph(
      "These are the latest recorded checks and do not represent continuous monitoring.",
      "caveat"
    )
  ]);
}

function renderPatientVoice(voice) {
  const profile = voice.profile || {};
  const children = [
    detailList([
      ["What matters", profile.whatMatters || "Not yet recorded"],
      ["Care goals", profile.careGoals || "Not yet recorded"],
      [
        "Decision-making preferences",
        profile.preferredInvolvement || "Not yet recorded"
      ]
    ])
  ];
  if (voice.latestCheckIn) {
    children.push(
      detailList([
        ["Latest experience rating", `${voice.latestCheckIn.overallRating}/5`],
        ["Going well", voice.latestCheckIn.goingWell || "Not recorded"],
        ["Would change", voice.latestCheckIn.wouldChange || "Not recorded"],
        ["Staff response", voice.latestCheckIn.staffResponse || "Awaiting review"]
      ])
    );
  }
  return card("What matters to the patient", children);
}

function renderCarePlan(plan) {
  if (!plan) return card("Agreed care-plan goals", [paragraph("No shared care-plan goals are available.")]);
  return card("Agreed care-plan goals", [
    element("h3", plan.title),
    detailList([
      ["Goals", plan.goals],
      ["Patient views", plan.patientViews || "Not recorded"],
      ["Review date", plan.reviewDate]
    ])
  ]);
}

function renderNotes(notes) {
  if (!notes.length) {
    return card("Notes approved for sharing", [paragraph("No notes have been approved for this shared view.")]);
  }
  return card(
    "Notes approved for sharing",
    notes.map((note) => {
      const wrapper = element("article", "", "note");
      wrapper.append(
        paragraph(note.body),
        element("small", `${formatDate(note.recordedAt)} · ${note.recordedByName}`)
      );
      return wrapper;
    })
  );
}

async function submitContribution(event) {
  event.preventDefault();
  const message = document.querySelector("#contribution-message");
  hideMessage(message);
  const submitButton = contributionForm.querySelector("button[type='submit']");
  const body = new FormData(contributionForm).get("body");
  const session = readSession();
  if (!session) {
    signOut();
    return;
  }
  submitButton.disabled = true;
  try {
    const result = await api(
      "/api/family-portal/contributions",
      { method: "POST", body: JSON.stringify({ body }) },
      session.token
    );
    contributionForm.reset();
    showMessage(
      message,
      "Thank you. Your contribution is waiting for staff review.",
      true
    );
    const history = document.querySelector("#contribution-history");
    history.prepend(renderContribution(result.contribution));
  } catch (error) {
    if (/session|access/i.test(error.message)) {
      signOut();
      return;
    }
    showMessage(message, error.message);
  } finally {
    submitButton.disabled = false;
  }
}

function renderContributionHistory(contributions) {
  const history = document.querySelector("#contribution-history");
  history.replaceChildren();
  if (contributions.length) {
    history.append(element("h3", "Your previous contributions"));
    contributions.forEach((contribution) => history.append(renderContribution(contribution)));
  }
}

function renderContribution(contribution) {
  const wrapper = element("article", "", "history-entry");
  wrapper.append(
    paragraph(contribution.body),
    element(
      "small",
      `${formatDate(contribution.submittedAt)}${
        contribution.reviewedAt ? ` · Reviewed ${formatDate(contribution.reviewedAt)}` : ""
      }`
    ),
    element("span", contribution.reviewStatus || "Awaiting staff review", "status-pill")
  );
  return wrapper;
}

function card(title, children) {
  const article = element("article", "", "portal-card");
  article.append(element("h2", title), ...children);
  return article;
}

function detailList(rows) {
  const list = element("dl", "", "detail-list");
  rows.forEach(([label, value]) => {
    const row = element("div", "", "detail-row");
    row.append(element("dt", label), element("dd", value || "Not recorded"));
    list.append(row);
  });
  return list;
}

function paragraph(text, className = "") {
  return element("p", text, className);
}

function element(tag, text = "", className = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function setText(selector, text) {
  document.querySelector(selector).textContent = text;
}

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function signOut() {
  sessionStorage.removeItem(SESSION_KEY);
  portalView.classList.add("hidden");
  authView.classList.remove("hidden");
  signOutButton.classList.add("hidden");
  showAuthMode("login");
}

async function api(path, init = {}, token = "") {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The request could not be completed");
  return result;
}

function showMessage(node, text, success = false) {
  node.textContent = text;
  node.classList.remove("hidden");
  node.classList.toggle("success", success);
}

function hideMessage(node) {
  node.textContent = "";
  node.classList.add("hidden");
  node.classList.remove("success");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
