import { milkName } from './milk-types.js';
import { customerForOrder } from './customers.js';
// Round each customer's active time to a displayed second, then sum those
// seconds so the total always agrees with the ten visible rows.
export function formatDuration(seconds){
 seconds=Math.max(0,Math.floor(seconds));
 return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
}
export function summaryRows(summary,orders){
 return summary.customers.map(result=>{const order=orders[result.round],customer=customerForOrder(order);return {...result,name:order.name,customerName:customer.name,customerId:customer.id,seconds:Math.ceil(result.elapsedMs/1000)};});
}
export function renderChallengeSummary(doc,summary,orders){
 const rows=summaryRows(summary,orders),$=id=>doc.getElementById(id);
 $('recap-score').textContent=summary.totalScore.toLocaleString('id-ID');
 $('recap-max-score').textContent=`/ ${summary.maxScore.toLocaleString('id-ID')}`;
 $('recap-stars').textContent=String(summary.totalStars);
 $('recap-max-stars').textContent=`/ ${summary.maxStars}`;
 $('recap-time').textContent=formatDuration(rows.reduce((sum,r)=>sum+r.seconds,0));
 $('recap-count').textContent=`${summary.completed} dari ${summary.totalOrders} pelanggan dilayani`;
 $('recap-customers').replaceChildren(...rows.map(result=>{
  const row=doc.createElement('tr'),customer=doc.createElement('th'),number=doc.createElement('span'),name=doc.createElement('span');
  customer.scope='row';number.className='recap-customer';number.textContent=result.customerName;name.className='recap-drink';name.textContent=result.name;const milk=doc.createElement('span');milk.className='recap-milk';milk.textContent=milkName(orders[result.round].milkType);customer.append(number,name,milk);
  const rating=doc.createElement('td'),stars=doc.createElement('span'),ratingText=doc.createElement('span');
  stars.className='recap-rating';stars.textContent='★'.repeat(result.stars)+'☆'.repeat(5-result.stars);stars.setAttribute('aria-hidden','true');
  ratingText.className='sr-only';ratingText.textContent=`${result.stars} dari 5 bintang`;rating.append(stars,ratingText);
  const score=doc.createElement('td');score.className='recap-row-score';score.textContent=String(result.score);
  const time=doc.createElement('td'),duration=doc.createElement('span');duration.textContent=formatDuration(result.seconds);time.className='recap-row-time';time.append(duration);
  if(result.attempts>1){const attempts=doc.createElement('span');attempts.className='recap-attempts';attempts.textContent=`${result.attempts} percobaan`;time.append(attempts);}
  row.append(customer,rating,score,time);return row;
 }));
}
