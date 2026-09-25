/* SPARKED Signal Run — additive static upgrade. No build step required. */
const root = document.querySelector('#root');
const routes = [
  { id: 'lakefront', name: 'Lakefront Escape', from: 'Aldermoor', to: 'Lakefront Safe Zone', image: 'lake', weather: 'RAIN / NIGHT', difficulty: 'MEDIUM', length: 8200, max: 218, sky: ['#171447', '#673e9a', '#ff8a90'], road: '#262d42', glow: '#50e9ff', curve: 1.45 },
  { id: 'casino', name: 'Casino Causeway', from: 'Founders Square', to: 'Salk Bingo & Casino', image: 'courtyard', weather: 'NEON / WET', difficulty: 'HIGH', length: 9400, max: 232, sky: ['#150a2c', '#751e85', '#ffb071'], road: '#302138', glow: '#ff58c8', curve: 1.85 },
  { id: 'lambeau', name: 'Lambeau Night Run', from: 'Lambeau High', to: 'Clearview', image: 'school', weather: 'FOG / STADIUM', difficulty: 'MEDIUM', length: 8700, max: 224, sky: ['#081d2d', '#1c796a', '#d7b076'], road: '#263b39', glow: '#75ffce', curve: 1.65 },
  { id: 'salk', name: 'Salk Skyline Sprint', from: 'Salk North', to: 'Salk Safehouse', image: 'characters', weather: 'DAWN / DRY', difficulty: 'EXPERT', length: 10200, max: 240, sky: ['#1a1739', '#5b5bc5', '#ffce9c'], road: '#313143', glow: '#a997ff', curve: 2.15 }
];
const drivers = [
  { name: 'Izzy Monroe', note: 'Precision lines', portrait: './izzy.png' },
  { name: 'Aaliyah Hart', note: 'Boost specialist', portrait: './aaliyah.png' }
];
const cars = [
  { name: 'NOVA 96', type: 'AWD coupe', color: '#55c9ff', accent: '#d7f7ff', grip: 1.04, max: 0 },
  { name: 'VANTA GT', type: 'V6 street', color: '#f14e9d', accent: '#ffd2ee', grip: 1.0, max: 7 },
  { name: 'SOLACE R', type: 'turbo sport', color: '#ffc259', accent: '#fff0b3', grip: .96, max: 14 },
  { name: 'MIDNIGHT LX', type: 'balanced sedan', color: '#a379ff', accent: '#ede4ff', grip: 1.09, max: -5 }
];

let selectedRoute = routes[0];
let selectedDriver = drivers[0];
let selectedCar = cars[0];
const art = {};
for (const path of ['lake', 'courtyard', 'school', 'characters']) {
  const img = new Image(); img.src = `./art/${path}.png`; art[path] = img;
}

