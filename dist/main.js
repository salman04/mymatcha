import { AMBIENCE_LABELS } from './ambience-textures.js';
import { ATMOSPHERES,loadAtmosphere,saveAtmosphere } from './atmosphere.js';
import { createPresentationFlow } from './presentation-flow.js';
import { createOrderPeek, servingButtonPosition } from './counter-ui.js';
import { customerForOrder } from './customers.js';
import { renderCustomerPortrait } from './customer-view.js';
import { createTableGesture } from './table-gesture.js';
import { buildStudio } from './scene.js?v=milk-side-1';
import { preparationAction, toolForObject } from './object-interactions.js';
import { ORDERS,newRecipe,drinkTemperature,canServe,volume,space,addMilk,addIce,addCloud,transfer,evaluate,rateOrder } from './recipe.js?v=clear-counter-1';
import { createSoundscape } from './soundscape.js?v=ambience-1';
import { DEFAULT_AUDIO,loadAudioPreferences,saveAudioPreferences,normalizeAudioPreferences } from './audio-preferences.js?v=ambience-1';
import { milkName, milkDescription } from './milk-types.js';
import { GLASS_CAPACITY_ML } from './glass-size.js?v=challenge-1';
import { createChallenge, formatRemaining, ORDER_DURATION_MS } from './challenge.js?v=customers-1';
import { renderChallengeSummary } from './challenge-summary.js?v=customers-1';
import { PREPARATION_RATE } from './preparation-motion.js?v=tongs-1';
const $=s=>document.querySelector(s),canvas=$('#scene');
const challenge=createChallenge(ORDERS.length),orderPeek=createOrderPeek();

