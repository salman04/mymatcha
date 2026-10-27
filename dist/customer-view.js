// Small, shared portraits keep a visitor recognisable from order to reaction.
const NS='http://www.w3.org/2000/svg';
export function renderCustomerPortrait(container,customer,mood='happy'){
 const doc=container.ownerDocument,svg=doc.createElementNS(NS,'svg');
 svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('aria-hidden','true');svg.classList.add('visitor-portrait');
 const add=(tag,attrs)=>{const node=doc.createElementNS(NS,tag);for(const[key,value]of Object.entries(attrs))node.setAttribute(key,value);svg.append(node);return node;};
 const avatar=customer?.avatar||{},hair=avatar.hair||'#584d3a',shirt=avatar.shirt||'#94a37a';
 add('circle',{cx:32,cy:32,r:31,fill:'#eee9dc'});
 add('circle',{cx:32,cy:32,r:31,fill:customer?.color||'#9da981',opacity:'.14'});
 if(avatar.style==='bun')add('circle',{cx:35,cy:10,r:8,fill:hair});
 add('path',{d:avatar.style==='bob'?'M15 30V24c0-22 34-22 34 0v23H15Z':'M16 32V23c0-20 32-20 32 0v11Z',fill:hair});
 add('path',{d:'M11 64v-8c0-15 42-15 42 0v8',fill:shirt});
 add('path',{d:'M27 43v7q5 5 10 0v-7',fill:'#e4c5a6'});
 add('ellipse',{cx:32,cy:30,rx:14,ry:17,fill:'#efd6b8'});
 add('path',{d:avatar.style==='short'?'M18 26c-1-20 29-21 29-1-8 0-13-4-16-10-2 5-7 9-13 11Z':'M18 25c2-18 27-18 29 0-7 0-12-4-14-8-3 5-8 8-15 8Z',fill:hair});
 for(const cx of[22,42])add('ellipse',{cx,cy:35,rx:3,ry:1.5,fill:'#d89f88',opacity:'.65'});
 const line={fill:'none',stroke:'#5a493b','stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round'};
 add('path',{...line,d:mood==='delighted'?'M22 30q3-4 6 0m8 0q3-4 6 0':'M24 29v2m16-2v2'});
 const mouths={delighted:'M25 36q7 10 14 0Z',happy:'M26 37q6 6 12 0',hopeful:'M27 38q5 3 10 0',curious:'M28 38q4-2 8 0',patient:'M28 38h8'};
 add('path',{...line,d:mouths[mood]||mouths.happy,...(mood==='delighted'?{fill:'#bc8772'}:{})});
 if(avatar.accessory==='glasses'){
  for(const cx of[24,40])add('circle',{...line,cx,cy:30,r:6,'stroke-width':1.1});
  add('path',{...line,d:'M30 30h4M18 29l-3-1m31 1 3-1','stroke-width':1.1});
 }
 if(avatar.accessory==='scarf')add('path',{d:'M21 47q11 8 22 0l-1 6H31l7 11h-9l-5-11Z',fill:customer.color});
 container.replaceChildren(svg);
}