function garage() {
  root.innerHTML = `<main class="sparked-app garage">
    <header class="masthead"><h1 class="wordmark">SPARKED<span>SIGNAL RUN</span></h1><p class="build-label">2.5D ROAD EDITION</p></header>
    <section class="garage-grid">
      <div class="garage-panel">
        <p class="panel-label">Choose driver</p><div id="drivers" class="driver-row"></div>
        <p class="panel-label" style="margin-top:24px">Choose car</p><div id="cars" class="car-row"></div>
      </div>
      <div class="garage-panel"><p class="panel-label">Signal routes</p><div id="routes" class="route-stack"></div></div>
    </section>
    <footer class="launch-bar"><p class="mission-note">Your passenger is <strong>already aboard</strong>. Every run ends at a safe zone—there are no mid-race stops.</p><button class="launch" id="launch">START SIGNAL RUN →</button></footer>
  </main>`;
  const driverNode = document.querySelector('#drivers');
  drivers.forEach((driver, i) => {
    const button = document.createElement('button'); button.className = `driver-choice ${driver === selectedDriver ? 'selected' : ''}`;
    button.innerHTML = `<img class="portrait" src="${driver.portrait}" alt=""><span><span class="choice-name">${driver.name}</span><span class="choice-note">${driver.note}</span></span>`;
    button.onclick = () => { selectedDriver = driver; garage(); }; driverNode.append(button);
  });
  const carNode = document.querySelector('#cars');
  cars.forEach(car => {
    const button = document.createElement('button'); button.className = `car-choice ${car === selectedCar ? 'selected' : ''}`; button.style.setProperty('--car', car.color);
    button.innerHTML = `<strong>${car.name}</strong><small>${car.type}</small>`; button.onclick = () => { selectedCar = car; garage(); }; carNode.append(button);
  });
  const routeNode = document.querySelector('#routes');
  routes.forEach(route => {
    const button = document.createElement('button'); button.className = `route-choice ${route === selectedRoute ? 'selected' : ''}`;
    button.innerHTML = `<img class="route-art" src="./art/${route.image}.png" alt=""><span><span class="route-title">${route.name}</span><span class="route-sub">${route.from} → ${route.to} · ${route.weather}</span></span><span class="route-meta">${route.difficulty}<br>${(route.length / 1000).toFixed(1)} KM</span>`;
    button.onclick = () => { selectedRoute = route; garage(); }; routeNode.append(button);
  });
  document.querySelector('#launch').onclick = startRace;
}