const AUDIO_KINDS=['music','ambience','effects'];
const soundscape=createSoundscape();let pageFocused=true,audioStorage;try{audioStorage=localStorage;}catch{}
let audioPrefs=loadAudioPreferences(audioStorage),audioStarted=false,audioRequest=0,audioRestore=null;
let studio;
try{studio=buildStudio(canvas);}catch(error){console.error('3D initialization:',error);$('#loading').hidden=true;$('#fallback').hidden=false;throw error;}
let state=newRecipe(),mode=null;
Object.assign(state,{started:false,powder:2,water:60,foam:.8});
let pendingPresentation=null,lastPresentation=null;const presentationFlow=createPresentationFlow();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let atmosphereKey=loadAtmosphere(audioStorage);
let selected='sieve',holding=false,last=0,elapsed=0,toastTimer;
let hoverPointer=null,hoveredObject=null;
let autoDose=null,pointerSession=null,readoutUntil=0,readoutKey='bowl',wasWorking=false;
const mobileView=matchMedia('(max-width:700px)');
const tableGesture=createTableGesture({
 onPan:delta=>{clearHover(true);studio.panTable(delta);},
 onTap:hit=>activateObject(hit,true),
 onHold:(hit,s)=>{activateObject(hit);if(holding&&selected==='whisk'){state.manualWhisk=true;state.dragOriginX=s.x;state.dragOriginY=s.y;state.whiskX=state.whiskZ=0;}},
 onRelease:()=>{stop();refresh();}
});
mobileView.addEventListener('change',()=>{tableGesture.cancel();stop();$('#mobile-view').hidden=!mobileView.matches||!mode;});
const toolOrder=['powder','sieve','water','whisk','milk','transfer','ice','cloud'];
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3400);}
function select(key){stop();studio.clearPour();selected=preparationAction(key);}
function refresh(){
 state.temperature=drinkTemperature(state);studio.updateMixture(state);

 $('#submit-drink').textContent=state.served?'Lihat hasil':'Sajikan ↗';
 updateOrderPanel();
 if(mode==='challenge'){
  const order=ORDERS[challenge.round],customer=customerForOrder(order);$('#customer').textContent=`${customer.name} · ${challenge.round+1} / ${ORDERS.length}`;
  $('#customer-tagline').textContent=customer.tagline;$('#customer-greeting').textContent=`“${customer.greeting}”`;
  if($('#order-avatar').dataset.customer!==customer.id){renderCustomerPortrait($('#order-avatar'),customer);$('#order-avatar').dataset.customer=customer.id;}
  $('#order-title').textContent=order.name;$('#order-milk').textContent=milkName(order.milkType);$('#order-note').textContent=order.note;
  $('#order-checks').replaceChildren(...evaluate(state,order).map(c=>{const li=document.createElement('li');li.className=c.ok?'met':'';li.textContent=`${c.ok?'✓':'○'} ${c.label}`;return li;}));
 }
}
function clearPresentation(){presentationFlow.reset();pendingPresentation=null;$('#delivery-note').hidden=true;$('#studio').classList.remove('presenting');$('#help').disabled=false;}
function clearActivity(){lastPresentation=null;$('#served-note').hidden=true;setAtmospherePanel(false);orderPeek.close();clearPresentation();tableGesture.cancel();stop();clearHover(true);readoutUntil=0;wasWorking=false;$('#measure-announcement').textContent='';soundscape.silence();studio.resetObjects();}
function begin(){
 if(mobileView.matches)studio.resetView();
 clearActivity();setAudioPanel(false);void unlockAudio();state=newRecipe();
 $('#mobile-view').hidden=!mobileView.matches;$('#welcome').hidden=true;$('#studio').classList.remove('menu-active');$('#workbench').hidden=true;$('#object-controls').hidden=false;$('#mode-switch').hidden=false;$('#reset').hidden=false;
 $('#finish-dialog').close();$('#timeout-dialog').close();$('#recap-dialog').close();$('#order-card details').open=true;$('#order-card').dataset.expanded='true';if(mode==='challenge')orderPeek.showIntro();
 $('#current-mode').textContent=mode==='challenge'?'Challenge':'Cozy · bebas waktu';
 $('#reset').setAttribute('aria-label',mode==='challenge'?'Ulangi pesanan dengan 3 menit baru':'Mulai racikan baru');$('#reset').title=mode==='challenge'?'Ulangi pesanan · 3 menit baru':'Racikan baru';
 $('#timer-announcement').textContent='';
 select('powder');$('#active-measure').hidden=true;refresh();syncChallenge();
}
function setMode(next){mode=next;if(mode==='challenge')challenge.start();else challenge.stop();begin();toast(mode==='challenge'?'Pesanan 1 dari 10. Waktumu 3 menit.':mobileView.matches?'Geser meja ke kiri atau kanan. Ketuk alat untuk meracik.':'Meja Cozy. Racik sesukamu, tanpa batas waktu.');}
function mainMenu(){
 clearActivity();challenge.stop();mode=null;state=newRecipe();state.started=false;
 for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
 $('#studio').classList.remove('result-active');studio.hideResult();$('#studio').classList.add('menu-active');
 $('#mobile-view').hidden=true;$('#welcome').hidden=false;$('#workbench').hidden=true;$('#object-controls').hidden=true;$('#active-measure').hidden=true;$('#mode-switch').hidden=true;$('#order-card').hidden=true;$('#reset').hidden=true;$('#object-label').hidden=true;
 clearTimeout(toastTimer);$('#toast').classList.remove('show');$('#timer-announcement').textContent='';setAudioPanel(false);refresh();$('#begin').focus({preventScroll:true});
}
let shownSeconds=-1,shownStatus=null,announcedMinute=false;
function syncChallenge(){
 if(mode!=='challenge')return;
 const remaining=challenge.tick(),seconds=Math.ceil(remaining/1000);
 if(seconds!==shownSeconds||challenge.status!==shownStatus){
  shownStatus=challenge.status;
  shownSeconds=seconds;$('#time-left').textContent=$('#compact-time').textContent=formatRemaining(remaining);
  $('#timer-track-fill').style.transform=`scaleX(${remaining/ORDER_DURATION_MS})`;
  $('#challenge-timer').classList.toggle('time-low',remaining<=30000);$('#order-chip').classList.toggle('time-low',remaining<=30000);
  $('#finish-time').textContent=challenge.status==='passed'?`Tersaji tepat waktu · sisa ${formatRemaining(remaining)}`:`Waktu terus berjalan · ${formatRemaining(remaining)}`;
 }
 if(seconds>60)announcedMinute=false;
 if(seconds<=60&&seconds>0&&!announcedMinute&&challenge.status==='running'){announcedMinute=true;$('#timer-announcement').textContent='Sisa waktu satu menit untuk pesanan ini.';}
 if(challenge.status==='expired'&&!$('#timeout-dialog').open){
  clearActivity();studio.updateMixture(state);$('#finish-dialog').close();$('#help-dialog').close();setAudioPanel(false);
  $('#timeout-order').textContent=`${customerForOrder(ORDERS[challenge.round]).name} · ${ORDERS[challenge.round].name}`;
  $('#timeout-progress').textContent=`${challenge.completed} pesanan sebelumnya tetap selesai. Ulangi pesanan ini dengan 3 menit baru, atau kembali ke menu.`;
  $('#timer-announcement').textContent='Waktu habis. Kamu bisa mencoba pesanan ini lagi.';
  $('#timeout-dialog').showModal();$('#retry-order').focus();
 }
}
function canInteract(){if(pendingPresentation||!mode||!state.started)return false;syncChallenge();return mode!=='challenge'||challenge.status!=='expired';}
function retryOrder(){if(!mode)return;if(mode==='challenge')challenge.retry();begin();}
function showRecap(){
 if(mode!=='challenge'||!challenge.complete)return;
 stop();setAudioPanel(false);soundscape.silence();$('#finish-dialog').close();studio.hideResult();$('#studio').classList.remove('result-active');
 renderChallengeSummary(document,challenge.summary,ORDERS);
 if(!$('#recap-dialog').open)$('#recap-dialog').showModal();
 $('.recap-scroll').scrollTop=0;$('#recap-title').focus({preventScroll:true});
}
function showFinish(presentation=null){
 stop();setAudioPanel(false);soundscape.silence();const g=state.glass,rating=presentation?presentation.rating:mode==='challenge'?rateOrder(state,ORDERS[challenge.round]):null,checks=rating?.checks||[],success=checks.every(c=>c.ok);
 if(mode==='challenge'&&challenge.status==='expired'){syncChallenge();return;}state.served=success;
 const base=g.powder>0?(g.milk>0?'Matcha Latte':'Matcha'):'Susu';
 const title=`${state.temperature==='ice'?'Ice':'Hot'} ${g.cream?'Cloud ':''}${base}`;
 $('#finish-title').textContent=success?(g.powder>0?'Selamat, Matcha-mu telah jadi!':'Selamat, racikanmu telah jadi!'):'Satu cangkir, satu langkah lagi.';
 $('#finish-description').textContent=mode==='challenge'?(success?`${challenge.completed} dari ${ORDERS.length} pesanan selesai. Pelangganmu punya pesan untukmu.`:`Pesanan ${rating.customer.name}: ${ORDERS[challenge.round].name}.`):`${title}, dibuat sesuai seleramu. Setiap lapisan adalah bagian dari ritualmu.`;
 $('#customer-reaction').hidden=!rating;$('#finish-dialog').classList.toggle('has-rating',!!rating);$('#recipe-summary').open=!rating;
 if(rating){
  $('#customer-reaction').dataset.mood=rating.mood;
  $('#reaction-customer').textContent=rating.customer.name;$('#reaction-tagline').textContent=rating.customer.tagline;$('#reaction-label').textContent=rating.label;renderCustomerPortrait($('#reaction-avatar'),rating.customer,rating.mood);
  $('#rating-stars').setAttribute('aria-label',`${rating.stars} dari 5 bintang`);
  $('#rating-stars').replaceChildren(...Array.from({length:5},(_,i)=>{const star=document.createElement('span');star.textContent=i<rating.stars?'★':'☆';star.className=i<rating.stars?'earned':'';star.setAttribute('aria-hidden','true');star.style.setProperty('--star-index',i);return star;}));
  $('#rating-score').textContent=`${rating.stars}/5 · ${rating.score}% cocok`;
  $('#customer-quote').textContent=`“${rating.quote}”`;$('#customer-tip').textContent=rating.tip;

 }
 const sequence=g.powder>0&&g.milk>0?(g.first==='milk'?'Susu → matcha':'Matcha → susu'):g.powder>0?'Matcha di gelas':'Susu di gelas';
 const labels=[title,sequence,g.ice?`${g.ice} es batu`:state.temperature==='hot'?'Hangat · tanpa es':'Belum ada es'];
 $('#finish-details').replaceChildren(...labels.map(t=>{const span=document.createElement('span');span.textContent=t;return span;}));
 const ingredients=[['Matcha',`${g.powder} sendok / ${Math.round(g.water)} ml air`],['Susu',g.milk>0?milkDescription(g):'0 ml'],['Krim cloud',`${Math.round(g.cream)} ml`],['Total cairan',`${Math.round(volume(g))} ml`]];
 $('#recipe-details').replaceChildren(...ingredients.map(([label,value])=>{const item=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;item.append(dt,dd);return item;}));
 $('#challenge-feedback').hidden=mode!=='challenge';$('#challenge-feedback').replaceChildren(...checks.map(c=>{const li=document.createElement('li');li.className=c.ok?'matched':'';li.textContent=`${c.ok?'✓':'○'} ${c.label} · ${c.ok?c.weight:0}/${c.weight}`;return li;}));
 if(mode==='challenge'&&success){const li=document.createElement('li');li.textContent=challenge.complete?'Semua 10 pesanan selesai. Terima kasih, barista!':'Pesanan sesuai. Siap untuk pelanggan berikutnya.';$('#challenge-feedback').append(li);}
 $('#next-order').hidden=mode!=='challenge'||!success;$('#next-order').textContent=challenge.complete?'Lihat rangkuman ↗':'Pelanggan berikutnya ↗';
 $('#another').textContent=mode==='challenge'?'Ulangi pesanan · 3 menit':'Buat Ulang';
 $('#another').hidden=mode==='challenge'&&success;
 $('#finish-time').hidden=mode!=='challenge';
 $('.finish-visual>span').textContent=title;
 $('.finish-visual').setAttribute('aria-label',`Gelas latte 3D: ${labels.join(', ')}, ${Math.round(volume(g))} ml.`);
 $('#studio').classList.add('result-active');$('#object-label').hidden=true;studio.showResult();refresh();syncChallenge();if(mode==='challenge'&&challenge.status==='expired')return;if(!$('#finish-dialog').open)$('#finish-dialog').showModal();$('#finish-dialog').scrollTop=0;$('.finish-close').focus({preventScroll:true});
}
$('#finish-dialog').addEventListener('close',()=>{$('#studio').classList.remove('result-active');studio.hideResult();});

