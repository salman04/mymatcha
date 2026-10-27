import assert from 'node:assert/strict';
import {ORDERS,orderAmounts,newRecipe,addMilk,addIce,addCloud,transfer,evaluate,space,volume} from '../dist/recipe.js';
import {GLASS_CAPACITY_ML} from '../dist/glass-size.js';
assert.equal(GLASS_CAPACITY_ML,450);
assert.equal(space(newRecipe().glass),450,'The taller serving glass holds 450 ml before displacement');
function prepare(order,milkFirst,iceBatches=1){const s=newRecipe();s.temperature=order.temperature;s.selectedMilk=order.milkType;if(milkFirst)addMilk(s,120);Object.assign(s,{powder:2,water:60,foam:.7});assert.equal(transfer(s),true);if(!milkFirst)addMilk(s,120);if(order.temperature==='ice')for(let i=0;i<iceBatches;i++)assert.equal(addIce(s),true);if(order.cloud)assert.equal(addCloud(s),true);return s;}
for(const order of ORDERS.slice(0,3))for(const first of [true,false])for(const batches of order.temperature==='ice'?[1,2]:[0]){const s=prepare(order,first,batches);assert.ok(evaluate(s,order).every(x=>x.ok),`${order.name} / milk first ${first} / ${batches} ice batches`);assert.equal(s.glass.first,first?'milk':'matcha');assert.equal(s.water,0);assert.equal(s.powder,0);assert.equal(s.glass.ice,batches*3);assert.equal(volume(s.glass),order.cloud?205:180);assert.ok(space(s.glass)>=0);}
const wrong=prepare(ORDERS[0],true);assert.ok(evaluate(wrong,ORDERS[2]).some(c=>!c.ok));assert.ok(evaluate(wrong,ORDERS[1]).some(c=>!c.ok));
const missing=newRecipe();assert.equal(transfer(missing),false);assert.equal(addCloud(missing),false);assert.ok(evaluate(missing,ORDERS[0]).some(c=>!c.ok));
const hot=prepare(ORDERS[2],false);assert.equal(addIce(hot),true);assert.equal(hot.glass.ice,3);assert.equal(hot.temperature,'ice','Adding ice turns a Hot recipe into Ice');
const full=newRecipe();assert.equal(addIce(full),true);assert.equal(full.glass.ice,3);assert.equal(space(full.glass),420);assert.equal(addIce(full),true);assert.equal(full.glass.ice,6);assert.equal(space(full.glass),390);assert.equal(addIce(full),true);assert.equal(full.glass.ice,9);assert.equal(addIce(full),true);assert.equal(full.glass.ice,12);assert.equal(space(full.glass),330);const maxBefore=structuredClone(full);assert.equal(addIce(full),false);assert.deepEqual(full,maxBefore,'a fifth batch cannot exceed twelve cubes');assert.equal(addMilk(full,999),330);assert.equal(full.glass.milk,330);assert.equal(space(full.glass),0);Object.assign(full,{powder:1,water:60});const fullBefore=structuredClone(full);assert.equal(transfer(full),false);assert.deepEqual(full,fullBefore,'A rejected transfer preserves both the full glass and the chawan');
for(const [milk,accepted] of [[419.999,true],[420,true],[420.000001,false],[430,false],[440,false],[450,false]]){
 const s=newRecipe();Object.assign(s,{powder:2,water:60,foam:.7});Object.assign(s.glass,{milk,first:'milk'});const before=structuredClone(s),free=space(s.glass);
 assert.equal(addIce(s),accepted,`${free} ml remaining capacity`);
 if(accepted){assert.equal(s.glass.ice,3);assert.equal(space(s.glass),free-30);assert.deepEqual({...s,temperature:before.temperature,glass:{...s.glass,ice:0}},before,'adding ice preserves every other ingredient');}
 else assert.deepEqual(s,before,'a rejected batch cannot add one or two cubes or alter ingredients');
}
const partialRoom=prepare(ORDERS[0],true);addMilk(partialRoom,225);assert.equal(partialRoom.glass.ice,3);assert.equal(space(partialRoom.glass),15);const partialBefore=structuredClone(partialRoom);assert.equal(addIce(partialRoom),false);assert.deepEqual(partialRoom,partialBefore,'a second batch needs room for all three cubes');
for(const count of [10,11,12]){const s=newRecipe();s.glass.ice=count;const before=structuredClone(s);assert.equal(addIce(s),false);assert.deepEqual(s,before,'batch size never shrinks to fit the twelve-cube limit');}
const unwhisked=prepare(ORDERS[0],true);unwhisked.glass.foam=0;assert.equal(evaluate(unwhisked,ORDERS[0])[3].ok,false);
const excessCloud=prepare(ORDERS[1],true);addCloud(excessCloud);assert.equal(excessCloud.glass.cream,40);assert.equal(addCloud(excessCloud),false);
// A full-size drink can cross the old 300 ml limit without losing ingredients.
const exactTransfer=newRecipe();addIce(exactTransfer);addIce(exactTransfer);addMilk(exactTransfer,330);Object.assign(exactTransfer,{powder:2,water:60,foam:.7});
assert.equal(space(exactTransfer.glass),60);assert.equal(transfer(exactTransfer),true);
assert.deepEqual(exactTransfer.glass,{water:60,powder:2,foam:.7,milk:330,milkType:'fresh',milkParts:{fresh:330},cream:0,ice:6,first:'milk'});
assert.equal(volume(exactTransfer.glass),390);assert.equal(space(exactTransfer.glass),0);assert.equal(exactTransfer.water,0);assert.equal(exactTransfer.powder,0);assert.equal(exactTransfer.foam,0);
const fullCloud=newRecipe();Object.assign(fullCloud.glass,{water:60,milk:320,powder:2,foam:.7,ice:3,first:'milk'});
assert.equal(space(fullCloud.glass),40);assert.equal(addCloud(fullCloud),true);assert.equal(fullCloud.glass.cream,25);assert.equal(space(fullCloud.glass),15);
assert.equal(addCloud(fullCloud),true);assert.equal(fullCloud.glass.cream,40);assert.equal(volume(fullCloud.glass),420);assert.equal(space(fullCloud.glass),0);
const cloudBefore=structuredClone(fullCloud);assert.equal(addCloud(fullCloud),false);assert.equal(addMilk(fullCloud,20),0);assert.deepEqual(fullCloud,cloudBefore,'A full cloud latte cannot silently gain more liquid');
const lastCloudSpace=newRecipe();Object.assign(lastCloudSpace.glass,{water:60,milk:355,powder:2,ice:3,first:'milk'});assert.equal(space(lastCloudSpace.glass),5);assert.equal(addCloud(lastCloudSpace),true);assert.equal(lastCloudSpace.glass.cream,5);assert.equal(space(lastCloudSpace.glass),0);assert.equal(addCloud(lastCloudSpace),false);
console.log('Passed: all 3 orders × both pour sequences, 450 ml capacity, one/two whole ice batches, Hot and twelve-cube limits, exact 30 ml capacity edges, atomic rejected batches, cloud and transfer conservation at full capacity.');

