const API_URL = window.SECUREOBS_API_URL || "https://adequate-energy-production.up.railway.app";
const ORGANISATION_ID = window.SECUREOBS_ORGANISATION_ID || "00000000-0000-0000-0000-000000000001";
const SESSION_KEY = "secureobs-staff-web-session";

const state = { session: null, data: null, wardId: "", patientId: "", page: "notes" };
const loginView = document.querySelector("#login-view");
const workspaceView = document.querySelector("#workspace-view");
const loginForm = document.querySelector("#login-form");
const noteForm = document.querySelector("#note-form");
const carePlanForm = document.querySelector("#careplan-form");

loginForm.addEventListener("submit", login);
noteForm.addEventListener("submit", saveNote);
carePlanForm.addEventListener("submit", saveCarePlan);
document.querySelector("#sign-out").addEventListener("click", signOut);
document.querySelector("#ward-select").addEventListener("change", selectWard);
document.querySelector("#patient-search").addEventListener("input", renderPatients);
document.querySelector("#notes-tab").addEventListener("click", () => showPage("notes"));
document.querySelector("#careplans-tab").addEventListener("click", () => showPage("careplans"));
window.addEventListener("hashchange", readPageFromHash);

restoreSession();

async function login(event) {
  event.preventDefault();
  const message = document.querySelector("#login-message");
  hideMessage(message);
  const button = loginForm.querySelector("button[type='submit']");
  const values = Object.fromEntries(new FormData(loginForm).entries());
  button.disabled = true;
  try {
    const result = await api("/api/staff/pin-login", {
      method: "POST",
      body: JSON.stringify({ staffCode: values.staffCode, loginPin: values.loginPin, organisationId: ORGANISATION_ID })
    });
    state.session = result.session;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
    loginForm.reset();
    await loadWorkspace();
  } catch (error) {
    showMessage(message, error.message);
  } finally {
    button.disabled = false;
  }
}

async function restoreSession() {
  try {
    state.session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    state.session = null;
  }
  if (!state.session || new Date(state.session.expiresAt).getTime() <= Date.now()) return signOut();
  try {
    await loadWorkspace();
  } catch {
    signOut();
  }
}

async function loadWorkspace() {
  state.data = await api("/api/staff-portal/bootstrap", {}, state.session.token);
  state.wardId = state.wardId && state.data.wards.some((ward) => ward.id === state.wardId)
    ? state.wardId : state.data.wards[0]?.id || "";
  state.patientId = state.data.patients.some((patient) => patient.id === state.patientId && patient.wardId === state.wardId)
    ? state.patientId : state.data.patients.find((patient) => patient.wardId === state.wardId)?.id || "";
  loginView.classList.add("hidden");
  workspaceView.classList.remove("hidden");
  document.querySelector("#sign-out").classList.remove("hidden");
  document.querySelector("#staff-summary").textContent = `${state.data.staff.name} · ${state.data.staff.staffCode}`;
  renderWards();
  renderAll();
  readPageFromHash();
}

function renderWards() {
  const select = document.querySelector("#ward-select");
  select.replaceChildren(...state.data.wards.map((ward) => option(ward.id, ward.name)));
  select.value = state.wardId;
}

function selectWard(event) {
  state.wardId = event.target.value;
  state.patientId = state.data.patients.find((patient) => patient.wardId === state.wardId)?.id || "";
  document.querySelector("#patient-search").value = "";
  renderAll();
}

function selectPatient(patientId) {
  state.patientId = patientId;
  renderAll();
}

function renderAll() {
  renderPatients();
  renderPatientBanner();
  renderNotes();
  renderCarePlans();
  const disabled = !selectedPatient();
  noteForm.querySelector("button[type='submit']").disabled = disabled;
  carePlanForm.querySelector("button[type='submit']").disabled = disabled;
}

function renderPatients() {
  if (!state.data) return;
  const query = document.querySelector("#patient-search").value.trim().toLowerCase();
  const patients = state.data.patients.filter((patient) => {
    if (patient.wardId !== state.wardId) return false;
    return !query || `${patient.firstName} ${patient.surname} ${patient.hospitalNumber} ${patient.roomNumber}`.toLowerCase().includes(query);
  });
  const list = document.querySelector("#patient-list");
  list.replaceChildren(...patients.map((patient) => {
    const button = element("button", "", `patient-button${patient.id === state.patientId ? " active" : ""}`);
    button.type = "button";
    button.append(element("strong", `Room ${patient.roomNumber} · ${patient.firstName} ${patient.surname}`), element("small", patient.hospitalNumber));
    button.addEventListener("click", () => selectPatient(patient.id));
    return button;
  }));
  if (!patients.length) list.append(element("p", "No matching patients.", "empty"));
}

function renderPatientBanner() {
  const patient = selectedPatient();
  document.querySelector("#patient-name").textContent = patient ? `${patient.firstName} ${patient.surname}` : "Choose a patient";
  document.querySelector("#patient-meta").textContent = patient ? `Room ${patient.roomNumber} · ${patient.hospitalNumber}` : "Select a patient from the authorised ward list.";
  const alerts = document.querySelector("#patient-alerts");
  alerts.replaceChildren();
  if (patient?.allergies) alerts.append(element("span", `Allergies: ${patient.allergies}`, "alert-pill"));
  if (patient?.adverseDrugReactions) alerts.append(element("span", `ADRs: ${patient.adverseDrugReactions}`, "alert-pill"));
}