function startRace() {
  root.innerHTML = `<main class="race" style="--route-glow:${selectedRoute.glow}">
    <canvas id="road"></canvas>
    <div class="top-hud">
      <div class="hud-glass"><div class="route-tag">${selectedRoute.weather}</div><div class="route-name">${selectedRoute.name}</div><div class="passenger">PASSENGER <b>● ABOARD</b> · ${selectedDriver.name.split(' ')[0]}</div></div>
      <div class="hud-glass progress-wrap"><div class="progress-read"><span>${selectedRoute.from}</span><span id="distance">0.0 / ${(selectedRoute.length / 1000).toFixed(1)} KM</span></div><div class="progress"><i id="progress"></i></div></div>
      <div class="hud-glass speed-hud"><div id="speed" class="speed-num">000</div><div class="speed-unit">KM / H</div></div>
    </div>
    <div class="controls"><div class="hint">← → / A D STEER<br>↑ / W ACCELERATE · ↓ / S BRAKE<br>SPACE / SHIFT NITRO · ESC PAUSE</div><div id="boost" class="boost-chip">NITRO 100%</div></div>
    <div class="mobile-pad left"><button data-key="left">◀</button><button data-key="right">▶</button></div><div class="mobile-pad right"><button class="go" data-key="boost">⚡</button></div>
    <div id="countdown" class="countdown">3</div>
    <section id="menu" class="race-menu hidden"><div class="menu-card" id="menu-card"></div></section>
  </main>`;
  const canvas = document.querySelector('#road');
  const ctx = canvas.getContext('2d');
  const keys = { left: false, right: false, gas: false, brake: false, boost: false };
  let cw = 0, ch = 0, dpr = 1, running = true, paused = false, state = 'countdown', startAt = performance.now(), last = performance.now();
  let speed = 0, position = 0, playerX = 0, steer = 0, nitro = 100, shake = 0, lastHud = 0;
  const traffic = Array.from({ length: 10 }, (_, i) => ({ z: 520 + i * 210 + Math.random() * 120, lane: [-.58, -.26, .25, .58][i % 4], color: ['#ff4c99', '#ffd153', '#4ed7ff', '#d5d1e9'][i % 4], phase: Math.random() * 9 }));
  const rain = Array.from({ length: 125 }, () => ({ x: Math.random(), y: Math.random(), s: .5 + Math.random() * .9 }));
  const sparks = [];
  const background = art[selectedRoute.image];
  const g = ctx.createLinearGradient(0, 0, 0, 1); // initialized in resize
  function resize() { dpr = Math.min(window.devicePixelRatio || 1, 2); cw = canvas.clientWidth; ch = canvas.clientHeight; canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  resize(); window.addEventListener('resize', resize);
  const down = e => {
    const code = e.code; if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','Escape','KeyA','KeyD','KeyW','KeyS','ShiftLeft','ShiftRight'].includes(code)) e.preventDefault();
    if (code === 'Escape') { if (state === 'race') setPause(); return; }
    if (code === 'ArrowLeft' || code === 'KeyA') keys.left = true;
    if (code === 'ArrowRight' || code === 'KeyD') keys.right = true;
    if (code === 'ArrowUp' || code === 'KeyW') keys.gas = true;
    if (code === 'ArrowDown' || code === 'KeyS') keys.brake = true;
    if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') keys.boost = true;
  };
  const up = e => { const c = e.code; if (c === 'ArrowLeft'||c === 'KeyA') keys.left=false; if(c==='ArrowRight'||c==='KeyD')keys.right=false; if(c==='ArrowUp'||c==='KeyW')keys.gas=false; if(c==='ArrowDown'||c==='KeyS')keys.brake=false; if(c==='Space'||c==='ShiftLeft'||c==='ShiftRight')keys.boost=false; };
  window.addEventListener('keydown', down); window.addEventListener('keyup', up);
  document.querySelectorAll('[data-key]').forEach(button => {
    const name = button.dataset.key;
    const on = e => { e.preventDefault(); keys[name] = true; }; const off = e => { e.preventDefault(); keys[name] = false; };
    button.addEventListener('pointerdown', on); button.addEventListener('pointerup', off); button.addEventListener('pointercancel', off); button.addEventListener('pointerleave', off);
  });
  function menu(title, copy, label, action) { const n = document.querySelector('#menu'); n.classList.remove('hidden'); document.querySelector('#menu-card').innerHTML = `<div class="menu-kicker">SIGNAL RUN</div><h2 class="menu-title">${title}</h2><p class="menu-copy">${copy}</p><button class="menu-button">${label}</button>`; n.querySelector('button').onclick = action; }
  function setPause() { paused = true; state = 'paused'; menu('PAUSED', 'Your run is held at the current checkpoint.', 'RESUME RUN', () => { paused = false; state = 'race'; document.querySelector('#menu').classList.add('hidden'); }); }
  function project(z) { const norm = Math.max(0, Math.min(1, z / 1150)); const depth = 1 - norm; const y = ch * (.25 + Math.pow(depth, 2.18) * .82); const curve = roadCurve(position + (1150-z) * .006); const horizonX = cw * .5 + curve * cw * .10; const width = cw * (.045 + Math.pow(depth, 1.75) * .68); return { x: horizonX, y, w: width, depth }; }
  function roadCurve(p) { return (Math.sin(p * .0019) * .52 + Math.sin(p * .0047 + .8) * .28 + Math.sin(p * .00079 + 2) * .35) * selectedRoute.curve; }
  function quad(a,b,c,d, fill) { ctx.beginPath(); ctx.moveTo(a.x-a.w,b.y); ctx.lineTo(a.x+a.w,b.y); ctx.lineTo(c.x+c.w,d.y); ctx.lineTo(c.x-c.w,d.y); ctx.closePath(); ctx.fillStyle=fill;ctx.fill(); }
  function drawCity(t) {
    const horizon = ch * .28; const shift = (position * .023) % cw; const img = background;
    ctx.save(); ctx.globalAlpha=.22; ctx.filter = 'saturate(1.35) contrast(1.1) blur(.3px)';
    if (img.complete && img.naturalWidth) { const ratio = img.naturalWidth / img.naturalHeight; const h = ch*.50; const w = h*ratio; for(let x=-w + (shift*.18)%w; x<cw+w; x+=w) ctx.drawImage(img, x, horizon-h*.21, w, h); }
    ctx.restore();
    ctx.save(); ctx.globalAlpha=.82;
    for(let i=0;i<35;i++){ const x=((i*87 - shift*.52)%(cw+150)+cw+150)%(cw+150)-75; const h=28+((i*37)%105); const y=horizon-h; ctx.fillStyle=i%4===0?'#17182e':'#111427'; ctx.fillRect(x,y,42+(i%3)*16,h); if(i%3!==0){ctx.fillStyle=selectedRoute.glow;ctx.globalAlpha=.23; for(let q=0;q<3;q++)ctx.fillRect(x+8+q*10,y+12+(q%2)*19,4,5);ctx.globalAlpha=.82;} }
    ctx.restore();
  }
  function drawRoad(t) {
    const sky = ctx.createLinearGradient(0,0,0,ch*.47); sky.addColorStop(0,selectedRoute.sky[0]); sky.addColorStop(.58,selectedRoute.sky[1]); sky.addColorStop(1,selectedRoute.sky[2]); ctx.fillStyle=sky;ctx.fillRect(0,0,cw,ch*.48);
    const haze=ctx.createLinearGradient(0,ch*.19,0,ch*.58);haze.addColorStop(0,'rgba(255,255,255,0)');haze.addColorStop(1,'rgba(7,8,16,.44)');ctx.fillStyle=haze;ctx.fillRect(0,0,cw,ch);
    drawCity(t);
    ctx.fillStyle='#0a0d16';ctx.fillRect(0,ch*.34,cw,ch*.66);
    const far=project(1150), near=project(0); quad(far,far,near,near,'#151728');
    for(let z=1100;z>0;z-=65){const a=project(z),b=project(Math.max(0,z-67)); const index=Math.floor((position+z)/65); quad(a,a,b,b,index%2?'#2a2e3d':selectedRoute.road); if(index%4<2){ const laneA={...a,w:a.w*.022},laneB={...b,w:b.w*.022}; const lxA={...a,x:a.x-a.w*.33,w:laneA.w},lxB={...b,x:b.x-b.w*.33,w:laneB.w}; quad(lxA,lxA,lxB,lxB,'rgba(255,238,202,.88)'); const rxA={...a,x:a.x+a.w*.33,w:laneA.w},rxB={...b,x:b.x+b.w*.33,w:laneB.w}; quad(rxA,rxA,rxB,rxB,'rgba(255,238,202,.88)'); }
      if(index%3===0){ for(const side of [-1,1]){ const x=b.x+side*(b.w+15); const y=b.y; ctx.fillStyle=selectedRoute.glow;ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(x,y,Math.max(1,b.depth*8),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1; } }
    }
    // Guard rails and luminous road edges
    for(const side of [-1,1]) { ctx.beginPath(); for(let z=1150;z>=0;z-=24){const p=project(z); const x=p.x+side*p.w; z===1150?ctx.moveTo(x,p.y):ctx.lineTo(x,p.y);}ctx.strokeStyle='rgba(196,213,255,.62)';ctx.lineWidth=2;ctx.stroke();ctx.beginPath(); for(let z=1150;z>=0;z-=24){const p=project(z); const x=p.x+side*(p.w+6); z===1150?ctx.moveTo(x,p.y):ctx.lineTo(x,p.y);}ctx.strokeStyle=selectedRoute.glow;ctx.globalAlpha=.38;ctx.lineWidth=2;ctx.stroke();ctx.globalAlpha=1; }
  }
  function drawTraffic(t) {
    traffic.sort((a,b)=>b.z-a.z).forEach(car => { const p=project(car.z); if(car.z<15||car.z>1170)return; const scale=.18+p.depth*.83; const x=p.x+car.lane*p.w*.74; const w=34*scale, h=55*scale; ctx.save();ctx.translate(x,yClamp(p.y-h*.7));ctx.scale(scale,scale);ctx.fillStyle='rgba(0,0,0,.34)';ctx.beginPath();ctx.ellipse(0,31,22,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=car.color;ctx.beginPath();ctx.roundRect(-18,-8,36,35,7);ctx.fill();ctx.fillStyle='#152137';ctx.beginPath();ctx.moveTo(-13,-4);ctx.lineTo(-8,-20);ctx.lineTo(9,-20);ctx.lineTo(14,-4);ctx.closePath();ctx.fill();ctx.fillStyle='#ff5353';ctx.fillRect(-14,18,7,4);ctx.fillRect(7,18,7,4);ctx.restore(); }); }
  function yClamp(y){return Math.min(ch+80,Math.max(ch*.23,y));}
  function drawPlayer(t) {
    const roadAtBottom=project(10); const px=roadAtBottom.x+playerX*roadAtBottom.w*.68; const py=ch*.83; const s=Math.max(.67,Math.min(1.18,cw/950)); const angle=steer*.16; const wheelSpin=position*.06;
    ctx.save();ctx.translate(px,py);ctx.rotate(angle);ctx.scale(s,s);
    // grounded shadow and wheel smoke
    ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.ellipse(0,45,69,15,0,0,Math.PI*2);ctx.fill();
    if(Math.abs(steer)>.42&&speed>82){ctx.fillStyle='rgba(230,240,255,.25)';ctx.beginPath();ctx.ellipse(-55,35,22,9,-.2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(55,35,22,9,.2,0,Math.PI*2);ctx.fill();}
    // wheels spin independently; front wheels also visibly steer
    for(const side of [-1,1]) for(const axle of [-1,1]) { ctx.save();ctx.translate(side*51,axle*17+15);if(axle<0)ctx.rotate(steer*.45);ctx.fillStyle='#080911';ctx.beginPath();ctx.roundRect(-11,-18,22,36,6);ctx.fill();ctx.strokeStyle='#99a6bd';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.stroke();ctx.rotate(wheelSpin*.055);ctx.strokeStyle='#d7e5ff';ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(7,0);ctx.moveTo(0,-7);ctx.lineTo(0,7);ctx.stroke();ctx.restore(); }
    const body=selectedCar.color, accent=selectedCar.accent;
    ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(-63,27);ctx.lineTo(-53,-10);ctx.quadraticCurveTo(-41,-35,-16,-42);ctx.lineTo(34,-39);ctx.quadraticCurveTo(55,-27,61,4);ctx.lineTo(56,30);ctx.quadraticCurveTo(0,46,-63,27);ctx.closePath();ctx.fill();
    ctx.fillStyle=accent;ctx.globalAlpha=.74;ctx.beginPath();ctx.moveTo(-31,-28);ctx.lineTo(25,-27);ctx.lineTo(42,-4);ctx.lineTo(-41,-5);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle='#10182a';ctx.beginPath();ctx.moveTo(-26,-25);ctx.lineTo(-4,-32);ctx.lineTo(-5,-7);ctx.lineTo(-35,-7);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(1,-32);ctx.lineTo(23,-25);ctx.lineTo(35,-7);ctx.lineTo(1,-7);ctx.closePath();ctx.fill();
    ctx.fillStyle='#e8f9ff';ctx.shadowColor=selectedRoute.glow;ctx.shadowBlur=18;ctx.fillRect(-49,8,14,6);ctx.fillRect(35,8,14,6);ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,.36)';ctx.fillRect(-47,22,94,3);
    ctx.restore();
    if(keys.boost&&nitro>0&&state==='race'){ctx.save();ctx.strokeStyle='#a9f9ff';ctx.shadowColor='#63e7ff';ctx.shadowBlur=18;ctx.lineWidth=4;for(let i=0;i<7;i++){const x=px+(Math.random()-.5)*90*s;ctx.beginPath();ctx.moveTo(x,py+38);ctx.lineTo(x+(Math.random()-.5)*16,py+125+Math.random()*100);ctx.stroke();}ctx.restore();}
  }
  function drawVfx() {
    if(selectedRoute.weather.includes('RAIN')) { ctx.strokeStyle='rgba(198,224,255,.36)';ctx.lineWidth=1.1; for(const drop of rain){drop.y+= (.018+speed*.000035)*drop.s;if(drop.y>1){drop.y=0;drop.x=Math.random();}const x=drop.x*cw,y=drop.y*ch;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-7*drop.s,y+20*drop.s);ctx.stroke();} }
    for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.life-=.025; p.x+=p.vx;p.y+=p.vy;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3);if(p.life<=0)sparks.splice(i,1);}ctx.globalAlpha=1;
  }
  function collision() { for(const car of traffic){if(car.z<55&&car.z>0&&Math.abs(playerX-car.lane)<.24){speed*=.54;shake=10;car.z+=120;for(let i=0;i<14;i++)sparks.push({x:cw*.5+playerX*cw*.22,y:ch*.82,vx:(Math.random()-.5)*6,vy:-Math.random()*5,life:1,color:'#ffd36d'});}} }
  function update(dt) {
    if(state==='countdown'){ const remain=3-(performance.now()-startAt)/1000;document.querySelector('#countdown').textContent=Math.max(1,Math.ceil(remain)); if(remain<=0){state='race';document.querySelector('#countdown').classList.add('hidden');} return; }
    if(state!=='race'||paused)return;
    const top=selectedRoute.max+selectedCar.max; const baseGas=keys.gas?1:0.48; const boosting=keys.boost&&nitro>0&&speed>42; speed += (baseGas*(boosting?73:48) - (keys.brake?130:0) - speed*.15)*dt; if(boosting){speed+=42*dt;nitro=Math.max(0,nitro-25*dt);}else nitro=Math.min(100,nitro+6*dt);speed=Math.max(0,Math.min(top+(boosting?34:0),speed));
    const target=(keys.left?-1:0)+(keys.right?1:0);steer += (target-steer)*Math.min(1,dt*9); playerX+=steer*(.38+speed/top*.55)*dt*selectedCar.grip;playerX=Math.max(-.93,Math.min(.93,playerX));
    position+=speed*dt*1.75; traffic.forEach(car=>{car.z-=speed*dt*1.92; if(car.z<-30){car.z+=1440+Math.random()*300;car.lane=[-.6,-.3,.28,.58][Math.floor(Math.random()*4)];}});collision();shake=Math.max(0,shake-45*dt);
    if(position>=selectedRoute.length){state='finished';speed=0;menu('SAFE ZONE REACHED', `${selectedDriver.name.split(' ')[0]} delivered the passenger to ${selectedRoute.to}. Run time: ${(position / 150).toFixed(1)} s.`, 'RETURN TO GARAGE', () => { running=false; cleanup(); garage(); });}
  }
  function paint(t) { ctx.save(); if(shake)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake*.35);drawRoad(t);drawTraffic(t);drawPlayer(t);drawVfx();ctx.restore(); }
  function hud(now) { if(now-lastHud<70)return;lastHud=now;document.querySelector('#speed').textContent=String(Math.round(speed)).padStart(3,'0');const km=Math.min(selectedRoute.length,position)/1000;document.querySelector('#distance').textContent=`${km.toFixed(1)} / ${(selectedRoute.length/1000).toFixed(1)} KM`;document.querySelector('#progress').style.width=`${Math.min(100,position/selectedRoute.length*100)}%`;const chip=document.querySelector('#boost');chip.textContent=`NITRO ${Math.round(nitro)}%`;chip.classList.toggle('hot',keys.boost&&nitro>0); }
  function frame(now) { if(!running)return;const dt=Math.min(.04,(now-last)/1000);last=now;update(dt);paint(now);hud(now);requestAnimationFrame(frame); }
  function cleanup(){window.removeEventListener('resize',resize);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);}
  requestAnimationFrame(frame);
}

garage();
