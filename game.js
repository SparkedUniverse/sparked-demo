/* SPARKED · SIGNAL RUN
   Pseudo-3D road engine (segment projection) + the original garage / route / HUD flow.
   - The road is drawn on <canvas id="world">, so the car really travels forward.
   - Your painted route art is used as the parallax skyline behind the road.
   - Each route has its own layout, scenery, tunnels, gates and traffic. */
(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const easeIn=(a,b,p)=>a+(b-a)*p*p,easeInOut=(a,b,p)=>a+(b-a)*(-Math.cos(p*Math.PI)/2+.5);
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ------------------------------------------------------------------ DATA */
const drivers=[['IZZY MONROE','IM','CURRENT RUNNER','ROUTE CURRENT','Finds the clearest way through the blackout.'],['AALIYAH GAIN','AG','VELOCITY','ACCELERATE','Turns every open street into an advantage.'],['THEO REED','TR','POWER LINE','BREAKAWAY','Keeps the rescue run moving forward.'],['JORDAN KIM','JK','SIGNAL TECH','OVERRIDE','Reads the city faster than it can close in.'],['MATEO RIVERA','MR','STREETWISE','SHORTCUT','Knows which streets still lead home.']];
const cars=[['VOLT GT','#50e7ed',184,'Twin-turbo street coupé'],['NIGHTFALL R','#a47aff',176,'Low-slung grand tourer'],['SUNFIRE ZX','#ff5b9e',191,'Lightweight sport compact'],['RIVET 4X','#ffbd4d',171,'All-weather rally machine']];
const routes=[['LAKEFRONT ESCAPE','Aldermoor → Lakefront Safe Zone','lakefront','Two laps · wet boulevard · marina lights','./art2d/lakefront.png'],['CASINO CAUSEWAY','Founders Square → Salk Bingo and Casino','casino','Two laps · tunnel sweep · casino express','./art2d/casino.png'],['LAMBEAU NIGHT RUN','Lambeau High → Clearview','lambeau','Two laps · stadium hill · lake curve','./art2d/lambeau.png']];
const CAR_HUE=[0,68,-48,32];

const state={driver:0,car:0,route:0,mode:'menu',racing:false,started:false,paused:false,speed:0,boost:100,progress:0,time:0,checkpoint:0,passes:0,hit:0,keys:{}};

/* --------------------------------------------------------------- MENU UI */
function selectUI(){
 $('#drivers').innerHTML=drivers.map((d,i)=>`<button class="pick ${i===state.driver?'selected':''}" data-driver="${i}"><span class="tag">${d[2]}</span><span class="initial">${d[1]}</span><h3>${d[0]}</h3><p>${d[4]}</p><small class="ability">⚡ ${d[3]}</small></button>`).join('');
 $('#cars').innerHTML=cars.map((c,i)=>`<button class="pick car-pick ${i===state.car?'selected':''}" data-car="${i}" style="--car-hue:${CAR_HUE[i]}deg;--car-glow:${c[1]}"><img src="./art2d/volt-gt.png" alt="${c[0]}"><span class="tag">ORIGINAL 1999 SPORTS CAR</span><h3>${c[0]}</h3><p>${c[3]}</p><div class="stat">TOP ${c[2]} MPH<br>GRIP ${'▮'.repeat(3+i%2)}</div></button>`).join('');
 $('#routeCards').innerHTML=routes.map((r,i)=>`<button class="route-card ${i===state.route?'selected':''}" data-route="${i}" style="--route-img:url('${r[4]}')"><div><span class="tag">${r[3].toUpperCase()}</span><h3>${r[0]}</h3><p>${r[1]}</p><small>12 CHECKPOINTS · PASSENGER ABOARD FROM START</small></div></button>`).join('');
 $$('[data-driver]').forEach(b=>b.onclick=()=>{state.driver=+b.dataset.driver;selectUI()});
 $$('[data-car]').forEach(b=>b.onclick=()=>{state.car=+b.dataset.car;selectUI();setRoute()});
 $$('[data-route]').forEach(b=>b.onclick=()=>{state.route=+b.dataset.route;selectUI();previewRoute()});
}
function show(id){$$('.screen').forEach(x=>x.classList.remove('active'));if(id!=='none')$('#'+id).classList.add('active')}
window.sparkedShow=show;
document.addEventListener('click',event=>{let button=event.target.closest('[data-screen]');if(button){event.preventDefault();show(button.dataset.screen)}});

/* ---------------------------------------------------------- ENGINE SETUP */
const SEG=200,ROAD=1800,CAM_H=1050,FOV=92,BASE_MAX=12000,BARRIER=1.04,TUN_H=1900;
const camDepth=1/Math.tan(FOV/2*Math.PI/180);
const canvas=$('#world'),ctx=canvas.getContext('2d',{alpha:false});
let W=0,H=0,K=0,dpr=1,horizonY=0,farY=0,playerZ=0,DRAW=180;
function resize(){
 dpr=Math.min(devicePixelRatio||1,innerWidth>900?1.5:1.25);
 W=Math.max(2,Math.round(innerWidth*dpr));H=Math.max(2,Math.round(innerHeight*dpr));
 canvas.width=W;canvas.height=H;K=W/2;horizonY=Math.round(H*.44);
 DRAW=innerWidth<900?140:190;
 playerZ=camDepth*CAM_H*K/(H-horizonY)*1.06;
 farY=horizonY+camDepth/(DRAW*SEG)*CAM_H*K;
}
addEventListener('resize',resize);

const ART={};
for(const r of routes){const im=new Image();im.src=r[4];ART[r[2]]=im}

/* ---------------------------------------------------------------- THEMES */
const THEMES={
 lakefront:{seed:11,len:5200,crop:.56,bg:'#120d1c',fog:'70,34,96',haze:'255,150,100',
  road:['#232333','#2a2a3d'],landL:['#191120','#1f1526'],landR:['#1b1523','#211829'],waterR:['#17255a','#1d2f6c'],shoreR:2.5,glint:'rgba(255,170,120,.16)',
  barrier:['#78737f','#6b6675'],barrierLight:'#ffb44a',lamp:['lampL','lampR'],
  tunnels:[[.55,150]],hill:10,cmin:2,cmax:4.6,traffic:64,
  mix:[['sweep',4],['rise',3],['esses',2],['fast',1],['crest',1]]},
 casino:{seed:29,len:5600,crop:.57,bg:'#0e0a1e',fog:'60,26,96',haze:'255,110,190',
  road:['#211e30','#282539'],landL:['#160f2c','#1b1335'],landR:['#160f2c','#1b1335'],waterL:['#1a1048','#221660'],waterR:['#1a1048','#221660'],shoreL:1.95,shoreR:1.95,glint:'rgba(255,90,200,.18)',
  barrier:['#6d6480','#605875'],barrierLight:'#ff5fc4',lamp:['lampPL','lampPR'],
  tunnels:[[.2,260],[.57,330],[.82,190]],hill:6,cmin:1.5,cmax:4,traffic:74,
  mix:[['fast',4],['esses',3],['sweep',2],['rise',1],['tight',1]]},
 lambeau:{seed:47,len:5400,crop:.57,bg:'#0c1219',fog:'52,30,90',haze:'255,150,80',
  road:['#222330','#292a3a'],landL:['#0f1c22','#132430'],landR:['#101b24','#14232e'],waterR:['#191f52','#202868'],shoreR:3.5,glint:'rgba(255,200,120,.16)',
  barrier:['#75727c','#686571'],barrierLight:'#ffd070',lamp:['lampL','lampR'],
  tunnels:[[.7,150]],hill:20,cmin:3,cmax:5,traffic:68,
  mix:[['crest',4],['sweep',2],['tight',3],['esses',2],['rise',1]]}
};

/* --------------------------------------------------------------- SPRITES */
function mk(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);return c}
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function glow(g,x,y,r,rgb,a){const q=g.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,`rgba(${rgb},${a})`);q.addColorStop(.35,`rgba(${rgb},${a*.35})`);q.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}
const SPR={},POOL={},CARSPR=[];
function reg(name,img,w,h,extra){SPR[name]=Object.assign({img,w,h},extra)}
function lampImg(dir,rgb){return mk(320,800,(g,w,h)=>{
 if(dir<0){g.translate(w,0);g.scale(-1,1)}
 const cx=w/2;
 g.fillStyle='#14111c';g.fillRect(cx-7,64,14,h-64);g.fillStyle='#4b4266';g.fillRect(cx-7,64,3,h-64);
 g.fillStyle='#1d1928';g.fillRect(cx-16,h-46,32,46);
 g.strokeStyle='#14111c';g.lineWidth=9;g.lineCap='round';g.beginPath();g.moveTo(cx,86);g.quadraticCurveTo(cx,40,cx+70,38);g.lineTo(w-84,38);g.stroke();
 g.fillStyle='#241f31';rr(g,w-104,30,84,16,7);g.fill();
 glow(g,w-62,54,125,rgb,.8);
 g.fillStyle='#fff6da';rr(g,w-94,42,64,7,3);g.fill();
})}
function poolImg(rgb){return mk(128,48,(g,w,h)=>{g.translate(w/2,h/2);g.scale(1,h/w);const q=g.createRadialGradient(0,0,0,0,0,w/2);q.addColorStop(0,`rgba(${rgb},.75)`);q.addColorStop(.5,`rgba(${rgb},.25)`);q.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=q;g.beginPath();g.arc(0,0,w/2,0,7);g.fill()})}
function treeImg(cols,seed){return mk(440,680,(g,w,h)=>{const R=rng(seed);
 g.fillStyle='#1a0f17';g.beginPath();g.moveTo(w/2-17,h);g.lineTo(w/2-8,h*.48);g.lineTo(w/2+8,h*.48);g.lineTo(w/2+17,h);g.fill();
 for(let i=0;i<36;i++){const a=R()*6.283,d=Math.sqrt(R())*.55,bx=w/2+Math.cos(a)*d*w*.85,by=h*.36+Math.sin(a)*d*h*.42,r=40+R()*46;
  const q=g.createRadialGradient(bx-r*.3,by-r*.35,r*.1,bx,by,r);q.addColorStop(0,cols[0]);q.addColorStop(.6,cols[1]);q.addColorStop(1,cols[2]);g.fillStyle=q;g.beginPath();g.arc(bx,by,r,0,7);g.fill()}
 for(let i=0;i<46;i++){const a=R()*6.283,d=Math.sqrt(R())*.5;g.fillStyle=`rgba(255,${190+R()*50|0},110,${.25+R()*.4})`;g.beginPath();g.arc(w/2+Math.cos(a)*d*w*.85,h*.36+Math.sin(a)*d*h*.4,2+R()*3,0,7);g.fill()}
})}
function pineImg(seed){return mk(300,760,(g,w,h)=>{
 g.fillStyle='#120c16';g.fillRect(w/2-9,h*.8,18,h*.2);
 for(let k=0;k<6;k++){const y0=h*(.05+k*.13),y1=y0+h*.24,half=26+k*20;
  const q=g.createLinearGradient(w/2-half,0,w/2+half,0);q.addColorStop(0,'#24545a');q.addColorStop(.5,'#0e2b33');q.addColorStop(1,'#07151f');
  g.fillStyle=q;g.beginPath();g.moveTo(w/2,y0);g.lineTo(w/2+half,y1);g.lineTo(w/2-half,y1);g.closePath();g.fill();
  g.strokeStyle='rgba(150,120,255,.35)';g.lineWidth=2;g.beginPath();g.moveTo(w/2,y0);g.lineTo(w/2-half,y1);g.stroke()}
})}
function bannerImg(dir){return mk(200,800,(g,w,h)=>{
 if(dir<0){g.translate(w,0);g.scale(-1,1)}
 g.fillStyle='#14111c';g.fillRect(w/2-6,90,12,h-90);g.fillStyle='#1d1928';g.fillRect(w/2-14,h-40,28,40);
 g.fillRect(w/2-6,120,96,8);
 const q=g.createLinearGradient(0,150,0,470);q.addColorStop(0,'#7a49e8');q.addColorStop(1,'#3a1a86');
 g.fillStyle=q;g.beginPath();g.moveTo(w/2+12,130);g.lineTo(w/2+92,130);g.lineTo(w/2+92,440);g.lineTo(w/2+52,480);g.lineTo(w/2+12,440);g.closePath();g.fill();
 g.strokeStyle='rgba(235,225,255,.85)';g.lineWidth=5;g.lineCap='round';
 for(let i=0;i<3;i++){g.beginPath();g.arc(w/2+52,260+i*26,26,.15*Math.PI,.85*Math.PI);g.stroke()}
 glow(g,w/2+52,290,90,'150,110,255',.16)
})}
function chevImg(dir){return mk(200,320,(g,w,h)=>{
 glow(g,w/2,90,120,'255,200,60',.3);
 g.fillStyle='#1a1724';g.fillRect(w/2-6,150,12,170);
 rr(g,w/2-84,20,168,140,10);g.fillStyle='#ffc21a';g.fill();g.lineWidth=5;g.strokeStyle='#15121e';g.stroke();
 g.strokeStyle='#15121e';g.lineWidth=22;g.lineJoin='miter';g.beginPath();
 if(dir>0){g.moveTo(w/2-26,40);g.lineTo(w/2+26,90);g.lineTo(w/2-26,140)}else{g.moveTo(w/2+26,40);g.lineTo(w/2-26,90);g.lineTo(w/2+26,140)}
 g.stroke()
})}
function bldgImg(seed,brick,trim){return mk(420,580,(g,w,h)=>{const R=rng(seed);
 const bx=20,bw=w-40,by=70;
 const q=g.createLinearGradient(bx,0,bx+bw,0);q.addColorStop(0,brick[0]);q.addColorStop(1,brick[1]);g.fillStyle=q;g.fillRect(bx,by,bw,h-by);
 g.fillStyle=trim;g.fillRect(bx-8,by-12,bw+16,20);g.fillRect(bx-4,by+8,bw+8,6);
 const cols=5,rows=8,cw=bw/cols,rh=(h-by-70)/rows;
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const lit=R()<.55;const x=bx+c*cw+cw*.2,y=by+28+r*rh;
  if(lit){glow(g,x+cw*.3,y+rh*.3,cw*.7,'255,170,80',.28);g.fillStyle=R()<.5?'#ffcf82':'#ffb35e'}else g.fillStyle='#161222';
  g.fillRect(x,y,cw*.6,rh*.6);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x+cw*.3-1,y,2,rh*.6)}
 g.fillStyle='#ffd08a';g.fillRect(bx+10,h-46,bw-20,30);glow(g,w/2,h-30,150,'255,190,110',.3);
 const s=g.createLinearGradient(bx,0,bx+bw,0);s.addColorStop(0,'rgba(0,0,0,0)');s.addColorStop(1,'rgba(6,4,20,.5)');g.fillStyle=s;g.fillRect(bx,by,bw,h-by)
})}
function towerImg(seed,neon){return mk(300,900,(g,w,h)=>{const R=rng(seed);
 glow(g,w/2,h*.4,260,neon,.13);
 const q=g.createLinearGradient(0,0,w,0);q.addColorStop(0,'#1d1740');q.addColorStop(1,'#0c0a1e');g.fillStyle=q;g.fillRect(50,110,w-100,h-110);
 g.fillStyle=`rgb(${neon})`;g.fillRect(50,110,4,h-110);g.fillRect(w-54,110,4,h-110);
 g.fillStyle='#231b4e';g.beginPath();g.moveTo(50,110);g.lineTo(w/2,26);g.lineTo(w-50,110);g.closePath();g.fill();
 g.fillStyle=`rgb(${neon})`;g.fillRect(w/2-2,0,4,60);glow(g,w/2,8,46,neon,.95);
 for(let r=0;r<26;r++)for(let c=0;c<6;c++){if(R()<.62){g.fillStyle=R()<.3?`rgba(${neon},.85)`:'rgba(255,214,140,.8)';g.fillRect(64+c*(w-128)/6+3,130+r*29,(w-128)/6-8,16)}}
 g.fillStyle=`rgba(${neon},.9)`;for(let y=210;y<h;y+=210)g.fillRect(50,y,w-100,4)
})}
function pylonImg(){return mk(300,760,(g,w,h)=>{
 glow(g,w/2,120,190,'255,80,190',.32);
 g.fillStyle='#151220';g.fillRect(w/2-9,220,18,h-220);g.fillStyle='#1d1928';g.fillRect(w/2-18,h-44,36,44);
 rr(g,24,24,w-48,190,20);g.fillStyle='#140d26';g.fill();g.lineWidth=9;g.strokeStyle='#ff4fb0';g.stroke();
 rr(g,38,38,w-76,162,12);g.lineWidth=3;g.strokeStyle='#56f0e6';g.stroke();
 g.textAlign='center';g.fillStyle='#fff';g.font='900 66px Impact,"Arial Black",sans-serif';g.fillText('CASINO',w/2,112);
 g.fillStyle='#ffd273';g.font='900 36px Impact,"Arial Black",sans-serif';g.fillText('★ BINGO ★',w/2,166);
 for(let i=0;i<16;i++){g.fillStyle='#ffe9a8';g.beginPath();g.arc(30+i*(w-60)/15,24,4,0,7);g.fill();g.beginPath();g.arc(30+i*(w-60)/15,214,4,0,7);g.fill()}
})}
function floodImg(){return mk(280,900,(g,w,h)=>{
 glow(g,w/2,80,250,'255,246,220',.5);
 g.fillStyle='#161320';g.beginPath();g.moveTo(w/2-10,150);g.lineTo(w/2+10,150);g.lineTo(w/2+18,h);g.lineTo(w/2-18,h);g.fill();
 g.fillStyle='#2a2438';rr(g,w/2-100,26,200,120,10);g.fill();
 for(let r=0;r<2;r++)for(let c=0;c<4;c++){g.fillStyle='#fffdf2';g.fillRect(w/2-90+c*46,38+r*46,38,34)}
 glow(g,w/2,88,120,'255,250,235',.7)
})}
function boatImg(){return mk(260,320,(g,w,h)=>{
 g.fillStyle='#120e22';g.beginPath();g.moveTo(30,250);g.lineTo(230,250);g.lineTo(200,290);g.lineTo(60,290);g.closePath();g.fill();
 g.fillStyle='#3b2f66';g.fillRect(126,20,5,236);
 g.fillStyle='#efe6ff';g.beginPath();g.moveTo(134,26);g.lineTo(206,240);g.lineTo(134,240);g.closePath();g.fill();
 g.fillStyle='#c9b3ff';g.beginPath();g.moveTo(122,60);g.lineTo(52,240);g.lineTo(122,240);g.closePath();g.fill();
 glow(g,130,266,90,'255,190,120',.35)
})}
function buoyImg(rgb){return mk(64,120,(g,w,h)=>{glow(g,32,20,30,rgb,.95);g.fillStyle=`rgb(${rgb})`;g.fillRect(28,16,8,8);g.fillStyle='#120e20';g.fillRect(24,30,16,60);g.fillStyle=`rgb(${rgb})`;g.fillRect(24,50,16,8)})}
function barricadeImg(){return mk(260,190,(g,w,h)=>{
 glow(g,44,40,54,'255,170,40',.9);glow(g,216,40,54,'255,170,40',.9);
 g.fillStyle='#17131f';g.fillRect(42,86,14,100);g.fillRect(204,86,14,100);
 g.fillStyle='#f4f0ff';rr(g,14,54,232,58,6);g.fill();g.save();rr(g,14,54,232,58,6);g.clip();g.fillStyle='#ff7a1a';
 for(let x=-40;x<280;x+=48){g.beginPath();g.moveTo(x,112);g.lineTo(x+24,112);g.lineTo(x+48,54);g.lineTo(x+24,54);g.closePath();g.fill()}g.restore();
 g.fillStyle='#ffd070';g.fillRect(36,34,16,14);g.fillRect(208,34,16,14)
})}
function carImg(body){return mk(260,170,(g,w,h)=>{
 g.fillStyle='rgba(0,0,0,.6)';g.beginPath();g.ellipse(130,160,120,10,0,0,7);g.fill();
 g.fillStyle='#07060c';g.fillRect(24,124,36,38);g.fillRect(200,124,36,38);
 const b=g.createLinearGradient(0,70,0,132);b.addColorStop(0,body[0]);b.addColorStop(1,body[1]);
 g.fillStyle=b;rr(g,16,72,228,56,16);g.fill();
 g.beginPath();g.moveTo(54,74);g.lineTo(80,26);g.lineTo(180,26);g.lineTo(206,74);g.closePath();g.fillStyle=b;g.fill();
 const wq=g.createLinearGradient(0,30,0,74);wq.addColorStop(0,'#3a2a66');wq.addColorStop(1,'#0c0a1e');
 g.fillStyle=wq;g.beginPath();g.moveTo(66,70);g.lineTo(88,34);g.lineTo(172,34);g.lineTo(194,70);g.closePath();g.fill();
 g.fillStyle=body[1];g.fillRect(66,20,128,6);
 g.fillStyle='#0d0b18';g.fillRect(16,112,228,22);
 glow(g,54,96,58,'255,40,60',.6);glow(g,206,96,58,'255,40,60',.6);
 g.fillStyle='#ff4360';rr(g,26,88,62,14,5);g.fill();rr(g,172,88,62,14,5);g.fill();
 g.fillStyle='#ffd6da';g.fillRect(34,91,46,4);g.fillRect(180,91,46,4);
 g.fillStyle='#dcd6ee';g.fillRect(104,102,52,16)
})}
function initSprites(){
 const rgb={warm:'255,190,105',pink:'255,95,190'};
 reg('lampL',lampImg(1,rgb.warm),560,1400,{pool:'warm'});reg('lampR',lampImg(-1,rgb.warm),560,1400,{pool:'warm'});
 reg('lampPL',lampImg(1,rgb.pink),560,1400,{pool:'pink'});reg('lampPR',lampImg(-1,rgb.pink),560,1400,{pool:'pink'});
 for(const k in rgb)POOL[k]=poolImg(rgb[k]);
 reg('treeO',treeImg(['#ffb04a','#e0651f','#5a1f18'],3),950,1470);
 reg('treeR',treeImg(['#ff7f5e','#c42d34','#4a1420'],8),950,1470);
 reg('treeG',treeImg(['#ffe27a','#e9a233','#5a3a18'],15),950,1470);
 reg('pine',pineImg(2),620,1570);
 reg('bannerL',bannerImg(1),340,1360);reg('bannerR',bannerImg(-1),340,1360);
 reg('chevR',chevImg(1),330,530);reg('chevL',chevImg(-1),330,530);
 reg('bldgA',bldgImg(5,['#6b2f2a','#4a2022'],'#3a2a30'),2000,2765);
 reg('bldgB',bldgImg(9,['#5a3a34','#3c2628'],'#4a3540'),2000,2765);
 reg('towerP',towerImg(4,'255,90,190'),1300,3900);
 reg('towerC',towerImg(12,'90,235,230'),1300,3900);
 reg('pylon',pylonImg(),620,1570);
 reg('flood',floodImg(),780,2500);
 reg('boat',boatImg(),1000,1230);
 reg('buoyR',buoyImg('255,90,90'),160,300);reg('buoyG',buoyImg('90,255,170'),160,300);
 [['#c9d2ff','#6d78d6'],['#ff6b8a','#a3244a'],['#3fe8cf','#158a80'],['#ffbb55','#b5651b'],['#a58bff','#5a3bc0'],['#e9e4ff','#8b84a8'],['#4b7bff','#1c3a9c']].forEach(c=>CARSPR.push(carImg(c)));
 CARSPR.barricade=barricadeImg();
}

