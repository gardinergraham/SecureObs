const api='https://adequate-energy-production.up.railway.app/api/show';
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n/100);
let token=sessionStorage.getItem('secureobs-show-token');
let order;
let busy=false;
async function call(path,body){const response=await fetch(api+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=await response.json();if(!response.ok){if(response.status===401){token=null;sessionStorage.removeItem('secureobs-show-token');$('account').hidden=true;$('login-panel').hidden=false;}throw new Error(result.error||'Unable to complete your request. Please try again.');}return result;}
async function action(fn){if(busy)return;busy=true;$('message').textContent='';document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){$('message').textContent=e.message;}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function paragraph(text,cls){const p=document.createElement('p');p.textContent=text;if(cls)p.className=cls;return p;}
async function load(){order=await call('/account');$('login-panel').hidden=true;$('account').hidden=false;$('organisation').textContent=order.organisationName;$('reference').textContent=`Order reference: ${order.id}`;
const summary=$('order-summary');summary.replaceChildren();
for(const ward of order.package.wards)summary.append(paragraph(`${ward.site} · ${ward.name} · ${order.package.enterprise?'Enterprise':ward.plan==='professional'?'Professional':'Essential'}`));
for(const line of order.quote.software.lines)summary.append(paragraph(`${line.label} × ${line.quantity}: ${money(line.gross)} per ${order.package.interval==='yearly'?'year':'month'}`));
summary.append(paragraph(`Software and paid modules: ${money(order.quote.software.gross)} ${order.package.interval==='yearly'?'annually':'monthly'}, paid upfront from activation.`,'amount'));
summary.append(paragraph(`${order.package.tablets} tablet(s): ${order.tabletReturned?'returned — future hire stopped':`free for six months, then ${money(order.quote.tabletMonthly)}/month if retained`}.`));
summary.append(paragraph('Desktop notes and care plans included. Initial 12-month software term; automatic renewal.'));
summary.append(paragraph(`Terms accepted: ${order.termsVersion}. ${order.proposedDate?`Activation date: ${order.proposedDate}${order.confirmedAt?' (confirmed)':' (awaiting your confirmation)'}.`:'Activation date: to be agreed.'}`));
$('status').textContent=['past_due','unpaid','incomplete'].includes(order.billingStatus)?'Your software payment needs attention. Contact SecureObs to resolve it before manager setup.':order.billingStatus==='canceled'?'Your software subscription has ended. Contact SecureObs to discuss reactivation.':order.active?'Your software package is active.':order.scheduled?'Your billing is scheduled for the confirmed date. No charge is due before then. Your package becomes available after the first software payment succeeds.':order.confirmedAt?'Your date is confirmed but scheduling needs to finish. Use the confirmation button again to retry safely, or contact SecureObs.':!order.paymentReady?'Your order is saved. Save a payment method securely with Stripe next. No payment will be taken today.':!order.proposedDate?'Your payment method is saved. SecureObs will contact you to agree an activation date. Sign in again to confirm the proposed date.':'Your payment method is saved and an activation date is ready for your confirmation.';
$('setup').hidden=!!order.confirmedAt || order.paymentReady;
$('confirmation').hidden=!order.paymentReady || !order.proposedDate || order.scheduled;
$('activation-detail').textContent=`Software and selected paid modules start on ${order.proposedDate}: ${money(order.quote.software.gross)} ${order.package.interval==='yearly'?'for the first year, paid upfront, then annually':'for the first month, paid upfront, then monthly'}. Tablets are free for six calendar months from this date, then ${money(order.quote.tabletMonthly)} per month if retained. No charge today.`;
$('manager').hidden=!order.active || !!order.managerStaffCode;
$('access').hidden=!order.managerStaffCode;
$('staff-code').textContent=`Staff code: ${order.managerStaffCode||''}`;
}
$('login-form').addEventListener('submit',e=>{e.preventDefault();action(async()=>{const data=new FormData(e.target);const result=await call('/login',{email:data.get('email'),password:data.get('password')});token=result.token;sessionStorage.setItem('secureobs-show-token',token);e.target.reset();await load();});});
$('setup').addEventListener('click',()=>action(async()=>{const result=await call('/setup',{});const url=new URL(result.checkoutUrl);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Unexpected payment address. Contact SecureObs.');location.assign(url.href);}));
$('refresh').addEventListener('click',()=>action(load));
$('logout').addEventListener('click',()=>action(async()=>{await call('/logout',{});sessionStorage.removeItem('secureobs-show-token');token=null;order=null;$('account').hidden=true;$('login-panel').hidden=false;}));
$('print').addEventListener('click',()=>window.print());
$('confirm-form').addEventListener('submit',e=>{e.preventDefault();action(async()=>{await call('/confirm',{date:order.proposedDate,accepted:true,termsVersion:order.termsVersion});await load();});});
$('manager-form').addEventListener('submit',e=>{e.preventDefault();action(async()=>{await call('/manager',{pin:new FormData(e.target).get('pin')});e.target.reset();await load();});});
if(token)action(load);
