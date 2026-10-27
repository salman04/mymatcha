import {MIXING_DURATION,MIXING_PAUSE} from '../dist/preparation-motion.js';
import assert from 'node:assert/strict';
import {createMixingState} from '../dist/mixing.js';
import {newRecipe,ORDERS,rateOrder} from '../dist/recipe.js';
const drink={water:60,milk:120,powder:2,foam:.7,cream:0,ice:4,first:'milk'};
const mix=createMixingState();mix.setRecipe(drink);mix.advance(5);assert.equal(mix.progress,0,'Preparation remains layered');
mix.start();mix.advance(MIXING_PAUSE);assert.equal(mix.progress,0);mix.advance((MIXING_DURATION-MIXING_PAUSE)/2);assert.ok(Math.abs(mix.progress-.5)<1e-10);
const midway=mix.progress;mix.setRecipe({...drink,ice:5,cream:25});mix.start();assert.equal(mix.progress,midway,'Reopening or changing toppings must not unmix the latte');
mix.advance(100);assert.equal(mix.progress,1);mix.start();mix.advance(1);assert.equal(mix.progress,1,'Completed drinks must stay blended');
mix.setRecipe({...drink,milk:130});assert.equal(mix.progress,0,'New liquid starts a new presentation');mix.advance(10);assert.equal(mix.progress,0);mix.start();mix.advance(5);assert.ok(mix.progress>0);
mix.reset();mix.setRecipe(drink);assert.equal(mix.progress,0);mix.advance(10);assert.equal(mix.progress,0,'New game waits for serving');
for(const solo of [{...drink,milk:0},{...drink,powder:0},{...drink,water:0}]){mix.reset();mix.setRecipe(solo);mix.start();mix.advance(100);assert.equal(mix.progress,0,'A single ingredient must not change color');}
for(const first of ['milk','matcha']){const s={...newRecipe(),glass:{...drink,first}},snapshot=JSON.stringify(s),rating=rateOrder(s,ORDERS[0]);mix.reset();mix.setRecipe(s.glass);mix.start();mix.advance(MIXING_DURATION);assert.equal(mix.progress,1);assert.equal(JSON.stringify(s),snapshot);assert.deepEqual(rateOrder(s,ORDERS[0]),rating);}
console.log('Mixing passed: gradual timeline, both pour orders, solo ingredients, replay/reset behavior, unchanged recipe and rating.');