function renderNotes() {
  const notes = state.data.patientNotes.filter((note) => note.patientId === state.patientId);
  const list = document.querySelector("#notes-list");
  list.replaceChildren(...notes.map((note) => {
    const entry = element("article", "", "history-entry");
    entry.append(element("p", note.body), element("small", `${formatDate(note.recordedAt)} · ${note.recordedByName} (${note.recordedByStaffCode})`));
    return entry;
  }));
  if (!notes.length) list.append(element("p", "No patient notes have been recorded.", "empty"));
}

function renderCarePlans() {
  const plans = state.data.patientCarePlans.filter((plan) => plan.patientId === state.patientId);
  const list = document.querySelector("#careplans-list");
  list.replaceChildren(...plans.map((plan) => {
    const entry = element("article", "", "history-entry");
    entry.append(element("h3", plan.title));
    const details = element("div", "", "plan-details");
    [["Identified needs", plan.identifiedNeeds], ["Risks and triggers", plan.risksAndTriggers], ["Goals", plan.goals], ["Interventions", plan.interventions], ["Patient views", plan.patientViews], ["Additional notes", plan.additionalNotes]].forEach(([label, value]) => {
      const box = element("div"); box.append(element("strong", label), element("p", value || "Not recorded")); details.append(box);
    });
    entry.append(details, element("small", `Review ${formatDateOnly(plan.reviewDate)} · Created ${formatDate(plan.createdAt)} by ${plan.createdByName}`));
    return entry;
  }));
  if (!plans.length) list.append(element("p", "No care plans have been recorded.", "empty"));
}

async function saveNote(event) {
  event.preventDefault();
  const patient = selectedPatient();
  if (!patient) return;
  const message = document.querySelector("#note-message");
  hideMessage(message);
  const button = noteForm.querySelector("button[type='submit']");
  const body = new FormData(noteForm).get("body").trim();
  button.disabled = true;
  try {
    const note = await api("/api/patient-notes", { method: "POST", body: JSON.stringify({
      id: createId("patient-note"), organisationId: state.data.organisationId, patientId: patient.id, wardId: patient.wardId,
      body, recordedByStaffId: state.data.staff.id, recordedByName: state.data.staff.name,
      recordedByStaffCode: state.data.staff.staffCode, recordedAt: new Date().toISOString()
    }) }, state.session.token);
    state.data.patientNotes.unshift(note);
    noteForm.reset();
    renderNotes();
    showMessage(message, "Patient note saved to SecureObs.", true);
  } catch (error) {
    handleSaveError(message, error);
  } finally { button.disabled = false; }
}

async function saveCarePlan(event) {
  event.preventDefault();
  const patient = selectedPatient();
  if (!patient) return;
  const message = document.querySelector("#careplan-message");
  hideMessage(message);
  const button = carePlanForm.querySelector("button[type='submit']");
  const values = Object.fromEntries(new FormData(carePlanForm).entries());
  button.disabled = true;
  try {
    const plan = await api("/api/patient-care-plans", { method: "POST", body: JSON.stringify({
      id: createId("patient-care-plan"), organisationId: state.data.organisationId, patientId: patient.id, wardId: patient.wardId,
      title: values.title, identifiedNeeds: values.identifiedNeeds, risksAndTriggers: values.risksAndTriggers,
      goals: values.goals, interventions: values.interventions, patientViews: values.patientViews,
      reviewDate: values.reviewDate, additionalNotes: values.additionalNotes, createdByStaffId: state.data.staff.id,
      createdByName: state.data.staff.name, createdByStaffCode: state.data.staff.staffCode, createdAt: new Date().toISOString()
    }) }, state.session.token);
    state.data.patientCarePlans.unshift(plan);
    carePlanForm.reset();
    renderCarePlans();
    showMessage(message, "Care plan saved to SecureObs.", true);
  } catch (error) {
    handleSaveError(message, error);
  } finally { button.disabled = false; }
}

function handleSaveError(message, error) {
  if (/session|authenticated/i.test(error.message)) { signOut(); return; }
  showMessage(message, error.message);
}

function showPage(page) {
  state.page = page;
  if (location.hash !== `#${page}`) history.replaceState(null, "", `#${page}`);
  document.querySelector("#notes-page").classList.toggle("hidden", page !== "notes");
  document.querySelector("#careplans-page").classList.toggle("hidden", page !== "careplans");
  document.querySelector("#notes-tab").classList.toggle("active", page === "notes");
  document.querySelector("#careplans-tab").classList.toggle("active", page === "careplans");
}

function readPageFromHash() { showPage(location.hash === "#careplans" ? "careplans" : "notes"); }
function selectedPatient() { return state.data?.patients.find((patient) => patient.id === state.patientId); }
function signOut() { sessionStorage.removeItem(SESSION_KEY); state.session = null; state.data = null; workspaceView.classList.add("hidden"); loginView.classList.remove("hidden"); document.querySelector("#sign-out").classList.add("hidden"); document.querySelector("#staff-summary").textContent = ""; }
function createId(prefix) { return `${prefix}-web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function option(value, text) { const node = document.createElement("option"); node.value = value; node.textContent = text; return node; }
function element(tag, text = "", className = "") { const node = document.createElement(tag); if (className) node.className = className; node.textContent = text; return node; }
function showMessage(node, text, success = false) { node.textContent = text; node.classList.remove("hidden"); node.classList.toggle("success", success); }
function hideMessage(node) { node.textContent = ""; node.classList.add("hidden"); node.classList.remove("success"); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date); }
function formatDateOnly(value) { if (!value) return "not set"; const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date); }
async function api(path, init = {}, token = "") { const response = await fetch(`${API_URL}${path}`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || "The request could not be completed"); return result; }
