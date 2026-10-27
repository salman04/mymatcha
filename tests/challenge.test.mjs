import assert from 'node:assert/strict';
import {createChallenge,ORDER_DURATION_MS,formatRemaining} from '../dist/challenge.js';
import {ORDERS} from '../dist/recipe.js';
let now=0;
const session=createChallenge(ORDERS.length,()=>now);
assert.equal(ORDER_DURATION_MS,180000);
assert.equal(session.status,'idle');now=900000;session.tick();assert.equal(session.status,'idle','Menu and Cozy do not run a clock');
session.start();assert.equal(session.tick(),180000);assert.equal(session.round,0);
assert.equal(formatRemaining(session.tick()),'03:00');assert.equal(formatRemaining(1),'00:01');assert.equal(formatRemaining(0),'00:00');
now+=40000;assert.equal(session.serve(false),false);assert.equal(session.tick(),140000,'Wrong recipe keeps the same deadline');assert.equal(session.completed,0);
assert.equal(session.next(),false,'An unfinished order cannot advance');
now+=139999;assert.equal(session.tick(),1);assert.equal(session.serve(true),true,'A correct order may pass just before its deadline');assert.equal(session.completed,1);
const stopped=session.tick();now+=900000;assert.equal(session.tick(),stopped,'Successful serving stops the clock');assert.equal(session.serve(true),false);assert.equal(session.completed,1,'Repeated result views never double-count');
assert.equal(session.next(),true);assert.equal(session.round,1);assert.equal(session.tick(),180000);
now+=180000;assert.equal(session.serve(true),false,'Exactly at the deadline is too late, even without a preceding animation frame');assert.equal(session.status,'expired');assert.equal(session.completed,1);assert.equal(session.next(),false);
session.retry();assert.equal(session.round,1);assert.equal(session.completed,1);assert.equal(session.tick(),180000);
now+=999999;assert.equal(session.tick(),0,'A background tab or open dialog cannot extend the deadline');assert.equal(session.status,'expired');
session.retry();assert.equal(session.tick(),180000);assert.equal(session.serve(false),false);
for(let i=1;i<10;i++){
 assert.equal(session.round,i);now+=25000;assert.equal(session.serve(true),true);assert.equal(session.completed,i+1);
 if(i<9){assert.equal(session.complete,false);assert.equal(session.next(),true);assert.equal(session.tick(),180000);}
}
assert.equal(session.complete,true);assert.equal(session.completed,10);assert.equal(session.next(),false,'There is no eleventh order');
session.start();assert.equal(session.completed,0);assert.equal(session.round,0);assert.equal(session.complete,false);assert.equal(session.tick(),180000);
session.stop();now+=180001;session.tick();assert.equal(session.status,'idle');assert.equal(session.completed,0);
console.log('Challenge passed: ten-order progression, 3-minute deadline, unsuccessful serving, boundary/hidden-tab expiry, frozen success, retry preservation, no duplicate credit, final completion and main-menu cleanup.');