assert.equal(ORDERS.length,10);
for(const order of ORDERS)for(const milkFirst of [true,false]){
 const a=orderAmounts(order),s=newRecipe();s.temperature=order.temperature;s.selectedMilk=order.milkType;
 const milk=(a.milk[0]+a.milk[1])/2;
 if(milkFirst)addMilk(s,milk);
 Object.assign(s,{powder:a.powder[0]+1,water:60,foam:.7});assert.ok(transfer(s));
 if(!milkFirst)addMilk(s,milk);
 if(order.temperature==='ice')for(let i=0;i<a.iceMin/3;i++)assert.ok(addIce(s));
 if(order.cloud)assert.ok(addCloud(s));
 assert.ok(evaluate(s,order).every(c=>c.ok),order.name+' is achievable through the actual recipe actions');
 assert.ok(volume(s.glass)+s.glass.ice*10<=450);
 const valid=structuredClone(s);
 for(const [field,value,key] of [['powder',a.powder[0]-1,'matcha'],['milk',a.milk[0]-1,'milk'],['milk',a.milk[1]+1,'milk']]){
  const invalid=structuredClone(valid);invalid.glass[field]=value;assert.equal(evaluate(invalid,order).find(c=>c.key===key).ok,false);
 }
 if(order.temperature==='ice'){s.glass.ice=a.iceMin-3;assert.equal(evaluate(s,order).find(c=>c.key==='ice').ok,false);}
}
console.log('Ten distinct orders are achievable in either pour sequence; four three-cube batches fit, a fifth is rejected atomically.');