/* ---------------------------------------------------------------- TRACKS */
const TRACKS={};
function pt(z,y){return{world:{x:0,y,z},camera:{x:0,y:0,z:0},screen:{x:0,y:0,w:0,scale:0}}}
function buildTrack(key){
 const th=THEMES[key],R=rng(th.seed),segs=[];
 const lastY=()=>segs.length?segs[segs.length-1].p2.world.y:0;
 function add(curve,y){const n=segs.length;segs.push({index:n,p1:pt(n*SEG,lastY()),p2:pt((n+1)*SEG,y),curve,band:Math.floor(n/3)%2,sprites:[],cars:[],tunnel:false,gate:null,clip:0})}
 function road(enter,hold,leave,curve,hillUnits){
  enter|=0;hold|=0;leave|=0;
  const y0=lastY(),y1=y0+(hillUnits||0)*SEG,total=enter+hold+leave;
  for(let n=0;n<enter;n++)add(easeIn(0,curve,n/enter),easeInOut(y0,y1,n/total));
  for(let n=0;n<hold;n++)add(curve,easeInOut(y0,y1,(enter+n)/total));
  for(let n=0;n<leave;n++)add(easeInOut(curve,0,n/leave),easeInOut(y0,y1,(enter+hold+n)/total));
 }
 let sign=R()<.5?-1:1;
 const rc=()=>th.cmin+R()*(th.cmax-th.cmin);
 const hillY=m=>{const y=lastY()/SEG;let s=y>th.hill*.9?-1:y<-th.hill*.2?1:(R()<.5?1:-1);return s*m*(.55+R()*.7)};
 const pat={
  rise:()=>road(25,40+R()*50,25,0,hillY(th.hill*.8)),
  sweep:()=>{sign=-sign;road(30,50+R()*70,30,sign*rc(),R()<.4?hillY(th.hill*.5):0)},
  esses:()=>{sign=-sign;const c=rc()*.9;road(12,24,12,sign*c,0);road(12,24,12,-sign*c,0);road(14,22,14,sign*c*.8,0)},
  crest:()=>{const h=th.hill*(.9+R()*.5);sign=-sign;road(30,40,20,sign*1.6,h);road(20,30,40,-sign*1.2,-h)},
  fast:()=>road(40,110+R()*90,40,0,0),
  tight:()=>{sign=-sign;road(14,30,14,sign*Math.min(th.cmax*1.05,5.6),0)}
 };
 const total=th.mix.reduce((a,m)=>a+m[1],0);
 const pick=()=>{let r=R()*total;for(const m of th.mix){if((r-=m[1])<0)return m[0]}return th.mix[0][0]};
 road(15,45,15,0,0);
 while(segs.length<th.len-380)pat[pick()]();
 road(70,140,70,0,-lastY()/SEG);          // ease back to level ground for the safe zone
 road(10,80,10,0,0);
 const finish=segs.length;
 road(0,280,0,0,0);                        // cool-down so the road loops cleanly
 const t={key,th,segs,finish,N:segs.length,len:segs.length*SEG};
 for(const[p,l]of th.tunnels){const s=Math.floor(finish*p);for(let i=s;i<s+l&&i<finish-100;i++)segs[i].tunnel=true}
 decorate(t);
 return t;
}
function decorate(t){
 const th=t.th,segs=t.segs,F=t.finish,R=rng(th.seed+99),key=t.key;
 const put=(n,type,off,refl)=>{const s=segs[n];if(s&&!s.tunnel)s.sprites.push({type,off,refl})};
 const trees=['treeO','treeR','treeG'],pick=a=>a[Math.floor(R()*a.length)],side=()=>R()<.5?-1:1;
 for(let i=1;i<12;i++)segs[Math.floor(F*i/12)].gate={kind:'cp',label:String(i+1).padStart(2,'0')};
 segs[F].gate={kind:'finish'};
 for(let n=22;n<F+10;n++){
  const s=segs[n];if(s.tunnel)continue;
  if(Math.abs(s.curve)>=2.2&&n%7===0){if(s.curve>0)put(n,'chevR',-1.17);else put(n,'chevL',1.17)}
  if(n%12===0)put(n,th.lamp[0],-1.17);
  if(n%12===6)put(n,th.lamp[1],1.17);
  if(key==='lakefront'){
   if(n%15===3)put(n,pick(trees),-(1.55+R()*1.3));
   if(n%22===11)put(n,pick(trees),1.55+R()*.5);
   if(n%70===7)put(n,R()<.5?'bldgA':'bldgB',-(2.6+R()*1.1));
   if(n%36===19)put(n,'bannerL',-1.15);
   if(n%58===40)put(n,'boat',3.2+R()*4,true);
   if(n%40===27)put(n,R()<.5?'buoyR':'buoyG',2.5+R()*4,true);
  }else if(key==='casino'){
   if(n%48===9)put(n,'pylon',n%96===9?-1.5:1.5);
   if(n%64===20)put(n,R()<.5?'towerP':'towerC',side()*(2.5+R()*2),true);
   if(n%40===14)put(n,R()<.5?'buoyR':'buoyG',side()*(2.1+R()*2.4),true);
   if(n%26===4)put(n,'pine',side()*(1.5+R()*.25));
   if(n%140===80)put(n,'boat',side()*(2.8+R()*2.4),true);
  }else{
   if(n%9===1)put(n,'pine',side()*(1.4+R()*2.2));
   if(n%17===8)put(n,pick(trees),-(1.6+R()*1.4));
   if(n%90===30)put(n,'flood',-(1.9+R()*1));
   if(n%40===19)put(n,'bannerL',-1.15);
   if(n%120===60)put(n,'bldgA',-(2.8+R()*1));
   if(n%100===55)put(n,'boat',3.6+R()*3,true);
  }
 }
 /* overhead gantries / overpasses */
 const every=key==='casino'?520:key==='lambeau'?700:900;
 for(let n=every;n<F-160;n+=every){if(!segs[n].tunnel&&!segs[n].gate&&!segs[n-4].tunnel){
  segs[n].gate=key==='casino'?{kind:'gantry',text:'SALK CASINO',col:'#ff4fb0'}:key==='lambeau'?{kind:'bridge'}:{kind:'gantry',text:'LAKEFRONT →',col:'#56f0e6'}}}
}
function getTrack(key){return TRACKS[key]||(TRACKS[key]=buildTrack(key))}

