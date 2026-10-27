import assert from 'node:assert/strict';
import {ORDERS,orderAmounts,newRecipe,rateOrder} from '../dist/recipe.js';
const perfect=order=>({...newRecipe(),temperature:order.temperature,glass:{milkType:order.milkType,powder:orderAmounts(order).powder[0]+1,water:60,milk:(orderAmounts(order).milk[0]+orderAmounts(order).milk[1])/2,foam:.7,ice:order.temperature==='ice'?orderAmounts(order).iceMin:0,cream:order.cloud?25:0,first:'milk'}});
for(const order of ORDERS){
 const s=perfect(order),snapshot=JSON.stringify(s),rating=rateOrder(s,order);
 assert.equal(rating.score,100);assert.equal(rating.stars,5);assert.equal(rating.perfect,true);assert.ok(rating.quote.length>30);
 assert.equal(JSON.stringify(s),snapshot,'Rating must not change the drink');
 s.glass.first='matcha';s.elapsed=999999;assert.deepEqual(rateOrder(s,order),rating,'Pour sequence and time cannot affect a rating');
}
const s=perfect(ORDERS[1]);s.glass.cream=0;
assert.equal(rateOrder(s,ORDERS[1]).stars,4);assert.equal(rateOrder(s,ORDERS[1]).score,90);assert.match(rateOrder(s,ORDERS[1]).tip,/krim cloud/);
s.glass.ice=0;assert.equal(rateOrder(s,ORDERS[1]).stars,2);assert.equal(rateOrder(s,ORDERS[1]).score,55);
s.glass.powder=0;assert.equal(rateOrder(s,ORDERS[1]).stars,1);assert.equal(rateOrder(s,ORDERS[1]).score,30);
s.temperature='hot';assert.equal(rateOrder(s,ORDERS[1]).stars,1);assert.equal(rateOrder(s,ORDERS[1]).score,30);
// Temperature and ice now come from the same physical cubes. Test all 32
// achievable combinations of the five independent recipe requirements.
const fields=['matcha','milk','foam','ice','cloud'];
for(let mask=0;mask<32;mask++){
 const state=perfect(ORDERS[1]);if(!(mask&1))state.glass.powder=0;if(!(mask&2))state.glass.milk=0;if(!(mask&4))state.glass.foam=0;if(!(mask&8))state.glass.ice=0;if(!(mask&16))state.glass.cream=0;
 const r=rateOrder(state,ORDERS[1]);assert.ok(r.stars>=1&&r.stars<=5);assert.equal(r.perfect,mask===31);assert.equal(r.stars===5,mask===31);assert.equal(r.checks.reduce((n,c)=>n+c.weight,0),100);
 for(let i=0;i<fields.length;i++)if(!(mask&(1<<i))){const next=structuredClone(state);if(i===0)next.glass.powder=2;else if(i===1)next.glass.milk=120;else if(i===2)next.glass.foam=.7;else if(i===3)next.glass.ice=3;else next.glass.cream=25;const better=rateOrder(next,ORDERS[1]);assert.ok(better.score>r.score);assert.ok(better.stars>=r.stars);}
}
const hot=perfect(ORDERS[2]);hot.glass.ice=3;assert.equal(rateOrder(hot,ORDERS[2]).score,65);assert.match(rateOrder(hot,ORDERS[2]).tip,/tanpa es/);
const extra=perfect(ORDERS[0]);extra.glass.cream=25;assert.match(rateOrder(extra,ORDERS[0]).tip,/tanpa krim cloud/);
console.log('Rating checks passed: three recipes, all five tiers, all 32 achievable criterion combinations, specific feedback, no time or pour-order penalty.');