function stop(){holding=false;autoDose=null;pointerSession=null;state.manualWhisk=false;}
function use(){
 if(audioStarted&&!soundscape.enabled)void unlockAudio();else soundscape.resume();
 if(!canInteract())return;if(studio.busy)return;orderPeek.close();$('#served-note').hidden=true;lastPresentation=null;if(state.served){showFinish();return;}
 readoutKey=['powder','sieve','water','whisk'].includes(selected)?'bowl':'glass';readoutUntil=performance.now()+2500;
 clearHover(true);
 if(selected==='sieve'){
  if(state.powder>=8){toast('Chawan sudah cukup pekat. Tambahkan air.');return;}
  studio.startAction('sieve',()=>{state.powder++;state.foam=Math.max(0,state.foam-.07);refresh();});return;
 }
 if(selected==='transfer'){
  if(state.water<5||state.powder<1){toast('Siapkan matcha dan air di chawan terlebih dahulu.');return;}
  if(state.water>space(state.glass)){toast('Gelas tidak cukup untuk isi chawan. Buat ulang dengan takaran lebih sedikit.');return;}
  if(state.glass.cream){toast('Cloud adalah lapisan terakhir. Racik ulang untuk mengganti lapisan.');return;}
  studio.startAction('serve',()=>{transfer(state);refresh();toast('Matcha sudah di gelas. Lengkapi latte atau sajikan.');});return;
 }
 if(selected==='ice'){
  if(addIce(state)){studio.startAction('ice');refresh();}else toast('Sisakan ruang untuk 3 es batu. Maksimal 12 es dalam gelas.');return;
 }
 if(selected==='cloud'){
  if(addCloud(state)){studio.startAction('cloud');refresh();}else toast('Tuang matcha dan susu terlebih dahulu. Sisakan ruang untuk cloud.');return;
 }
 if(selected==='whisk'&&(state.water<5||state.powder<1)){toast('Tambahkan matcha dan air ke chawan sebelum mengocok.');return;}
 if(selected==='water'&&state.water>=180){toast('Chawan penuh. Tuang matcha ke gelas.');return;}
 if(selected==='milk'&&(space(state.glass)<1||state.glass.cream)){toast(state.glass.cream?'Cloud adalah lapisan terakhir.':'Gelas sudah penuh.');return;}
 holding=true;
}
$('#begin').addEventListener('click',()=>setMode('free'));$('#begin-challenge').addEventListener('click',()=>setMode('challenge'));
$('#another').addEventListener('click',retryOrder);
$('#next-order').addEventListener('click',()=>{if(challenge.complete)showRecap();else if(challenge.next())begin();});
$('#recap-replay').addEventListener('click',()=>setMode('challenge'));
$('#reset').addEventListener('click',()=>{retryOrder();toast(mode==='challenge'?'Pesanan diulang. Waktumu kembali 3 menit.':'Meja siap untuk racikan baru.');});
function serveDrink(){
 if(pendingPresentation||!canInteract()||document.querySelector('dialog[open]'))return;stop();
 if(state.served){showFinish(lastPresentation);return;}if(studio.busy)return;
 if(!canServe(state)){readoutKey='glass';readoutUntil=performance.now()+2200;toast('Tuangkan matcha dari chawan ke gelas terlebih dahulu.');return;}
 orderPeek.close();
 const rating=mode==='challenge'?rateOrder(state,ORDERS[challenge.round]):null,success=rating?rating.perfect:true;
 if(mode==='challenge'&&!challenge.beginPresentation(success,rating)){syncChallenge();return;}
 const presentation={rating,success};pendingPresentation=presentation;$('#served-note').hidden=true;setAtmospherePanel(false);tableGesture.cancel();clearHover(true);setAudioPanel(false);soundscape.silence();
 clearTimeout(toastTimer);$('#toast').classList.remove('show');$('#active-measure').hidden=true;$('#studio').classList.add('presenting');$('#help').disabled=true;
 $('#delivery-note').dataset.phase='travelling';$('#delivery-stars').hidden=true;$('#delivery-eyebrow').textContent='DARI MEJA KECILMU';
 $('#delivery-avatar').hidden=!rating;if(rating)renderCustomerPortrait($('#delivery-avatar'),rating.customer);
 $('#delivery-title').textContent=rating?`Secangkir untuk ${rating.customer.name}`:'Satu jeda untuk dirimu';
 $('#delivery-description').textContent=rating?'Gelasmu sedang diantar. Nikmati jeda kecil ini.':'Racikanmu siap dinikmati, pelan-pelan.';$('#delivery-note').hidden=false;
 presentationFlow.start({reducedMotion:reducedMotion.matches,
  onReaction(){
   if(pendingPresentation!==presentation)return;
   $('#delivery-note').dataset.phase='reaction';$('#delivery-eyebrow').textContent=rating?'SETEGUK, LALU SENYUM':'WAKTUNYA MENIKMATI';
   $('#delivery-title').textContent=rating?rating.customer.name:'Matcha-mu telah jadi!';
   $('#delivery-description').textContent=rating?`“${rating.quote}”`:'Racikanmu siap. Nikmati perlahan, sejenak untuk dirimu.';
   if(rating){renderCustomerPortrait($('#delivery-avatar'),rating.customer,rating.mood);$('#delivery-stars').textContent='★'.repeat(rating.stars)+'☆'.repeat(5-rating.stars);$('#delivery-stars').setAttribute('aria-label',`${rating.stars} dari 5 bintang`);$('#delivery-stars').hidden=false;}
  },
  onReturn(){
   if(pendingPresentation!==presentation)return;
   $('#delivery-note').hidden=true;studio.releaseDeliveryFocus();if(!success)studio.returnDelivery();
  },
  onComplete(){
   if(pendingPresentation!==presentation)return;
   clearPresentation();if(mode==='challenge')challenge.finishPresentation();state.served=success;lastPresentation=presentation;
   $('#served-caption').textContent=rating?`${rating.customer.name} · ${'★'.repeat(rating.stars)}${'☆'.repeat(5-rating.stars)}`:'Matcha-mu telah jadi!';
   $('#served-next').textContent=mode==='challenge'?(success?(challenge.complete?'Lihat rangkuman ↗':'Pelanggan berikutnya ↗'):'Lanjut meracik'):'Buat Ulang';
   $('#served-note').hidden=false;refresh();syncChallenge();
  }
 });
 studio.startDelivery(()=>presentationFlow.arrive());
}

