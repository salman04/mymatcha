import test from 'node:test';
import assert from 'node:assert/strict';
import {MILK_TYPES,milkDescription} from '../dist/milk-types.js';
import {ORDERS,newRecipe,addMilk,transfer,addIce,addCloud,evaluate,rateOrder,space,orderAmounts} from '../dist/recipe.js';
function prepare(order,type,first=true){const s=newRecipe(),a=orderAmounts(order);s.temperature=order.temperature;s.selectedMilk=type;
 if(first)addMilk(s,a.milk[0]+20);Object.assign(s,{powder:a.powder[0]+1,water:60,foam:.7});assert.ok(transfer(s));if(!first)addMilk(s,a.milk[0]+20);
 if(order.temperature==='ice')for(let i=0;i<a.iceMin/3;i++)addIce(s);if(order.cloud)addCloud(s);return s;
}
test('all ten orders accept only the ordered milk in either pour sequence',()=>{
 assert.deepEqual(new Set(ORDERS.map(o=>o.milkType)),new Set(Object.keys(MILK_TYPES)));
 for(const order of ORDERS)for(const first of[true,false])for(const type of Object.keys(MILK_TYPES)){
  const s=prepare(order,type,first),rating=rateOrder(s,order);
  assert.equal(rating.perfect,type===order.milkType);assert.equal(rating.score,type===order.milkType?100:80);
  assert.equal(evaluate(s,order).find(c=>c.key==='milk').ok,type===order.milkType);
  if(type!==order.milkType)assert.ok(rating.tip.includes(MILK_TYPES[order.milkType].name));
 }
});
test('switching the selected carton cannot change milk already in the glass',()=>{
 const order=ORDERS[0],s=prepare(order,'almond');s.selectedMilk='fresh';assert.equal(s.glass.milkType,'almond');assert.equal(rateOrder(s,order).perfect,false);
 addMilk(s,40);assert.equal(s.glass.milkType,'mixed');assert.equal(s.glass.milkParts.fresh,40);assert.equal(rateOrder(s,order).perfect,false);
 assert.match(milkDescription(s.glass),/Almond Milk 100 ml.*Fresh Milk 40 ml/);
});
test('mixed milk conserves capacity and is reset with a new drink',()=>{
 const s=newRecipe();assert.equal(addMilk(s,120,'oat'),120);assert.equal(addMilk(s,120,'almond'),120);assert.equal(addMilk(s,999,'fresh'),210);
 assert.equal(space(s.glass),0);assert.equal(s.glass.milk,450);assert.equal(Object.values(s.glass.milkParts).reduce((a,b)=>a+b,0),450);
 const before=structuredClone(s);for(const n of[30,-2,NaN,Infinity])assert.equal(addMilk(s,n,'fresh'),0);assert.deepEqual(s,before);
 const empty=newRecipe();assert.deepEqual(empty.glass.milkParts,{});assert.equal(empty.glass.milkType,null);
 assert.equal(addMilk(empty,40,'invalid'),0);assert.equal(empty.glass.milk,0);
});
