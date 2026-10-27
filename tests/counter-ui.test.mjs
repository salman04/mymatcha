import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrderPeek,servingButtonPosition} from '../dist/counter-ui.js';
import {newRecipe,addIce,addMilk,transfer,drinkTemperature,canServe,evaluate,ORDERS} from '../dist/recipe.js';

test('the introductory order hides, pauses while read, and reopens until dismissed',()=>{
 const peek=createOrderPeek();assert.equal(peek.visible,false);peek.showIntro();peek.advance(7);assert.equal(peek.visible,true);
 peek.advance(30,{paused:true});assert.equal(peek.visible,true);peek.advance(1);assert.equal(peek.visible,false);
 peek.open();peek.advance(60);assert.equal(peek.visible,true);peek.close();assert.equal(peek.visible,false);
 peek.showIntro();peek.advance(3);peek.close();peek.advance(20);assert.equal(peek.visible,false);
 peek.showIntro();peek.advance(7);assert.equal(peek.visible,true);peek.advance(1);assert.equal(peek.visible,false);
});

test('Hot and Ice derive from actual ice; failed additions never change the recipe',()=>{
 const s=newRecipe();assert.equal(drinkTemperature(s),'hot');assert.equal(s.temperature,'hot');
 addMilk(s,120);Object.assign(s,{powder:2,water:60,foam:.5});transfer(s);s.glass.milkType='almond';
 assert.equal(evaluate(s,ORDERS[2]).every(c=>c.ok),true);
 assert.equal(addIce(s),true);assert.equal(drinkTemperature(s),'ice');assert.equal(s.temperature,'ice');
 s.temperature='hot';assert.equal(evaluate(s,ORDERS[0]).find(c=>c.key==='temperature').ok,true,'Ice cannot be overridden by an obsolete manual choice');
 const full=newRecipe();addMilk(full,450);const before=structuredClone(full);assert.equal(addIce(full),false);assert.deepEqual(full,before);assert.equal(drinkTemperature(full),'hot');
 assert.equal(drinkTemperature(newRecipe()),'hot','Reset clears the classification');
});

test('serving requires matcha in the glass, and follows the glass without covering it',()=>{
 const s=newRecipe();assert.equal(canServe(s),false);addMilk(s,120);assert.equal(canServe(s),false);Object.assign(s,{powder:1,water:30});assert.equal(canServe(s),false);transfer(s);assert.equal(canServe(s),true);
 for(const [width,height,x]of [[1280,800,1000],[390,844,333],[320,568,260]]){
  const glass={x,y:height*.55,width:50,height:100},p=servingButtonPosition(glass,width,height);
  assert.ok(p.x>=12&&p.x+98<=width-12);assert.ok(p.y>=80&&p.y+42<=height-78);
  assert.ok(p.x>=x+25||p.x+98<=x-25,'Button sits beside the glass');
 }
 assert.equal(servingButtonPosition({x:-100,y:250,width:50,height:100},390,844),null,'No detached Serve button when panning away');
});