$('#submit-drink').addEventListener('click',serveDrink);
$('#served-detail').addEventListener('click',()=>showFinish(lastPresentation));
$('#served-next').addEventListener('click',()=>{if(mode==='challenge'){if(state.served){if(challenge.complete)showRecap();else if(challenge.next())begin();}else $('#served-note').hidden=true;}else retryOrder();});
document.querySelectorAll('[data-main-menu]').forEach(b=>b.addEventListener('click',mainMenu));
$('#retry-order').addEventListener('click',retryOrder);
$('#timeout-dialog').addEventListener('cancel',e=>e.preventDefault());

const label=$('#object-label');
const objectLabels={
 powder:'Matcha · ambil & ayak 1 sendok',scoop:'Sendok & ayakan · ambil & ayak 1 sendok',sieve:'Sendok & ayakan · ambil & ayak 1 sendok',
 water:'Teko · klik 30 ml / tahan untuk menuang',whisk:'Chasen · klik atau tahan untuk mengocok',holder:'Dudukan chasen · kocok matcha',
 'milk-fresh':'Fresh Milk · klik 40 ml / tahan untuk menuang','milk-almond':'Almond Milk · klik 40 ml / tahan untuk menuang','milk-oat':'Oat Milk · klik 40 ml / tahan untuk menuang',
 bowl:'Chawan · tuang matcha ke gelas',glass:'Gelas · sajikan racikan',ice:'Es & penjepit · tambah 3 es',cloud:'Krim · tambah cloud',tray:'Baki · kembali ke pandangan meja'
};
const objectButtons={};
for(const [key,text]of Object.entries(objectLabels)){
 const b=document.createElement('button');b.type='button';b.className='object-target';b.dataset.object=key;b.setAttribute('aria-label',text);b.setAttribute('aria-describedby','object-label');
 b.addEventListener('focus',()=>{hoverPointer=null;if(!studio.busy&&!holding)studio.focusObject(key);});b.addEventListener('blur',()=>clearHover());
 b.addEventListener('click',e=>{if(e.detail===0)activateObject(key,true);});
 $('#object-controls').append(b);objectButtons[key]=b;
}
const doseValue=()=>selected==='water'?state.water:selected==='milk'?state.glass.milk:state.foam;
function beginDose(from){autoDose={key:selected,target:from+(selected==='water'?30:selected==='milk'?40:.30)};}
function activateObject(hit,automatic=false){
 if(!canInteract()||studio.busy||document.querySelector('dialog[open]'))return;
 orderPeek.close();
 if(hit==='tray'){stop();studio.resetView();label.hidden=true;return;}
 if(hit==='glass'){serveDrink();return;}
 const key=toolForObject(hit);if(!toolOrder.includes(key))return;
 if(holding&&selected===key&&(key!=='milk'||hit===`milk-${state.selectedMilk}`)){stop();refresh();return;}
 select(key);if(key==='milk')state.selectedMilk=hit.slice(5);
 const from=doseValue();use();if(automatic&&holding)beginDose(from);
 return from;
}
function clearHover(immediate=false){hoverPointer=null;hoveredObject=null;canvas.style.cursor='default';$('#object-label').hidden=true;studio.setHover(null,immediate);}
function vesselDetails(hit){
 if(hit==='bowl')return {
  caption:state.powder===0&&state.water===0?'Masih kosong':'Racikan di chawan',
  rows:[['Matcha',`${state.powder} sendok`],['Air',`${Math.round(state.water)} ml`],['Busa',`${Math.round(state.foam*100)}%`]]
 };
 if(hit!=='glass')return null;
 const g=state.glass,milks=Object.entries(g.milkParts||{}).filter(([,ml])=>ml>0);
 const milkRows=milks.length?milks.map(([type,ml])=>[milkName(type),`${Math.round(ml)} ml`]):[[g.milk>0?milkName(g.milkType):'Susu',`${Math.round(g.milk)} ml`]];
 const free=space(g),used=GLASS_CAPACITY_ML-free;
 return {
  caption:`${state.temperature==='hot'?'Hot':'Ice'}${volume(g)===0&&g.ice===0?' · masih kosong':''}`,
  rows:[['Matcha',`${g.powder} sendok · ${Math.round(g.water)} ml air`],...milkRows,['Busa matcha',`${Math.round(g.foam*100)}%`],['Es batu',`${g.ice} buah`],['Cloud',`${Math.round(g.cream)} ml`],['Total cairan',`${Math.round(volume(g))} ml`]],
  capacity:{used,free}
 };
}
function showObjectLabel(hit,targets){
 const p=targets[hit];label.hidden=!p;if(!p)return;
 const details=vesselDetails(hit),signature=JSON.stringify([hit,details,state.served]);
 if(label.dataset.signature!==signature){
  const [name,action]=objectLabels[hit].split(' · '),title=document.createElement('strong'),description=document.createElement('span');
  title.textContent=name;description.textContent=details?(state.served?'Klik untuk melihat hasil':hit==='bowl'?'Klik untuk menuang matcha ke gelas':'Klik untuk menyajikan racikan'):action;
  label.replaceChildren(title);label.classList.toggle('has-measures',!!details);label.dataset.object=hit;label.dataset.signature=signature;
  if(details){
   const caption=document.createElement('span'),list=document.createElement('dl');caption.className='vessel-caption';caption.textContent=details.caption;list.className='vessel-measures';
   for(const [name,value]of details.rows){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;row.append(dt,dd);list.append(row);}
   label.append(caption,list);description.className='vessel-action';
   if(details.capacity){
    const {used,free}=details.capacity,capacity=document.createElement('div'),note=document.createElement('span'),track=document.createElement('div'),fill=document.createElement('i'),remaining=document.createElement('span');
    capacity.className='vessel-capacity';note.textContent=`Terpakai ${Math.round(used)} / ${GLASS_CAPACITY_ML} ml · termasuk es`;
    track.className='vessel-capacity-track';track.setAttribute('role','meter');track.setAttribute('aria-label','Kapasitas gelas termasuk es');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(GLASS_CAPACITY_ML));track.setAttribute('aria-valuenow',String(Math.round(used)));fill.style.width=`${used/GLASS_CAPACITY_ML*100}%`;track.append(fill);
    remaining.textContent=`Sisa ruang ${Math.round(free)} ml`;capacity.append(note,track,remaining);label.append(capacity);
   }
  }
  label.append(description);
 }
 const rect=canvas.getBoundingClientRect(),w=label.offsetWidth,h=label.offsetHeight;
 const right=rect.left+p.x+p.width/2+15,left=rect.left+p.x-p.width/2-w-15;
 const x=right+w<=innerWidth-12?right:left>=12?left:rect.left+p.x-w/2;
 const y=right+w>innerWidth-12&&left<12?rect.top+p.y-p.height/2-h-14:rect.top+p.y-h/2;
 label.style.left=`${Math.max(12,Math.min(innerWidth-w-12,x))}px`;
 label.style.top=`${Math.max(74,Math.min(innerHeight-h-14,y))}px`;
}
canvas.addEventListener('pointermove',e=>{
 if(!mode||challenge.status==='expired'){clearHover();return;}
 if(holding&&selected==='whisk'&&state.manualWhisk){state.whiskX=Math.max(-.25,Math.min(.25,(e.clientX-state.dragOriginX)*.006));state.whiskZ=Math.max(-.18,Math.min(.18,(e.clientY-state.dragOriginY)*.006));}
 if(tableGesture.active){tableGesture.move(e.pointerId,e.clientX,e.clientY);return;}
 if(e.pointerType==='touch')return;
 hoverPointer={x:e.clientX,y:e.clientY};
});
canvas.addEventListener('pointerleave',()=>clearHover());
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||e.isPrimary===false||!canInteract()||studio.busy)return;orderPeek.close();updateOrderPanel();const hit=studio.pick(e.clientX,e.clientY);
 if(mobileView.matches){
  if(holding)return;e.preventDefault();clearHover(true);if(document.activeElement?.classList.contains('object-target'))document.activeElement.blur();
  tableGesture.start({id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),hit,holdable:['water','milk','whisk'].includes(hit?toolForObject(hit):null)});canvas.setPointerCapture(e.pointerId);return;
 }
 if(!hit)return;
 e.preventDefault();if(document.activeElement?.classList.contains('object-target'))document.activeElement.blur();const from=activateObject(hit);label.hidden=true;hoverPointer=e.pointerType==='touch'?null:{x:e.clientX,y:e.clientY};
 if(holding){pointerSession={id:e.pointerId,time:performance.now(),from};if(selected==='whisk'){state.manualWhisk=true;state.dragOriginX=e.clientX;state.dragOriginY=e.clientY;state.whiskX=state.whiskZ=0;}canvas.setPointerCapture(e.pointerId);}
});
window.addEventListener('pointerup',e=>{
 if(tableGesture.active&&e.pointerId===tableGesture.id){tableGesture.end(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);refresh();return;}
 if(!pointerSession||e.pointerId!==pointerSession.id)return;const session=pointerSession;pointerSession=null;state.manualWhisk=false;
 if(holding&&performance.now()-session.time<260)beginDose(session.from);else stop();refresh();
});
canvas.addEventListener('pointercancel',()=>{tableGesture.cancel();stop();});canvas.addEventListener('lostpointercapture',()=>{tableGesture.cancel();if(pointerSession)stop();});
window.addEventListener('blur',()=>{pageFocused=false;tableGesture.cancel();stop();clearHover(true);soundscape.pause();studio.drainIceSounds();});window.addEventListener('focus',()=>{pageFocused=true;syncChallenge();soundscape.resume();});document.addEventListener('visibilitychange',()=>{if(document.hidden){tableGesture.cancel();stop();clearHover(true);soundscape.pause();studio.drainIceSounds();}});
function updateObjectUI(){
 updateOrderPanel();
 const working=studio.busy||holding,justFinished=wasWorking&&!working;if(justFinished)readoutUntil=performance.now()+2200;wasWorking=working;
 $('#studio').classList.toggle('working',working||performance.now()<readoutUntil);
 const unavailable=!mode||!state.started||!!document.querySelector('dialog[open]')||!!pendingPresentation||studio.delivering,blocked=unavailable||state.served,targets=studio.screenTargets();
 for(const [key,b]of Object.entries(objectButtons)){
  const p=targets[key];if(!p)continue;b.style.left=`${p.x}px`;b.style.top=`${p.y}px`;b.style.width=`${Math.max(30,p.width)}px`;b.style.height=`${Math.max(30,p.height)}px`;b.disabled=unavailable||(state.served&&!['bowl','glass'].includes(key));b.setAttribute('aria-label',state.served&&['bowl','glass'].includes(key)?`${key==='bowl'?'Chawan':'Gelas'} · lihat hasil racikan`:objectLabels[key]);
 }
 for(const b of $('#mobile-view').querySelectorAll('button'))b.disabled=working||unavailable;
 const hoverBlocked=orderPeek.visible||tableGesture.active||unavailable||working||!pageFocused||document.hidden||!$('#audio-panel').hidden||!$('#atmosphere-panel').hidden;
 const focusKey=document.activeElement?.classList.contains('object-target')?document.activeElement.dataset.object:null;
 const candidate=hoverBlocked?null:hoverPointer?studio.pick(hoverPointer.x,hoverPointer.y):focusKey;
 const hit=state.served&&!['bowl','glass'].includes(candidate)?null:candidate;
 if(hit!==hoveredObject){hoveredObject=hit;studio.setHover(hit,hoverBlocked);}
 if(hoverBlocked)studio.setHover(null,true);
 canvas.style.cursor=hit?'pointer':'default';
 if(hit)showObjectLabel(hit,targets);else label.hidden=true;
 const action=$('#workbench'),glass=targets.glass,button=$('#submit-drink');
 const position=servingButtonPosition(glass,canvas.clientWidth,canvas.clientHeight,button.offsetWidth||98,button.offsetHeight||42);
 action.hidden=unavailable||working||orderPeek.visible||tableGesture.active||!canServe(state)||!position;
 if(!action.hidden){action.style.left=`${position.x}px`;action.style.top=`${position.y}px`;}
 const readout=$('#active-measure');readout.hidden=blocked||['bowl','glass'].includes(hit)||!(holding||studio.busy||performance.now()<readoutUntil);
 if(!readout.hidden){
  const g=state.glass,p=targets[readoutKey],text=readoutKey==='bowl'?`Chawan · ${state.powder} sendok · ${Math.round(state.water)} ml air · busa ${Math.round(state.foam*100)}%`:`${g.milk>0?milkDescription(g)+' · ':''}${Math.round(volume(g))} / 450 ml · ${g.ice} es${g.cream?' · cloud':''}`;
  if(readout.textContent!==text)readout.textContent=text;if(justFinished)$('#measure-announcement').textContent=text;const half=Math.min(215,innerWidth/2-14);readout.style.left=`${Math.max(half+14,Math.min(innerWidth-half-14,p.x))}px`;readout.style.top=`${Math.min(innerHeight-40,p.y+p.height/2+26)}px`;
 }
}
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!studio.delivering)studio.setZoom(-e.deltaY*.0008);},{passive:false});
function updateOrderPanel(){
 const available=mode==='challenge'&&state.started&&!document.querySelector('dialog[open]');
 $('#order-chip').hidden=!available;$('#order-open').hidden=!available;$('#order-open').disabled=!!pendingPresentation;
 const show=available&&!pendingPresentation&&orderPeek.visible;
 $('#order-card').hidden=!show;$('#order-open').setAttribute('aria-expanded',String(show));
 if(available){const text=`Pesanan ${customerForOrder(ORDERS[challenge.round]).name} · sisa ${formatRemaining(challenge.tick())}`;$('#order-open').setAttribute('aria-label',text);$('#order-open').title=text;$('#order-open').classList.toggle('time-low',challenge.tick()<=30000);}
}
$('#order-open').addEventListener('click',()=>{setAtmospherePanel(false);stop();setAudioPanel(false);clearHover(true);if(orderPeek.visible)orderPeek.close();else orderPeek.open();updateOrderPanel();});
$('#order-toggle').addEventListener('click',()=>{orderPeek.close();updateOrderPanel();$('#order-open').focus({preventScroll:true});});
$('#order-card').addEventListener('pointerdown',()=>orderPeek.open());
$('#order-card').addEventListener('keydown',()=>orderPeek.open());