/* ------------------------------------------------------------ WORLD STATE */
let trk=null,pos=0,playerX=0,skyX=0,shake=0,time=0,facing=1,steerVis=0,hudTick=0,toastT=0,countToken=0;
const sparks=[],traffic=[];
const segAt=z=>{const n=trk.N;return trk.segs[((Math.floor(z/SEG))%n+n)%n]};
function setRoute(){
 const r=routes[state.route],app=$('#app');
 app.className=(app.className.match(/racing|boosting/g)||[]).join(' ')+' route-'+r[2];
 $('#routeName').textContent=r[0];
 $('#playerCar').style.setProperty('--car-hue',CAR_HUE[state.car]+'deg');
}
function previewRoute(){
 const key=routes[state.route][2];
 const changed=!trk||trk.key!==key;
 if(trk)for(const s of trk.segs)s.cars.length=0;
 trk=getTrack(key);
 if(changed){pos=0;playerX=0}
 spawnTraffic(0);setRoute();
}
function spawnTraffic(count){
 for(const s of trk.segs)s.cars.length=0;
 traffic.length=0;
 const th=trk.th,R=rng(th.seed*7+Math.floor(performance.now())%997);
 const F=trk.finish;
 for(let i=0,tries=0;i<count&&tries<count*8;tries++){
  const n=45+Math.floor(R()*(F-260)),lane=[-.667,0,.667][Math.floor(R()*3)],s=trk.segs[n];
  const near=new Set();for(let k=n-9;k<=n+9;k++)for(const c of trk.segs[k].cars)near.add(c.lane);
  if(near.has(lane)||near.size>=2)continue;
  const r=R();let type,speed,sprite;
  if(r<.08){type='barricade';speed=0;sprite=CARSPR.barricade}
  else if(r<.2){type='stalled';speed=0;sprite=CARSPR[Math.floor(R()*CARSPR.length)]}
  else{type='car';speed=BASE_MAX*(.3+R()*.28);sprite=CARSPR[Math.floor(R()*CARSPR.length)]}
  const c={z:n*SEG+R()*SEG,lane,off:lane,speed,type,sprite,w:type==='barricade'?.5:.48,ph:R()*6,passed:false};
  traffic.push(c);s.cars.push(c);i++;
 }
}

