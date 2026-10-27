import assert from 'node:assert/strict';
import test from 'node:test';
import {createChallenge,ORDER_DURATION_MS} from '../dist/challenge.js';

function clock(){
 let time=0;
 return {session:createChallenge(2,()=>time),advance(ms){time+=ms;}};
}

test('a drink accepted just before the deadline remains valid throughout delivery',()=>{
 const {session,advance}=clock();session.start();advance(ORDER_DURATION_MS-1);
 const rating={score:94,stars:5};
 assert.equal(session.beginPresentation(true,rating),true);
 rating.score=1;
 assert.equal(session.status,'presenting');
 assert.equal(session.tick(),1);
 advance(4800);assert.equal(session.tick(),1);
 advance(900000);assert.equal(session.tick(),1,'Even a hidden tab cannot expire an accepted delivery');
 assert.equal(session.summary.completed,0,'No score is committed before the glass arrives');
 assert.equal(session.finishPresentation(),true);
 assert.equal(session.status,'passed');
 assert.deepEqual(session.summary.customers,[{round:0,score:94,stars:5,elapsedMs:ORDER_DURATION_MS-1,attempts:1}]);
 assert.equal(session.finishPresentation(),false);
 assert.equal(session.beginPresentation(true),false);
 assert.equal(session.summary.completed,1,'Repeated callbacks cannot award a second score');
 assert.equal(session.next(),true);
 assert.equal(session.finishPresentation(),false,'The previous delivery cannot finish the next order');
 assert.equal(session.tick(),ORDER_DURATION_MS);
});

test('the deadline is checked before accepting a delivery',()=>{
 for(const delay of [ORDER_DURATION_MS,ORDER_DURATION_MS+1]){
  const {session,advance}=clock();
  assert.equal(session.beginPresentation(true),false,'Menu has no active delivery');
  session.start();advance(delay);
  assert.equal(session.beginPresentation(true),false);
  assert.equal(session.status,'expired');
  assert.equal(session.finishPresentation(),false);
  assert.equal(session.summary.completed,0);
 }
});

test('an accepted correct drink cannot expire between clock reads at delivery completion',()=>{
 let time=0,step=0;
 const session=createChallenge(1,()=>{const result=time;time+=step;return result;});
 session.start();time=ORDER_DURATION_MS-.1;
 assert.equal(session.beginPresentation(true,{score:100,stars:5}),true);
 time+=4800;step=.2;
 assert.equal(session.finishPresentation(),true,'A sub-millisecond valid submission remains accepted');
 assert.equal(session.status,'passed');
 assert.equal(session.complete,true);
 assert.equal(session.summary.customers[0].elapsedMs,ORDER_DURATION_MS-.1);
 assert.equal(session.finishPresentation(),false);
});

test('an unsuccessful delivery resumes the same remaining preparation time',()=>{
 const {session,advance}=clock();session.start();advance(40000);
 assert.equal(session.beginPresentation(false,{score:40,stars:2}),true);
 assert.equal(session.beginPresentation(true),false,'A duplicate start cannot replace the captured recipe');
 assert.equal(session.serve(true),false,'The old synchronous API cannot bypass delivery');
 assert.equal(session.next(),false);
 advance(4800);assert.equal(session.tick(),140000);
 assert.equal(session.finishPresentation(),false);
 assert.equal(session.status,'running');
 assert.equal(session.tick(),140000);
 assert.equal(session.finishPresentation(),false);
 advance(10000);assert.equal(session.tick(),130000);
 assert.equal(session.beginPresentation(true,{score:100,stars:5}),true);
 advance(4800);assert.equal(session.finishPresentation(),true);
 assert.equal(session.summary.customers[0].elapsedMs,50000,'Neither delivery counts as preparation time');
});

test('retry cancels delivery and counts only the time actually spent preparing',()=>{
 const {session,advance}=clock();session.start();advance(60000);
 session.beginPresentation(true);advance(4800);session.retry();
 assert.equal(session.status,'running');
 assert.equal(session.tick(),ORDER_DURATION_MS);
 assert.equal(session.finishPresentation(),false,'A cancelled delivery cannot pass the retry');
 advance(20000);session.beginPresentation(true,{score:82,stars:4});advance(4800);
 assert.equal(session.finishPresentation(),true);
 assert.deepEqual(session.summary.customers[0],{round:0,score:82,stars:4,elapsedMs:80000,attempts:2});
});

test('starting over or returning to the menu clears an unfinished delivery',()=>{
 for(const cancel of ['start','stop']){
  const {session,advance}=clock();session.start();advance(12000);
  session.beginPresentation(true);advance(4800);session[cancel]();
  assert.equal(session.finishPresentation(),false);
  assert.equal(session.summary.completed,0);
  assert.equal(session.status,cancel==='start'?'running':'idle');
  assert.equal(session.tick(),ORDER_DURATION_MS);
  if(cancel==='start'){
   advance(1000);assert.equal(session.serve(true),true);
   assert.equal(session.summary.customers[0].elapsedMs,1000);
   assert.equal(session.summary.customers[0].attempts,1);
  }
 }
});
