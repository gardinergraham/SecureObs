// Canonical catalogue and integer-pence calculator. The website copy is generated
// by scripts/sync-package-pricing.cjs; never accept prices supplied by a browser.
export const catalogue = {
  version: '2026-09-modules-v3-no-vat',
  currency: 'gbp', vatPercent: 20,
  vatRegistered: false,
  plans: {
    essential: { label: 'Essential', monthly: 14900, yearly: 149000 },
    professional: { label: 'Professional', monthly: 29900, yearly: 299000 },
    enterprise: { label: 'Enterprise', monthly: 149900, yearly: 1499000 }
  },
  modules: [
    { id: 'medication', label: 'Medication / eMAR', description: 'Prescribing and medication administration records.' },
    { id: 'rostering', label: 'Rostering', description: 'Ward rotas, attendance and staff cover.' },
    { id: 'securityChecks', label: 'Security checks', description: 'Scheduled ward and equipment checks.' },
    { id: 'dashboard', label: 'Analytics', description: 'Operational dashboards and reporting.' },
    { id: 'cqcReporting', label: 'CQC evidence & governance', description: 'Compliance evidence and governance tools.' }
  ],
  moduleMonthly: 4500,
  tabletMonthlyIncludingVat: 3799
};

export function pricePackage(selection, vatRegistered = catalogue.vatRegistered) {
  if (!selection || !['monthly', 'yearly'].includes(selection.interval)
    || !Array.isArray(selection.wards) || !selection.wards.length || selection.wards.length > 100
    || !Number.isInteger(selection.tablets) || selection.tablets < 0 || selection.tablets > 500
    || typeof selection.enterprise !== 'boolean') throw new Error('Choose 1–100 wards and 0–500 tablets.');
  const ids = catalogue.modules.map(module => module.id);
  const seen = new Set();
  const wards = selection.wards.map((ward, index) => {
    if (!ward || !['essential','professional'].includes(ward.plan) || !Array.isArray(ward.modules)
      || ward.modules.some(id => !ids.includes(id)) || new Set(ward.modules).size !== ward.modules.length)
      throw new Error('Choose a valid plan and each module at most once per ward.');
    const name = typeof ward.name === 'string' ? ward.name.trim() : '';
    const site = typeof ward.site === 'string' ? ward.site.trim() : '';
    if (!name || name.length > 100 || !site || site.length > 100) throw new Error('Enter a site and ward name (up to 100 characters each).');
    const key = `${site.toLowerCase()}\u0000${name.toLowerCase()}`;
    if (seen.has(key)) throw new Error('Ward names must be different within the same site.');
    seen.add(key);
    // Included modules are removed, never charged a second time.
    const serviceType = ward.serviceType ?? 'Care home';
    if (!['Care home','Medium secure hospital','High secure hospital'].includes(serviceType)) throw new Error('Choose a valid service type for each ward.');
    return { name, site, serviceType, plan: ward.plan, modules: selection.enterprise || ward.plan === 'professional' ? [] : [...ward.modules] };
  });
  const lines = [];
  function add(key, label, quantity, unitAmount, inclusive = false) {
    if (!quantity) return;
    const amount = quantity * unitAmount;
    const vat = !vatRegistered ? 0 : inclusive ? amount - Math.round(amount / 1.2) : Math.round(amount * .2);
    lines.push({ key, label, quantity, unitAmount, inclusive, net: inclusive ? amount - vat : amount, vat, gross: inclusive ? amount : amount + vat });
  }
  if (selection.enterprise) add('enterprise', 'Enterprise — organisation', 1, catalogue.plans.enterprise[selection.interval]);
  else for (const key of ['essential','professional']) add(key, `${catalogue.plans[key].label} — wards`, wards.filter(ward => ward.plan === key).length, catalogue.plans[key][selection.interval]);
  for (const module of catalogue.modules) add(module.id, module.label, wards.filter(ward => ward.modules.includes(module.id)).length, catalogue.moduleMonthly * (selection.interval === 'yearly' ? 10 : 1));
  add('tablets', 'Tablet hire', selection.tablets, catalogue.tabletMonthlyIncludingVat * (selection.interval === 'yearly' ? 12 : 1), true);
  const savings = wards.map((ward, index) => ({ index,
    monthly: selection.enterprise || ward.plan !== 'essential' ? 0 : Math.max(0, catalogue.plans.essential.monthly + ward.modules.length * catalogue.moduleMonthly - catalogue.plans.professional.monthly)
  })).filter(saving => saving.monthly > 0);
  return {
    selection: { interval: selection.interval, enterprise: selection.enterprise, tablets: selection.tablets, wards },
    lines, savings,
    net: lines.reduce((sum, line) => sum + line.net, 0),
    vat: lines.reduce((sum, line) => sum + line.vat, 0),
    gross: lines.reduce((sum, line) => sum + line.gross, 0)
  };
}

export function wardFeatures(ward, enterprise) {
  const included = enterprise || ward.plan === 'professional';
  return Object.fromEntries([
    ...catalogue.modules.map(module => [module.id, included || ward.modules.includes(module.id)]),
    ['verifiedObservations', enterprise], ['prioritySupport', included]
  ]);
}