$('#pan-left').addEventListener('click',()=>{if(!studio.busy&&!holding)studio.stepTable(-1);});
$('#pan-right').addEventListener('click',()=>{if(!studio.busy&&!holding)studio.stepTable(1);});
$('#pan-home').addEventListener('click',()=>{if(!studio.busy&&!holding)studio.resetView();});
$('#zoom-in').addEventListener('click',()=>{if(!studio.delivering)studio.setZoom(.15);});$('#zoom-out').addEventListener('click',()=>{if(!studio.delivering)studio.setZoom(-.15);});
document.addEventListener('keydown',e=>{if(!mode||studio.delivering||document.querySelector('dialog[open]')||!$('#audio-panel').hidden||!$('#atmosphere-panel').hidden||!canInteract())return;if(e.code.startsWith('Digit')){const n=Number(e.code.slice(5));if(n>=1&&n<=8){select(toolOrder[n-1]);}}if(e.code==='Space'&&!e.repeat){if(document.activeElement?.tagName==='BUTTON')return;e.preventDefault();use();}if(e.code==='Escape'){stop();label.hidden=true;if(orderPeek.visible){orderPeek.close();updateOrderPanel();$('#order-open').focus({preventScroll:true});}}});document.addEventListener('keyup',e=>{if(e.code==='Space')stop();});
$('#help').addEventListener('click',()=>{setAtmospherePanel(false);orderPeek.close();stop();soundscape.silence();$('#help-dialog').showModal();});
document.querySelectorAll('.dialog-close,.dialog-done').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
function channelOn(kind){return !audioPrefs[kind+'Muted']&&audioPrefs[kind+'Volume']>0;}
function applyAudioMix(){soundscape.setMusicVolume(channelOn('music')?audioPrefs.musicVolume:0);soundscape.setEffectsVolume(channelOn('effects')?audioPrefs.effectsVolume:0);soundscape.setAmbienceVolume(channelOn('ambience')?audioPrefs.ambienceVolume:0);}
function renderAudioSettings(){
 for(const kind of AUDIO_KINDS){
  const pct=Math.round(audioPrefs[kind+'Volume']*100),on=channelOn(kind);
  $('#'+kind+'-volume').value=String(pct);$('#'+kind+'-volume').setAttribute('aria-valuetext',pct+' persen');$('#'+kind+'-volume-value').textContent=pct+'%';
  $('#'+kind+'-toggle').setAttribute('aria-pressed',String(on));$('#'+kind+'-toggle').setAttribute('aria-label',(on?'Matikan ':'Nyalakan ')+({music:'musik',effects:'efek suara',ambience:'ambience'}[kind]));
 }
 const any=AUDIO_KINDS.some(channelOn),audible=audioStarted&&soundscape.enabled&&any;
 $('#audio-mute-all').textContent=any?'Senyapkan semua':'Pulihkan suara';$('#sound').dataset.audioActive=String(audible);
 $('#sound').innerHTML=audible?'<svg viewBox="0 0 24 24"><path d="m11 5-6 4H2v6h3l6 4V5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>':'<svg viewBox="0 0 24 24"><path d="m11 5-6 4H2v6h3l6 4V5ZM16 9l5 6m0-6-5 6"/></svg>';
}
async function unlockAudio(){
 audioStarted=true;applyAudioMix();const request=++audioRequest;
 const wanted=AUDIO_KINDS.some(channelOn),ready=await soundscape.setEnabled(wanted);
 if(request!==audioRequest)return ready;
 renderAudioSettings();if(wanted&&!ready)toast('Suara belum tersedia. Kamu tetap bisa meracik dengan tenang.');return ready;
}
function saveAudioMix(){audioPrefs=saveAudioPreferences(audioStorage,audioPrefs);applyAudioMix();renderAudioSettings();void unlockAudio();}
function setAudioPanel(open,restoreFocus=false){if(open){setAtmospherePanel(false);orderPeek.close();}$('#audio-panel').hidden=!open;$('#sound').setAttribute('aria-expanded',String(open));if(!open&&restoreFocus)$('#sound').focus({preventScroll:true});}
$('#sound').addEventListener('click',()=>setAudioPanel($('#audio-panel').hidden));
$('#audio-close').addEventListener('click',()=>setAudioPanel(false,true));
document.addEventListener('pointerdown',e=>{if(!$('#audio-panel').hidden&&!$('#audio-panel').contains(e.target)&&!$('#sound').contains(e.target))setAudioPanel(false);});
document.addEventListener('keydown',e=>{if(e.code==='Escape'&&!$('#audio-panel').hidden){e.preventDefault();setAudioPanel(false,true);}});
for(const kind of AUDIO_KINDS){
 $('#'+kind+'-volume').addEventListener('input',e=>{audioRestore=null;audioPrefs[kind+'Volume']=Number(e.target.value)/100;audioPrefs[kind+'Muted']=false;saveAudioMix();});
 $('#'+kind+'-toggle').addEventListener('click',()=>{audioRestore=null;const on=channelOn(kind);audioPrefs[kind+'Muted']=on;if(!on&&audioPrefs[kind+'Volume']===0)audioPrefs[kind+'Volume']=DEFAULT_AUDIO[kind+'Volume'];saveAudioMix();});
}
$('#audio-mute-all').addEventListener('click',()=>{if(AUDIO_KINDS.some(channelOn)){audioRestore={...audioPrefs};for(const kind of AUDIO_KINDS)audioPrefs[kind+'Muted']=true;}else if(audioRestore){audioPrefs=normalizeAudioPreferences(audioRestore);audioRestore=null;}else{for(const kind of AUDIO_KINDS)audioPrefs[kind+'Muted']=false;for(const kind of AUDIO_KINDS)if(audioPrefs[kind+'Volume']===0)audioPrefs[kind+'Volume']=DEFAULT_AUDIO[kind+'Volume'];}saveAudioMix();});
applyAudioMix();renderAudioSettings();


