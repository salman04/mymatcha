import test from 'node:test';
import assert from 'node:assert/strict';
import {CUSTOMERS,customerForOrder,customerForRound} from '../dist/customers.js';
import {ORDERS,newRecipe,orderAmounts,rateOrder} from '../dist/recipe.js';

function prepare(order){
 const s=newRecipe(),a=orderAmounts(order);s.temperature=order.temperature;
 Object.assign(s.glass,{powder:a.powder[0]+1,water:60,milk:(a.milk[0]+a.milk[1])/2,milkType:order.milkType,foam:.7,ice:order.temperature==='ice'?a.iceMin:0,cream:order.cloud?25:0});
 return s;
}

test('ten orders keep stable, distinct customers and their own voice',()=>{
 assert.equal(CUSTOMERS.length,10);
 for(const key of ['id','name','tagline','greeting','perfectQuote','encouragement'])assert.equal(new Set(CUSTOMERS.map(c=>c[key])).size,10,key);
 ORDERS.forEach((order,index)=>{
  const customer=customerForOrder(order),rating=rateOrder(prepare(order),order);
  assert.equal(customer,customerForRound(index));assert.equal(customer.id,order.customerId);
  assert.equal(customerForOrder(structuredClone(order)),customer,'Identity survives saving or cloning an order');
  assert.equal(rating.customer,customer);assert.equal(rating.quote,customer.perfectQuote);assert.equal(rating.reason,null);
  assert.equal(rating.score,100);assert.equal(rating.stars,5);assert.equal(rating.perfect,true);
  assert.match(customer.color,/^#[0-9a-f]{6}$/i);assert.ok(customer.avatar.hair&&customer.avatar.shirt&&customer.avatar.style);
  assert.ok(Object.isFrozen(customer));assert.ok(Object.isFrozen(customer.avatar));
  const wrong=prepare(order);wrong.glass.milk=0;const reaction=rateOrder(wrong,order);
  assert.ok(reaction.quote.startsWith(customer.encouragement));assert.match(reaction.quote,/Susunya belum ada/);
  assert.equal(reaction.score,80);assert.equal(reaction.stars,4);assert.equal(reaction.perfect,false);
 });
 assert.equal(customerForRound(10),CUSTOMERS[0]);assert.equal(customerForRound(-1),CUSTOMERS[0]);assert.equal(customerForRound(NaN),CUSTOMERS[0]);
 assert.equal(customerForOrder(),CUSTOMERS[0]);assert.equal(customerForOrder({customerId:'unknown'}),CUSTOMERS[0]);
});

test('reactions distinguish missing milk, wrong carton, mixtures, and amount',()=>{
 for(const order of ORDERS){
  const a=orderAmounts(order);
  for(const [changes,reason,words] of [
   [{milk:0},'milk-missing',/Susunya belum ada/],
   [{milkType:order.milkType==='fresh'?'almond':'fresh'},'milk-type',/tetapi gelasku berisi/],
   [{milkType:'mixed'},'milk-type',/tercampur beberapa jenis/],
   [{milk:a.milk[0]-1},'milk-low',/susu sedikit lebih banyak/],
   [{milk:a.milk[1]+1},'milk-high',/Susunya lebih banyak/],
  ]){
   const s=prepare(order);Object.assign(s.glass,changes);const before=structuredClone(s),r=rateOrder(s,order);
   assert.equal(r.reason,reason);assert.match(r.quote,words);assert.equal(r.score,80);assert.deepEqual(s,before);
  }
 }
 const wrong=prepare(ORDERS[0]);Object.assign(wrong.glass,{milkType:'almond',milk:40});
 assert.equal(rateOrder(wrong,ORDERS[0]).reason,'milk-type','A wrong carton is identified before its amount');
 wrong.glass.milk=0;assert.equal(rateOrder(wrong,ORDERS[0]).reason,'milk-missing','An empty glass cannot contain the wrong milk');
});

test('specific feedback follows actual matcha, water, temperature, foam, ice, and cloud',()=>{
 const cases=[
  [0,{powder:0},'matcha-missing',/Matchanya belum ada/],
  [6,{powder:2},'matcha-weak',/lebih pekat, dengan 3–4/],
  [0,{powder:4},'matcha-strong',/lebih pekat dari yang kupesan/],
  [0,{water:0},'water-missing',/dicampur air/],
  [0,{water:24},'water-low',/terlalu sedikit/],
  [0,{water:101},'water-high',/terlalu encer/],
  [0,{foam:0},'foam-low',/Kocok sedikit lagi/],
  [0,{ice:0},'ice-missing',/Esnya belum ada/],
  [3,{ice:6},'ice-low',/setidaknya 9/],
  [9,{ice:9},'ice-low',/setidaknya 12/],
  [0,{ice:13},'ice-high',/Maksimal 12/],
  [2,{ice:3},'ice-unwanted',/tanpa es/],
  [0,{cream:25},'cloud-unwanted',/tanpa cloud/],
  [1,{cream:0},'cloud-missing',/Cloud-nya belum ada/],
  [1,{cream:10},'cloud-low',/masih sedikit/],
  [1,{cream:41},'cloud-high',/lebih banyak dari yang kupesan/],
 ];
 for(const [round,changes,reason,words] of cases){
  const order=ORDERS[round],s=prepare(order);Object.assign(s.glass,changes);
  const r=rateOrder(s,order);assert.equal(r.reason,reason);assert.match(r.quote,words);assert.equal(r.perfect,false);
  assert.ok(r.quote.startsWith(customerForOrder(order).encouragement));
 }
 for(const round of [0,2]){
  const s=prepare(ORDERS[round]);s.temperature=round===0?'hot':'ice';
  const r=rateOrder(s,ORDERS[round]);assert.equal(r.reason,null);assert.equal(r.perfect,true,'Obsolete manual temperature does not override actual ice');
 }
});

test('missing ingredients never receive a perfect or ingredient-praising quote',()=>{
 for(const order of ORDERS){
  const s=newRecipe();s.temperature=order.temperature;const r=rateOrder(s,order);
  assert.equal(r.reason,'matcha-missing');assert.match(r.quote,/belum ada/);
  assert.notEqual(r.quote,customerForOrder(order).perfectQuote);
  assert.doesNotMatch(r.quote,/Segar dan lembut|Cloud-nya lembut|matchanya pas|Susunya pas/);
 }
});