/* --------------------------------------------------------------- SIMULATE */
function emitSparks(side,n,y){for(let i=0;i<n;i++)sparks.push({x:W/2+side*W*(.16+Math.random()*.06),y:y||H*.86,vx:side*(80+Math.random()*260)*dpr+(Math.random()-.5)*120*dpr,vy:-(60+Math.random()*260)*dpr,life:.25+Math.random()*.3})}
function crash(c){
 const dir=playerX>=c.off?1:-1;
 playerX=clamp(playerX+dir*.42,-1.06,1.06);
 state.speed=Math.max(c.speed*.9,state.speed*(c.type==='barricade'?.38:.5));
 state.hit=.8;state.boost=Math.max(0,state.boost-15);shake=1;
 emitSparks(dir,26,H*.8);
 $('#playerCar').animate([{translate:'0 0'},{translate:`${dir*18}px -6px`},{translate:'0 0'}],{duration:220});
}
function updateTraffic(dt,pz,pseg,checkHit){
 for(const c of traffic){
  const old=segAt(c.z);
  c.z+=c.speed*dt;if(c.z>=trk.len)c.z-=trk.len;
  if(c.speed>0)c.off=c.lane+Math.sin(time*.7+c.ph)*.035;
  const ns=segAt(c.z);
  if(ns!==old){const i=old.cars.indexOf(c);if(i>=0)old.cars.splice(i,1);ns.cars.push(c)}
  if(checkHit&&!c.passed&&c.z<pz-SEG*3&&state.speed>c.speed){c.passed=true;state.passes++;state.boost=Math.min(100,state.boost+7)}
 }
 if(checkHit&&state.hit<=0){
  const next=trk.segs[(pseg.index+1)%trk.N];
  for(const sg of[pseg,next])for(const c of sg.cars)if(state.speed>c.speed&&Math.abs(playerX-c.off)<(.4+c.w)*.4&&Math.abs(c.z-pz)<SEG*1.4){crash(c);return}
 }
}
function update(dt){
 if(!trk)return;
 time+=dt;
 if(state.paused)return;
 const maxBase=BASE_MAX*cars[state.car][2]/184;
 const pz=pos+playerZ,pseg=segAt(pz);
 let steer=0,boosting=false;
 const active=state.mode==='race'&&state.started;
 if(active){
  const k=state.keys;
  steer=(k.left||k.a?-1:0)+(k.right||k.d?1:0);
  const brake=k.brake||k.down||k.s;
  boosting=!!(k.boost||k[' '])&&state.boost>1;
  const cap=maxBase*(boosting?1.28:1);
  if(brake)state.speed=Math.max(maxBase*.16,state.speed-cap*1.05*dt);
  else if(state.speed<cap)state.speed=Math.min(cap,state.speed+cap*(boosting?.95:.45)*dt);
  else state.speed=Math.max(cap,state.speed-cap*.5*dt);
  const sp=state.speed/BASE_MAX;
  playerX+=steer*dt*2.7*clamp(sp,.3,1.4);
  playerX-=dt*2*sp*sp*pseg.curve*.22;
  if(Math.abs(playerX)>1){                       // scraping the barrier
   const s=Math.sign(playerX);playerX=clamp(playerX,-1.08,1.08);
   state.speed=Math.max(maxBase*.4,state.speed-maxBase*.8*dt);shake=Math.max(shake,.3);emitSparks(s,2);
  }
  if(boosting)state.boost=Math.max(0,state.boost-dt*27);else state.boost=Math.min(100,state.boost+dt*8);
  pos+=state.speed*dt;state.time+=dt;state.hit=Math.max(0,state.hit-dt);
  state.progress=clamp((pos+playerZ)/(trk.finish*SEG),0,1);
  const cp=Math.min(12,Math.floor(state.progress*12)+1);
  if(cp>state.checkpoint){if(state.checkpoint>0){$('#objective').textContent='CHECKPOINT '+String(cp-1).padStart(2,'0')+' CLEARED';toastT=1.6}state.checkpoint=cp}
  const npz=pos+playerZ;updateTraffic(dt,npz,segAt(npz),true);
  if(state.progress>=1)finish();
 }else if(state.mode==='race'){                    // countdown: engine idling
  state.speed=0;
 }else if(state.mode==='finish'){
  state.speed=Math.max(0,state.speed-maxBase*.5*dt);playerX=lerp(playerX,0,dt*1.5);pos+=state.speed*dt;
  updateTraffic(dt,pz,pseg,false);
 }else{                                            // menu: relaxed cruise on the selected route
  state.speed=lerp(state.speed,maxBase*.34,dt*1.2);
  playerX=lerp(playerX,Math.sin(time*.25)*.42,dt*1.5);
  pos+=state.speed*dt;if(pos>=trk.len)pos-=trk.len;
 }
 if(toastT>0){toastT-=dt;if(toastT<=0)$('#objective').textContent='PASSENGER ABOARD · RACE TO SAFETY'}
 skyX+=pseg.curve*(state.speed/BASE_MAX)*dt*W*.05;
 shake=Math.max(0,shake-dt*2.2);
 for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.life-=dt;if(p.life<=0){sparks.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=900*dt*dpr}
 /* player sprite (HTML element over the canvas) */
 steerVis=lerp(steerVis,active?steer:0,Math.min(1,dt*9));
 if(steer>0)facing=-1;else if(steer<0)facing=1;else if(active&&Math.abs(pseg.curve)>1.5)facing=pseg.curve>0?-1:1;
 const el=$('#playerCar'),sp2=state.speed/BASE_MAX;
 el.style.setProperty('--car-x',(steerVis*22)+'px');
 el.style.setProperty('--car-r',(-steerVis*2.2*facing)+'deg');
 el.style.setProperty('--car-y',(Math.sin(time*38)*1.4*sp2+(boosting?Math.sin(time*70)*1.2:0)-Math.abs(pseg.curve)*sp2*sp2*1.6)+'px');
 el.style.setProperty('--car-flip',facing);
 $('#app').classList.toggle('boosting',boosting);
 if(state.mode==='race'&&++hudTick%3===0)updateHUD();
}