function setAtmospherePanel(open,restoreFocus=false){
 if(open){stop();clearHover(true);orderPeek.close();setAudioPanel(false);}
 $('#atmosphere-panel').hidden=!open;$('#atmosphere-open').setAttribute('aria-expanded',String(open));
 if(!open&&restoreFocus)$('#atmosphere-open').focus({preventScroll:true});
}
function applyAtmosphere(key){
 atmosphereKey=key;studio.setAtmosphere(key);soundscape.setAtmosphere(key);$('#ambience-description').textContent=AMBIENCE_LABELS[key];saveAtmosphere(audioStorage,key);
 document.querySelectorAll('[data-atmosphere]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.atmosphere===key)));
 const mood=ATMOSPHERES[key];$('#menu-atmosphere').textContent=`${mood.icon} ${mood.label} · ganti suasana`;$('#atmosphere-open').title=`Suasana kedai · ${mood.label}`;
 $('#studio').dataset.atmosphere=key;
}
$('#atmosphere-open').addEventListener('click',()=>setAtmospherePanel($('#atmosphere-panel').hidden));
$('#menu-atmosphere').addEventListener('click',()=>setAtmospherePanel(true));
$('#atmosphere-close').addEventListener('click',()=>setAtmospherePanel(false,true));
document.querySelectorAll('[data-atmosphere]').forEach(button=>button.addEventListener('click',()=>{applyAtmosphere(button.dataset.atmosphere);void unlockAudio();}));
document.addEventListener('pointerdown',e=>{if(!$('#atmosphere-panel').hidden&&!$('#atmosphere-panel').contains(e.target)&&!$('#atmosphere-open').contains(e.target)&&!$('#menu-atmosphere').contains(e.target))setAtmospherePanel(false);});
document.addEventListener('keydown',e=>{if(e.code==='Escape'&&!$('#atmosphere-panel').hidden){e.preventDefault();setAtmospherePanel(false,true);}});
applyAtmosphere(atmosphereKey);

let refreshClock=0;
function frame(ms){syncChallenge();tableGesture.advance(ms);const dt=Math.min((ms-last)/1000,.05);last=ms;elapsed+=dt;presentationFlow.advance(dt,{active:!document.hidden});orderPeek.advance(dt,{paused:document.hidden||$('#order-card').contains(document.activeElement)||!!document.querySelector('dialog[open]')});if(holding){
 const remaining=autoDose?Math.max(0,autoDose.target-doseValue()):Infinity;
 if(selected==='water'){state.water=Math.min(state.water+Math.min(dt*PREPARATION_RATE.water*studio.pourRate,remaining),180);if(state.water>=180)stop();}
 else if(selected==='milk'){addMilk(state,Math.min(dt*PREPARATION_RATE.milk*studio.pourRate,remaining));if(space(state.glass)<.1)stop();}
 else if(selected==='whisk')state.foam=Math.min(1,state.foam+Math.min(dt*PREPARATION_RATE.foam*studio.whiskRate,remaining));
 if(autoDose&&(doseValue()>=autoDose.target-.0001||(selected==='whisk'&&state.foam>=1))){stop();refresh();}
 refreshClock+=dt;if(refreshClock>.1){refresh();refreshClock=0;}
 }studio.animate(dt,elapsed,state,holding,selected);updateObjectUI();soundscape.update(studio.audioState,{active:pageFocused&&!document.hidden&&!document.querySelector('dialog[open]'),musicActive:pageFocused&&!document.hidden,ambienceActive:pageFocused&&!document.hidden,iceEvents:studio.drainIceSounds()});requestAnimationFrame(frame);}
$('#order-card details').open=true;
refresh();requestAnimationFrame(frame);requestAnimationFrame(()=>{requestAnimationFrame(()=>{$('#loading').style.opacity='0';setTimeout(()=>$('#loading').hidden=true,550);});});
