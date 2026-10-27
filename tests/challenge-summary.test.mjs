import assert from 'node:assert/strict';
import {createChallenge} from '../dist/challenge.js';
import {summaryRows,formatDuration,renderChallengeSummary} from '../dist/challenge-summary.js';
import {customerForOrder} from '../dist/customers.js';
import {ORDERS,newRecipe,orderAmounts,rateOrder} from '../dist/recipe.js';
let now=0;
const c=createChallenge(10,()=>now);
assert.deepEqual(c.summary.customers,[]);
c.start();now+=60000;c.serve(false,{score:65,stars:3});
assert.equal(c.summary.completed,0,'An unsuccessful tasting is not a completed customer');
now+=10000;c.retry();now+=20000;c.serve(true,{score:100,stars:5});
assert.deepEqual(c.summary.customers[0],{round:0,score:100,stars:5,elapsedMs:90000,attempts:2});
const saved=c.summary;now+=600000;c.tick();c.serve(true,{score:0,stars:1});assert.deepEqual(c.summary,saved,'Result viewing neither adds time nor replaces a recorded rating');
saved.customers[0].score=0;assert.equal(c.summary.totalScore,100,'Summary callers cannot mutate history');
c.next();now+=200000;c.tick();now+=600000;c.retry();now+=15001;c.serve(true,{score:100,stars:5});
assert.equal(c.summary.customers[1].elapsedMs,195001,'An expired attempt contributes exactly 3 minutes; the timeout dialog contributes no time');
assert.equal(c.summary.customers[1].attempts,2);
for(let i=2;i<10;i++){
 assert.ok(c.next());const order=ORDERS[i],a=orderAmounts(order),s=newRecipe();s.temperature=order.temperature;
 Object.assign(s.glass,{milkType:order.milkType,powder:a.powder[0]+1,water:60,milk:a.milk[0]+20,foam:.7,ice:order.temperature==='ice'?a.iceMin:0,cream:order.cloud?25:0});
 const rating=rateOrder(s,order);now+=(i+1)*1000;assert.ok(c.serve(rating.perfect,rating));
}
assert.equal(c.complete,true);assert.equal(c.summary.completed,10);assert.equal(c.summary.totalScore,1000);assert.equal(c.summary.totalStars,50);
assert.equal(c.summary.elapsedMs,337001);assert.equal(c.summary.maxScore,1000);assert.equal(c.summary.maxStars,50);
const rows=summaryRows(c.summary,ORDERS);assert.equal(rows.length,10);assert.equal(rows[9].name,ORDERS[9].name);
for(const row of rows){assert.equal(row.customerName,customerForOrder(ORDERS[row.round]).name);assert.equal(row.customerId,ORDERS[row.round].customerId);}
assert.equal(formatDuration(rows.reduce((sum,r)=>sum+r.seconds,0)),'05:38','Visible total equals the sum of the rounded row durations');
assert.equal(formatDuration(0),'00:00');assert.equal(formatDuration(3601),'60:01');
const custom=summaryRows({customers:[{round:4,score:85,stars:4,elapsedMs:45123,attempts:1}]},ORDERS)[0];
assert.equal(custom.score,85);assert.equal(custom.stars,4);assert.equal(custom.seconds,46,'Rendering preserves recorded values instead of filling in perfect ratings');
// Verify the rendered recap presents the same named customer as the order,
// alongside their original drink, milk, rating, score, and active time.
const elements=new Map();
const makeElement=tag=>({tag,textContent:'',children:[],attributes:{},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},setAttribute(name,value){this.attributes[name]=value;}});
const doc={getElementById(id){if(!elements.has(id))elements.set(id,makeElement('div'));return elements.get(id);},createElement:makeElement};
renderChallengeSummary(doc,c.summary,ORDERS);
const renderedRows=elements.get('recap-customers').children;assert.equal(renderedRows.length,10);
renderedRows.forEach((row,index)=>{
 assert.equal(row.children[0].children[0].textContent,customerForOrder(ORDERS[index]).name);
 assert.equal(row.children[0].children[1].textContent,ORDERS[index].name);
 assert.equal(row.children[1].children[0].textContent,'★★★★★');
 assert.equal(row.children[2].textContent,'100');
 assert.equal(row.children[3].children[0].textContent,formatDuration(rows[index].seconds));
});
c.retry();assert.equal(c.summary.completed,9);assert.equal(c.summary.totalScore,900);assert.equal(c.complete,false);
now+=5000;c.serve(true,{score:100,stars:5});assert.equal(c.summary.customers[9].elapsedMs,15000);assert.equal(c.summary.customers[9].attempts,2,'Redoing the latest completed order replaces its record and retains its active time');
c.start();assert.equal(c.summary.completed,0);assert.equal(c.summary.totalScore,0);assert.equal(c.summary.totalStars,0);assert.equal(c.summary.elapsedMs,0);assert.equal(c.round,0);assert.equal(c.tick(),180000);
now+=3000;c.serve(true);c.stop();assert.equal(c.summary.completed,0);assert.equal(c.summary.elapsedMs,0);assert.equal(c.status,'idle');
console.log('Challenge summary: ten recorded customers, scores/stars, actual completion times, retries, timeout gaps, frozen results, defensive snapshots, exact display totals, replay and menu cleanup passed.');
