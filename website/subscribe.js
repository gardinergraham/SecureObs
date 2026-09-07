import { catalogue, pricePackage } from './package-pricing.js';
const apiUrl = 'https://adequate-energy-production.up.railway.app';
const money = value => new Intl.NumberFormat('en-GB', {style:'currency', currency:'GBP'}).format(value / 100);
const form = document.querySelector('#subscription-form');
const wardList = document.querySelector('#ward-list');
const summary = document.querySelector('#checkout-total');
const message = document.querySelector('#form-message');
const button = document.querySelector('#checkout-button');
const enterprise = document.querySelector('#enterprise');
const tablets = document.querySelector('#tablets');
const initial = new URLSearchParams(location.search).get('plan');
let wards = [{ site:'Main site', name:'Ward 1', plan: initial === 'professional' ? 'professional' : 'essential', modules:[] }];
enterprise.checked = initial === 'enterprise';
let busy = false;
function element(tag, text, className) { const node = document.createElement(tag); if (text) node.textContent=text; if(className) node.className=className; return node; }
function renderWards() {
  wardList.replaceChildren();
  wards.forEach((ward,index) => {
    const card = element('fieldset', '', 'ward-card'); card.append(element('legend', `Ward ${index + 1}`));
    const fields=element('div','','ward-fields');
    for (const [key,label] of [['site','Site name'],['name','Ward name']]) {
      const wrapper=element('label',label); const input=element('input'); input.value=ward[key]; input.required=true; input.maxLength=100;
      input.addEventListener('input',()=>{ward[key]=input.value; updateTotal();}); wrapper.append(input); fields.append(wrapper);
    }
    const serviceLabel = element('label', 'Service type'); const service = element('select');
    for (const value of ['Care home','Medium secure hospital','High secure hospital']) { const option = element('option',value); option.value=value; service.append(option); }
    service.value=ward.serviceType ?? 'Care home'; service.addEventListener('change',()=>{ward.serviceType=service.value;updateTotal();});
    serviceLabel.append(service); fields.append(serviceLabel);
    card.append(fields);
    const label=element('label',enterprise.checked ? 'Enterprise includes every module below.' : 'Plan for this ward');
    const select=element('select'); select.setAttribute('aria-label',`Plan for ward ${index+1}`);
    for(const id of ['essential','professional']) { const option=element('option',`${catalogue.plans[id].label} — ${money(catalogue.plans[id].monthly)}/month`); option.value=id; select.append(option); }
    select.value=ward.plan; select.disabled=enterprise.checked;
    select.addEventListener('change',()=>{ward.plan=select.value; if(ward.plan==='professional') ward.modules=[]; renderWards(); updateTotal();});
    label.append(select); card.append(label);
    const modules=element('div','','module-grid');
    for(const module of catalogue.modules) {
      const included=enterprise.checked || ward.plan==='professional';
      const option=element('label','','module-option'); const check=element('input'); check.type='checkbox'; check.checked=included || ward.modules.includes(module.id); check.disabled=included;
      check.addEventListener('change',()=>{ward.modules=check.checked?[...ward.modules,module.id]:ward.modules.filter(id=>id!==module.id); updateTotal(); renderSaving(card,ward,index);});
      const copy=element('span','','module-copy'); copy.append(element('strong',module.label),element('small',module.description));
      option.append(check,copy,element('span',included?'Included':`${money(catalogue.moduleMonthly)}/month` ,'module-price')); modules.append(option);
    }
    card.append(modules); const tip=element('div','','saving-placeholder'); card.append(tip); renderSaving(card,ward,index);
    if(wards.length>1) {const remove=element('button','Remove this ward','ward-remove'); remove.type='button'; remove.addEventListener('click',()=>{wards.splice(index,1);renderWards();updateTotal();});card.append(remove);}
    wardList.append(card);
  });
  document.querySelector('#add-ward').disabled=wards.length>=100;
}
function renderSaving(card,ward,index) {
  const slot=card.querySelector('.saving-placeholder'); slot.replaceChildren();
  const saving=catalogue.plans.essential.monthly+ward.modules.length*catalogue.moduleMonthly-catalogue.plans.professional.monthly;
  if(!enterprise.checked && ward.plan==='essential' && saving>0) {
    const tip=element('div','','upgrade-tip'); tip.append(element('p',`Professional includes all five modules and saves ${money(saving)} per month for this ward.`));
    const upgrade=element('button','Switch this ward to Professional','outline-button');upgrade.type='button';upgrade.addEventListener('click',()=>{wards[index].plan='professional';wards[index].modules=[];renderWards();updateTotal();});tip.append(upgrade);slot.append(tip);
  }
}
function selection() {return { enterprise:enterprise.checked,interval:form.querySelector('[name="interval"]:checked').value,tablets:Number(tablets.value),wards };}
function updateTotal() {
  document.querySelector('#interval-note').textContent='Annual billing: pay for 10 months of plans and modules, plus all 12 months of tablet hire. The annual total is paid upfront.';
  summary.replaceChildren();
  try {
    const quote=pricePackage(selection()); const period=quote.selection.interval==='monthly'?'month':'year';
    for(const line of quote.lines) {const row=element('div','','summary-line'); const label=element('span',`${line.label} × ${line.quantity}`);row.append(label,element('span',money(line.unitAmount*line.quantity)));summary.append(row);}
    summary.append(element('div','','summary-divider'));
    if (catalogue.vatRegistered) {const row=element('div','','summary-line');row.append(element('span','VAT (20%)'),element('span',money(quote.vat)));summary.append(row);}
    const grand=element('div',`Total per ${period}`,'summary-grand');grand.append(element('strong',money(quote.gross)));summary.append(grand);button.disabled=busy;
  } catch(error) {summary.append(element('p',error.message));button.disabled=true;}
}
enterprise.addEventListener('change',()=>{renderWards();updateTotal();});
tablets.addEventListener('input',updateTotal);
form.querySelectorAll('[name="interval"]').forEach(input=>input.addEventListener('change',updateTotal));
document.querySelector('#add-ward').addEventListener('click',()=>{if(wards.length<100){wards.push({site:wards.at(-1).site,name:`Ward ${wards.length+1}`,plan:'essential',modules:[]});renderWards();updateTotal();}});
form.addEventListener('submit',async event=>{
  event.preventDefault(); if(busy || !form.reportValidity())return;
  message.textContent='';busy=true;form.inert=true;button.disabled=true;button.textContent='Opening secure checkout…';
  try {
    const quote=pricePackage(selection()); const data=new FormData(form);
    const response=await fetch(`${apiUrl}/api/billing/checkout`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      organisationName:data.get('organisationName'),contactName:data.get('contactName'),billingEmail:data.get('billingEmail'),billingPhone:data.get('billingPhone'),
      package:quote.selection,catalogueVersion:catalogue.version,acceptedTerms:document.querySelector('#acceptedTerms').checked
    })});
    const result=await response.json(); if(!response.ok || !result.checkoutUrl)throw new Error(result.error || 'Unable to open checkout. Please contact SecureObs.');
    window.location.assign(result.checkoutUrl);
  }catch(error){message.textContent=error.message || 'Unable to open checkout.';busy=false;form.inert=false;button.textContent='Continue to secure payment';updateTotal();}
});
if(new URLSearchParams(location.search).has('cancelled'))message.textContent='Checkout was cancelled. Review your package before trying again.';
renderWards();updateTotal();
