import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { catalogue, pricePackage, wardFeatures } from '../src/billing/package-pricing.js';
import { checkoutLines } from '../dist/billing/checkout.js';
import { reconcileFeatures } from '../dist/billing/reconcile.js';
import { config } from '../dist/config.js';
const require=createRequire(import.meta.url);
const ts=require('typescript'); const {z}=require('zod');
config.stripeSecretKey='sk_test_mock';config.stripeWebhookSecret='whsec_mock';
config.stripePriceIds.essential.monthly='price_base';config.stripeExtraPriceIds.rostering='price_roster';config.stripeExtraPriceIds.tablets='price_tablet';
const selection={interval:'monthly',enterprise:false,tablets:2,wards:[{site:'Main',name:'A',plan:'essential',modules:['rostering']},{site:'Main',name:'B',plan:'essential',modules:[]}]};
const items=[{price:'price_base',quantity:2,key:'essential'},{price:'price_roster',quantity:1,key:'rostering'},{price:'price_tablet',quantity:2,key:'tablets'}];
let status='incomplete', customers=0,checkout,connects=0;
const queries=[];
const client={
 prices:{retrieve:async id=>({active:true,currency:'gbp',unit_amount:id==='price_base'?14900:id==='price_roster'?4500:3799,tax_behavior:id==='price_tablet'?'inclusive':'exclusive',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}})},
 customers:{create:async()=>{customers++;return {id:'cus_mock'};},retrieve:async()=>({id:'cus_mock'})},
 checkout:{sessions:{create:async args=>{checkout=args;return {url:'https://checkout.stripe.com/mock'};}}},
 subscriptions:{retrieve:async()=>({id:'sub_mock',status,metadata:{billingAccountId:'account'},cancel_at_period_end:false,items:{data:items.map(item=>({...item,price:{id:item.price},current_period_end:1900000000}))}})},
 webhooks:{constructEvent:body=>body}
};
const pool={query:async(sql,params)=>{queries.push([sql,params]);if(sql.includes('select package_selection'))return {rows:[{package_selection:selection,ordered_items:items}]};return {rows:[],rowCount:1};},connect:async()=>{connects++;return {query:async(sql,params)=>{queries.push([sql,params]);if(sql.includes('select * from billing_accounts'))return {rows:[{id:'account',organisation_name:'Test company',subscription_plan:'essential',package_selection:selection}]};return {rows:[]};},release(){}};}};
let handler;
const exports={};
const stubs={
 'node:crypto':require('node:crypto'),express:{Router:()=>({get(){},post(path,...handlers){if(path==='/checkout')handler=handlers.at(-1);}})},
 stripe:class {constructor(){return client;}},zod:{z},'../auth.js':{requireStaffRole:()=>()=>{}},'../config.js':{config},'../db/pool.js':{pool},
 '../billing/package-pricing.js':{catalogue,pricePackage,wardFeatures},'../billing/checkout.js':{checkoutLines},'../billing/reconcile.js':{reconcileFeatures}
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/routes/billing.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{exports,require:name=>stubs[name]??require(name),console});
function response(){return {code:200,status(value){this.code=value;return this;},json(value){this.body=value;},send(value){this.body=value;}};}
const res=response();
await handler({body:{organisationName:'Test company',contactName:'Test person',billingEmail:'test@example.com',acceptedTerms:true,catalogueVersion:catalogue.version,package:selection,gross:1}},res,error=>{throw error;});
assert.equal(res.code,201);assert.equal(customers,1);assert.equal(checkout.mode,'subscription');assert.equal(checkout.automatic_tax.enabled,false);assert.equal(checkout.line_items.length,3);
assert.equal(queries.find(([sql])=>sql.includes('insert into billing_accounts'))[1][11],41898);
console.log('PASS: checkout combines quantities, disables tax calculation while unregistered and ignores a forged client total');
const incomplete=response();
await exports.stripeWebhookHandler({headers:{'stripe-signature':'mock'},body:{id:'evt_incomplete',type:'checkout.session.completed',data:{object:{metadata:{billingAccountId:'account'},subscription:'sub_mock',customer:'cus_mock'}}}},incomplete);
assert.equal(connects,0);
status='active';
await exports.stripeWebhookHandler({headers:{'stripe-signature':'mock'},body:{id:'evt_active',type:'checkout.session.completed',data:{object:{metadata:{billingAccountId:'account'},subscription:'sub_mock',customer:'cus_mock'}}}},response());
const wards=queries.filter(([sql])=>sql.includes('insert into wards'));
assert.equal(wards.length,2);assert.equal(JSON.parse(wards[0][1][3]).rostering,true);assert.equal(JSON.parse(wards[1][1][3]).rostering,false);
console.log('PASS: no provisioning before active subscription; paid webhook provisions two wards with separate module entitlements');