/* ---------------------------------------------------------------- RENDER */
function quad(x1,y1,x2,y2,x3,y3,x4,y4,c){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.lineTo(x4,y4);ctx.closePath();ctx.fill()}
function project(p,camX,camY,camZ){
 const c=p.camera,s=p.screen;
 c.x=p.world.x-camX;c.y=p.world.y-camY;c.z=p.world.z-camZ;
 s.scale=c.z>0?camDepth/c.z:1e6;
 s.x=Math.round(W/2+s.scale*c.x*K);s.y=Math.round(horizonY-s.scale*c.y*K);s.w=Math.round(s.scale*ROAD*K);
}
function drawBackdrop(th,img){
 const g=ctx.createLinearGradient(0,0,0,farY);g.addColorStop(0,'#1a1038');g.addColorStop(1,`rgb(${th.haze})`);
 ctx.fillStyle=g;ctx.fillRect(0,0,W,farY+2);
 if(!img||!img.complete||!img.naturalWidth)return;
 const srcH=img.naturalHeight*th.crop,sc=farY/srcH,tw=img.naturalWidth*sc,pan=skyX+playerX*W*.03;
 const u=((pan%(2*tw))+2*tw)%(2*tw);
 for(let k=Math.floor(u/tw);k*tw-u<W;k++){
  const x=k*tw-u;
  if(k&1){ctx.save();ctx.translate(x+tw,0);ctx.scale(-1,1);ctx.drawImage(img,0,0,img.naturalWidth,srcH,0,0,tw,farY);ctx.restore()}
  else ctx.drawImage(img,0,0,img.naturalWidth,srcH,x,0,tw,farY);
 }
}
function drawSeg(sg,th){
 const b=sg.band,p1=sg.p1.screen,p2=sg.p2.screen;
 const x1=p1.x,y1=p1.y,w1=p1.w,x2=p2.x,y2=p2.y-1,w2=p2.w;
 for(let s=-1;s<=1;s+=2){
  const shore=s<0?th.shoreL:th.shoreR,land=s<0?th.landL:th.landR,water=s<0?th.waterL:th.waterR,edge=s<0?0:W;
  if(shore){
   const a1=x1+s*w1*shore,a2=x2+s*w2*shore;
   quad(x1,y1,a1,y1,a2,y2,x2,y2,land[b]);
   quad(a1,y1,edge,y1,edge,y2,a2,y2,water[b]);
   if(sg.index%4===0){const yh=y1-(y1-y2)*.3;quad(a1,y1,edge,y1,edge,yh,a1+(a2-a1)*.3,yh,th.glint)}
  }else quad(x1,y1,edge,y1,edge,y2,x2,y2,land[b]);
 }
 quad(x1-w1,y1,x1+w1,y1,x2+w2,y2,x2-w2,y2,th.road[b]);
 if(!b)quad(x1-w1*.5,y1,x1+w1*.5,y1,x2+w2*.5,y2,x2-w2*.5,y2,'rgba(150,130,255,.05)');
 const stripe=(off,half,c)=>quad(x1+w1*(off-half),y1,x1+w1*(off+half),y1,x2+w2*(off+half),y2,x2+w2*(off-half),y2,c);
 if(!b){stripe(-.333,.012,'#f1edff');stripe(.333,.012,'#f1edff')}
 stripe(.965,.012,'#f1edff');stripe(-.945,.008,'#ffc94a');stripe(-.985,.008,'#ffc94a');
 if(sg.tunnel){
  const t1=y1-p1.scale*TUN_H*K,t2=y2-p2.scale*TUN_H*K,e=1.04;
  quad(x1-w1*e,y1,x1-w1*e,t1,x2-w2*e,t2,x2-w2*e,y2,b?'#15112a':'#1a1533');
  quad(x1+w1*e,y1,x1+w1*e,t1,x2+w2*e,t2,x2+w2*e,y2,b?'#15112a':'#1a1533');
  quad(x1-w1*e,t1,x1+w1*e,t1,x2+w2*e,t2,x2-w2*e,t2,b?'#0d0a1c':'#110d24');
  const lit=th.barrierLight;
  const wy1=y1-p1.scale*TUN_H*.42*K,wy2=y2-p2.scale*TUN_H*.42*K,wh1=p1.scale*90*K,wh2=p2.scale*90*K;
  quad(x1-w1*e,wy1,x1-w1*e,wy1-wh1,x2-w2*e,wy2-wh2,x2-w2*e,wy2,lit);
  quad(x1+w1*e,wy1,x1+w1*e,wy1-wh1,x2+w2*e,wy2-wh2,x2+w2*e,wy2,lit);
  if(!b){quad(x1-w1*.06,t1,x1+w1*.06,t1,x2+w2*.06,t2,x2-w2*.06,t2,'#f3eeff');quad(x1-w1*.7,t1,x1-w1*.6,t1,x2-w2*.6,t2,x2-w2*.7,t2,'#c9b8ff');quad(x1+w1*.6,t1,x1+w1*.7,t1,x2+w2*.7,t2,x2+w2*.6,t2,'#c9b8ff')}
 }else{
  const bh1=p1.scale*260*K,bh2=p2.scale*260*K;
  for(let s=-1;s<=1;s+=2){
   const bx1=x1+s*w1*BARRIER,bx2=x2+s*w2*BARRIER;
   quad(bx1,y1,bx1,y1-bh1,bx2,y2-bh2,bx2,y2,th.barrier[b]);
   if(sg.index%5===0){const ww=Math.max(1,w1*.03);ctx.fillStyle=th.barrierLight;ctx.fillRect(bx1-ww/2,y1-bh1*.78,ww,bh1*.24)}
  }
 }
}
function drawGate(sg){
 const g=sg.gate,p=sg.p1.screen,s=p.scale*K,x=p.x,w=p.w,y=p.y;
 if(s<=0||w<3)return;
 let gh=2100*s,bh=520*s,post=150*s,off=1.12,neon='#56f0e6',text=g.label,body='#181329';
 if(g.kind==='finish'){neon='#7dffb0';text='SAFE ZONE';bh=640*s}
 else if(g.kind==='gantry'){neon=g.col;text=g.text;bh=620*s;body='#160f2c'}
 else if(g.kind==='bridge'){off=1.4;gh=1750*s;bh=620*s;post=420*s;neon='#ffd070';text=null;body='#1a1626'}
 ctx.save();ctx.beginPath();ctx.rect(0,0,W,Math.max(0,sg.clip+1));ctx.clip();
 const lx=x-w*off,rx=x+w*off;
 ctx.fillStyle=body;ctx.fillRect(lx-post/2,y-gh,post,gh);ctx.fillRect(rx-post/2,y-gh,post,gh);
 ctx.fillStyle=neon;ctx.fillRect(lx-post/2,y-gh,Math.max(1,post*.16),gh);ctx.fillRect(rx+post/2-Math.max(1,post*.16),y-gh,Math.max(1,post*.16),gh);
 const top=y-gh-bh;
 ctx.fillStyle=body;ctx.fillRect(lx-post/2,top,rx-lx+post,bh);
 ctx.fillStyle=neon;ctx.fillRect(lx-post/2,top+bh-Math.max(2,bh*.1),rx-lx+post,Math.max(2,bh*.1));ctx.fillRect(lx-post/2,top,rx-lx+post,Math.max(1,bh*.05));
 if(g.kind!=='bridge'){
  ctx.globalAlpha=.1;ctx.fillStyle=neon;ctx.fillRect(lx,top+bh,rx-lx,gh);ctx.globalAlpha=1;
  if(g.kind==='finish'){const n=24,cw=(rx-lx)/n;for(let i=0;i<n;i++){ctx.fillStyle=i&1?'#fff':'#111';ctx.fillRect(lx+i*cw,top+bh*.08,cw,bh*.2)}}
  const px=Math.round(bh*(g.kind==='cp'?.62:.5));
  if(text&&px>8){ctx.font=`900 italic ${px}px "Barlow Condensed",Impact,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(g.kind==='cp'?'CHECKPOINT '+text:text,x,top+bh*(g.kind==='finish'?.6:.5))}
 }else{ctx.fillStyle='rgba(255,208,112,.85)';for(let i=0;i<14;i++){const lxp=lx+(rx-lx)*(i+.5)/14;ctx.fillRect(lxp-Math.max(1,3*s),top+bh-Math.max(3,bh*.3),Math.max(2,6*s),Math.max(3,bh*.16))}}
 ctx.restore();
}
function drawObjects(sg,n){
 const p1=sg.p1.screen,p2=sg.p2.screen,fade=clamp((DRAW-n)/30,0,1);
 for(const c of sg.cars){
  const pct=(c.z%SEG)/SEG,w=lerp(p1.w,p2.w,pct),cx=lerp(p1.x,p2.x,pct)+c.off*w,cy=lerp(p1.y,p2.y,pct);
  const dw=c.w*w,img=c.sprite,dh=dw*img.height/img.width;
  if(dw<3||cx+dw<0||cx-dw>W||dw>W*3)continue;
  ctx.globalAlpha=fade;ctx.drawImage(img,cx-dw/2,cy-dh,dw,dh);
  if(c.type==='stalled'&&(time*2.2)%1<.5){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade*.9;const r=Math.max(2,dw*.1);
   for(const sx of[-.42,.42]){const q=ctx.createRadialGradient(cx+sx*dw,cy-dh*.5,0,cx+sx*dw,cy-dh*.5,r*2.4);q.addColorStop(0,'rgba(255,180,50,1)');q.addColorStop(1,'rgba(255,180,50,0)');ctx.fillStyle=q;ctx.fillRect(cx+sx*dw-r*2.4,cy-dh*.5-r*2.4,r*4.8,r*4.8)}
   ctx.globalCompositeOperation='source-over'}
  ctx.globalAlpha=1;
 }
 const sc=p1.scale*K;
 for(const s of sg.sprites){
  const d=SPR[s.type],dw=d.w*sc,dh=d.h*sc;
  if(dh<3||dw>W*2.5)continue;
  const cx=p1.x+s.off*p1.w,left=cx-dw/2;
  if(left>W||left+dw<0)continue;
  if(d.pool&&dw>6){const pw=p1.w*.95;ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade*.8;ctx.drawImage(POOL[d.pool],p1.x+s.off*.6*p1.w-pw/2,p1.y-pw*.14,pw,pw*.28);ctx.globalCompositeOperation='source-over'}
  ctx.globalAlpha=fade;
  if(s.refl&&dh>10){ctx.save();ctx.globalAlpha=fade*.3;ctx.translate(0,p1.y);ctx.scale(1,-.5);ctx.drawImage(d.img,left,-dh,dw,dh);ctx.restore();ctx.globalAlpha=fade}
  ctx.drawImage(d.img,left,p1.y-dh,dw,dh);
  ctx.globalAlpha=1;
 }
 if(sg.gate)drawGate(sg);
}
const visible=[];
function render(){
 const t=trk;if(!t||!W)return;
 const th=t.th;
 ctx.setTransform(1,0,0,1,0,0);
 ctx.fillStyle=th.bg;ctx.fillRect(0,0,W,H);
 if(shake>0)ctx.translate((Math.random()-.5)*shake*14*dpr,(Math.random()-.5)*shake*9*dpr);
 drawBackdrop(th,ART[t.key]);
 ctx.fillStyle=th.bg;ctx.fillRect(-30,Math.round(farY),W+60,H);
 const base=segAt(pos),basePct=(pos%SEG)/SEG;
 const pz=pos+playerZ,pseg=segAt(pz),ppct=(pz%SEG)/SEG;
 const camY=lerp(pseg.p1.world.y,pseg.p2.world.y,ppct)+CAM_H;
 let x=0,dx=-(base.curve*basePct),maxy=H;
 visible.length=0;
 for(let n=0;n<DRAW;n++){
  const sg=t.segs[(base.index+n)%t.N],looped=sg.index<base.index;
  sg.clip=maxy;
  const cz=pos-(looped?t.len:0);
  project(sg.p1,playerX*ROAD-x,camY,cz);project(sg.p2,playerX*ROAD-x-dx,camY,cz);
  x+=dx;dx+=sg.curve;
  if(sg.p1.camera.z<=camDepth||sg.p2.screen.y>=sg.p1.screen.y||sg.p2.screen.y>=maxy)continue;
  visible.push(sg,n);
  maxy=sg.p1.screen.y;
 }
 for(let i=visible.length-2;i>=0;i-=2){drawSeg(visible[i],th);drawObjects(visible[i],visible[i+1])}
 ctx.globalAlpha=1;
 /* horizon haze */
 const hz=ctx.createLinearGradient(0,horizonY-H*.05,0,horizonY+(H-horizonY)*.5);
 hz.addColorStop(0,`rgba(${th.fog},0)`);hz.addColorStop(.12,`rgba(${th.haze},.34)`);hz.addColorStop(.3,`rgba(${th.fog},.42)`);hz.addColorStop(1,`rgba(${th.fog},0)`);
 ctx.fillStyle=hz;ctx.fillRect(0,horizonY-H*.05,W,(H-horizonY)*.55+H*.05);
 /* headlight wash + sparks */
 ctx.globalCompositeOperation='lighter';
 const yTop=horizonY+(H-horizonY)*.42,hl=ctx.createLinearGradient(0,H,0,yTop);hl.addColorStop(0,'rgba(255,238,210,.22)');hl.addColorStop(1,'rgba(255,238,210,0)');
 ctx.fillStyle=hl;ctx.beginPath();ctx.moveTo(W*.5-W*.15,H);ctx.lineTo(W*.5+W*.15,H);ctx.lineTo(W*.5+W*.035,yTop);ctx.lineTo(W*.5-W*.035,yTop);ctx.closePath();ctx.fill();
 for(const p of sparks){ctx.strokeStyle=`rgba(255,${150+Math.random()*90|0},70,${clamp(p.life*3,0,1)})`;ctx.lineWidth=2*dpr;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.03,p.y-p.vy*.03);ctx.stroke()}
 ctx.globalCompositeOperation='source-over';
}

/* ------------------------------------------------------------------ HUD */
function updateHUD(){
 const check=Math.min(12,Math.floor(state.progress*12)+1);
 const mph=Math.round(state.speed/BASE_MAX*184);
 $('#progress').style.width=(state.progress*100)+'%';
 $('#checkpoint').textContent=String(check).padStart(2,'0')+' / 12';
 $('#speed').innerHTML=String(mph).padStart(3,'0')+' <em>MPH</em>';
 $('#boostValue').textContent=Math.round(state.boost)+'%';$('#boostBar').style.width=state.boost+'%';
 $('#position').textContent=String(Math.max(1,4-Math.floor(state.passes/4))).padStart(2,'0')+' / 04';
}

/* ----------------------------------------------------------- GAME FLOW */
function launch(){
 trk=getTrack(routes[state.route][2]);
 Object.assign(state,{mode:'race',racing:true,started:false,paused:false,speed:0,boost:100,progress:0,time:0,checkpoint:0,passes:0,hit:0});
 pos=0;playerX=0;skyX=0;shake=0;sparks.length=0;facing=1;steerVis=0;toastT=0;
 spawnTraffic(trk.th.traffic);setRoute();
 $('#objective').textContent='PASSENGER ABOARD · RACE TO SAFETY';
 $('#app').classList.add('racing');$('#hud').hidden=false;$('#boostHud').hidden=false;$('#touch').hidden=innerWidth>720;
 show('none');updateHUD();countdown(3,++countToken);
}
function countdown(n,token){
 if(token!==countToken)return;
 const e=$('#countdown');e.textContent=n||'GO!';e.classList.add('show');
 setTimeout(()=>{if(token!==countToken)return;if(n)countdown(n-1,token);else{e.classList.remove('show');state.started=true}},700);
}
function enterMenu(){
 countToken++;$('#countdown').classList.remove('show');
 Object.assign(state,{mode:'menu',racing:false,started:false,paused:false});
 $('#app').classList.remove('racing','boosting');$('#hud').hidden=true;$('#boostHud').hidden=true;$('#touch').hidden=true;
 spawnTraffic(0);
}
function finish(){
 state.mode='finish';state.racing=false;state.started=false;
 $('#app').classList.remove('racing','boosting');$('#hud').hidden=true;$('#boostHud').hidden=true;$('#touch').hidden=true;
 const n=drivers[state.driver][0].split(' ')[0],time=`${Math.floor(state.time/60)}:${String(Math.floor(state.time%60)).padStart(2,'0')}`;
 $('#finishCopy').innerHTML=`<p>SAFE ZONE REACHED</p><h2>YOU GOT THEM HOME.</h2><span>${n} carried the passenger through ${routes[state.route][0]} in ${time}. The race never stopped.</span><div class="result-stats">12 / 12 CHECKPOINTS · ${state.passes} CLEAN OVERTAKES · ${Math.round(state.boost)}% SPARK REMAINING</div><button class="primary" id="again">RUN ANOTHER ROUTE <b>→</b></button>`;
 show('finish');
 $('#again').onclick=()=>{enterMenu();show('routes')};
}
function pauseToggle(force){
 if(state.mode!=='race')return;
 state.paused=force===undefined?!state.paused:force;
 show(state.paused?'pause':'none');
}
$('#launch').onclick=launch;
$('#resume').onclick=()=>pauseToggle(false);
$('#restart').onclick=launch;
$('#quit').onclick=()=>{enterMenu();show('garage')};

/* ---------------------------------------------------------------- INPUT */
function key(e){return({arrowleft:'left',arrowright:'right',arrowup:'up',arrowdown:'down'}[e.key.toLowerCase()]||e.key.toLowerCase())}
addEventListener('keydown',e=>{
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Escape'].includes(e.key))e.preventDefault();
 if(e.key==='Escape'&&state.mode==='race'){pauseToggle();return}
 const k=key(e);state.keys[k]=true;if(k==='shift')state.keys.boost=true;if(e.key===' ')state.keys[' ']=true;
});
addEventListener('keyup',e=>{const k=key(e);state.keys[k]=false;if(k==='shift')state.keys.boost=false;if(e.key===' ')state.keys[' ']=false});
addEventListener('blur',()=>{state.keys={}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){state.keys={};if(state.mode==='race'&&state.racing)pauseToggle(true)}});
$$('#touch button').forEach(b=>{const k=b.dataset.key,down=e=>{e.preventDefault();state.keys[k]=true},up=e=>{e.preventDefault();state.keys[k]=false};
 b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointerleave',up);b.addEventListener('pointercancel',up)});

/* ---------------------------------------------------------------- START */
initSprites();resize();selectUI();previewRoute();
let last=performance.now();
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(frame)}
requestAnimationFrame(frame);
})();
