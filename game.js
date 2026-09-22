/* SPARKED · SIGNAL RUN — real 3D edition.
   Hand-written WebGL engine (no external libraries): a real low-poly car with
   4 independently rotating/steering wheels, driving through a real 3D world
   with elevation, curvature, scenery and traffic. Three routes, three
   difficulties. Menu/HUD DOM is unchanged from the original design. */
(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const D2R=Math.PI/180;
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ------------------------------------------------------------------ DATA */
const drivers=[['IZZY MONROE','IM','CURRENT RUNNER','ROUTE CURRENT','Finds the clearest way through the blackout.'],['AALIYAH GAIN','AG','VELOCITY','ACCELERATE','Turns every open street into an advantage.'],['THEO REED','TR','POWER LINE','BREAKAWAY','Keeps the rescue run moving forward.'],['JORDAN KIM','JK','SIGNAL TECH','OVERRIDE','Reads the city faster than it can close in.'],['MATEO RIVERA','MR','STREETWISE','SHORTCUT','Knows which streets still lead home.']];
const cars=[['VOLT GT',[0.30,0.86,0.90],184,'Twin-turbo street coupé'],['NIGHTFALL R',[0.62,0.46,1.0],176,'Low-slung grand tourer'],['SUNFIRE ZX',[1.0,0.34,0.58],191,'Lightweight sport compact'],['RIVET 4X',[1.0,0.72,0.28],171,'All-weather rally machine']];
const routes=[
 ['LAKEFRONT ESCAPE','Aldermoor → Lakefront Safe Zone','lakefront','EASY','Wide boulevard · gentle curves · marina lights'],
 ['CASINO CAUSEWAY','Founders Square → Salk Bingo and Casino','casino','MEDIUM','Tunnels · tighter sweepers · neon causeway'],
 ['LAMBEAU NIGHT RUN','Lambeau High → Clearview','lambeau','HARD','Steep hills · sharp esses · dense traffic']
];
const state={driver:0,car:0,route:0,mode:'menu',racing:false,started:false,paused:false,speed:0,boost:100,progress:0,time:0,checkpoint:0,passes:0,hit:0,keys:{}};

/* --------------------------------------------------------------- MENU UI */
function selectUI(){
 $('#drivers').innerHTML=drivers.map((d,i)=>`<button class="pick ${i===state.driver?'selected':''}" data-driver="${i}"><span class="tag">${d[2]}</span><span class="initial">${d[1]}</span><h3>${d[0]}</h3><p>${d[4]}</p><small class="ability">⚡ ${d[3]}</small></button>`).join('');
 $('#cars').innerHTML=cars.map((c,i)=>{const rgb=c[1].map(v=>Math.round(v*255));return `<button class="pick car-pick" data-car="${i}" style="padding-top:15px">${i===state.car?'<span class="tag">SELECTED</span>':'<span class="tag">TAP TO SELECT</span>'}<h3>${c[0]}</h3><p>${c[3]}</p><div class="stat">TOP ${c[2]} MPH<br><span style="display:inline-block;width:38px;height:10px;background:rgb(${rgb});border-radius:2px;margin-top:4px"></span></div></button>`}).join('');
 $('#routeCards').innerHTML=routes.map((r,i)=>{const dp=r[3].toLowerCase();return `<button class="route-card ${i===state.route?'selected':''}" data-route="${i}"><div><span class="tag">${r[4].toUpperCase()}<span class="diff-pill diff-${dp}">${r[3]}</span></span><h3>${r[0]}</h3><p>${r[1]}</p><small>12 CHECKPOINTS · PASSENGER ABOARD FROM START</small></div></button>`}).join('');
 $$('[data-driver]').forEach(b=>b.onclick=()=>{state.driver=+b.dataset.driver;selectUI()});
 $$('[data-car]').forEach(b=>b.onclick=()=>{state.car=+b.dataset.car;selectUI()});
 $$('[data-route]').forEach(b=>b.onclick=()=>{state.route=+b.dataset.route;selectUI();previewRoute()});
}
function show(id){$$('.screen').forEach(x=>x.classList.remove('active'));if(id!=='none')$('#'+id).classList.add('active')}
window.sparkedShow=show;
document.addEventListener('click',event=>{let button=event.target.closest('[data-screen]');if(button){event.preventDefault();show(button.dataset.screen)}});

/* ------------------------------------------------------------- WEBGL SETUP */
const canvas=$('#world');
const gl=canvas.getContext('webgl',{antialias:true,alpha:false})||canvas.getContext('experimental-webgl');
const VSRC=`
attribute vec3 aPos; attribute vec3 aNrm;
uniform mat4 uModel,uView,uProj;
varying vec3 vNrmW; varying float vFog;
void main(){
 vec4 wp = uModel*vec4(aPos,1.0);
 vec4 vp = uView*wp;
 vNrmW = mat3(uModel)*aNrm;
 vFog = -vp.z;
 gl_Position = uProj*vp;
}`;
const FSRC=`
precision mediump float;
varying vec3 vNrmW; varying float vFog;
uniform vec3 uColor,uLightDir,uFogColor;
uniform float uEmissive,uFogNear,uFogFar,uAmbient;
void main(){
 vec3 n=normalize(vNrmW);
 float diff=max(dot(n,uLightDir),0.0);
 vec3 lit=uColor*(uAmbient+diff*(1.0-uAmbient));
 vec3 base=mix(lit,uColor,uEmissive);
 float f=clamp((vFog-uFogNear)/(uFogFar-uFogNear),0.0,1.0);
 gl_FragColor=vec4(mix(base,uFogColor,f),1.0);
}`;
function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(s));return s}
const prog=gl.createProgram();
gl.attachShader(prog,compile(gl.VERTEX_SHADER,VSRC));
gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,FSRC));
gl.linkProgram(prog);
if(!gl.getProgramParameter(prog,gl.LINK_STATUS))console.error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
const A_POS=gl.getAttribLocation(prog,'aPos'),A_NRM=gl.getAttribLocation(prog,'aNrm');
const U={model:gl.getUniformLocation(prog,'uModel'),view:gl.getUniformLocation(prog,'uView'),proj:gl.getUniformLocation(prog,'uProj'),
 color:gl.getUniformLocation(prog,'uColor'),light:gl.getUniformLocation(prog,'uLightDir'),fogColor:gl.getUniformLocation(prog,'uFogColor'),
 emissive:gl.getUniformLocation(prog,'uEmissive'),fogNear:gl.getUniformLocation(prog,'uFogNear'),fogFar:gl.getUniformLocation(prog,'uFogFar'),ambient:gl.getUniformLocation(prog,'uAmbient')};
gl.enableVertexAttribArray(A_POS);gl.enableVertexAttribArray(A_NRM);
gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);

/* ------------------------------------------------------------ GEOMETRY */
function makeBuf(data,el){const b=gl.createBuffer();gl.bindBuffer(el?gl.ELEMENT_ARRAY_BUFFER:gl.ARRAY_BUFFER,b);gl.bufferData(el?gl.ELEMENT_ARRAY_BUFFER:gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b}
function buildMesh(pos,nrm,idx){return{pos:makeBuf(new Float32Array(pos)),nrm:makeBuf(new Float32Array(nrm)),idx:makeBuf(new Uint16Array(idx),true),count:idx.length}}
function unitBox(){
 const p=[],n=[],idx=[];
 const faces=[
  [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[0,0,1]],
  [[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[0,0,-1]],
  [[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[1,0,0]],
  [[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-1,0,0]],
  [[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5],[0,1,0]],
  [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[0,-1,0]]
 ];
 faces.forEach((f,fi)=>{const nrmv=f[4];for(let i=0;i<4;i++){p.push(...f[i]);n.push(...nrmv)}const b=fi*4;idx.push(b,b+1,b+2,b,b+2,b+3)});
 return buildMesh(p,n,idx);
}
function unitCylinder(seg){
 const p=[],n=[],idx=[];
 for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2,x=Math.cos(a)*.5,z=Math.sin(a)*.5;
  p.push(x,.5,z);n.push(Math.cos(a),0,Math.sin(a));
  p.push(x,-.5,z);n.push(Math.cos(a),0,Math.sin(a));}
 for(let i=0;i<seg;i++){const a=i*2;idx.push(a,a+2,a+1, a+1,a+2,a+3)}
 const topC=p.length/3;p.push(0,.5,0);n.push(0,1,0);
 for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2;p.push(Math.cos(a)*.5,.5,Math.sin(a)*.5);n.push(0,1,0)}
 for(let i=0;i<seg;i++)idx.push(topC,topC+1+i,topC+2+i);
 const botC=p.length/3;p.push(0,-.5,0);n.push(0,-1,0);
 for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2;p.push(Math.cos(a)*.5,-.5,Math.sin(a)*.5);n.push(0,-1,0)}
 for(let i=0;i<seg;i++)idx.push(botC,botC+2+i,botC+1+i);
 return buildMesh(p,n,idx);
}
function unitCone(seg){
 const p=[],n=[],idx=[];
 for(let i=0;i<seg;i++){
  const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2;
  const mx=Math.cos((a0+a1)/2),mz=Math.sin((a0+a1)/2);
  const b=p.length/3;
  p.push(0,.5,0);n.push(mx*.6,.8,mz*.6);
  p.push(Math.cos(a0)*.5,-.5,Math.sin(a0)*.5);n.push(Math.cos(a0)*.8,.4,Math.sin(a0)*.8);
  p.push(Math.cos(a1)*.5,-.5,Math.sin(a1)*.5);n.push(Math.cos(a1)*.8,.4,Math.sin(a1)*.8);
  idx.push(b,b+1,b+2);
 }
 const botC=p.length/3;p.push(0,-.5,0);n.push(0,-1,0);
 for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2;p.push(Math.cos(a)*.5,-.5,Math.sin(a)*.5);n.push(0,-1,0)}
 for(let i=0;i<seg;i++)idx.push(botC,botC+2+i,botC+1+i);
 return buildMesh(p,n,idx);
}
function unitSphere(lat,lon){
 const p=[],n=[],idx=[];
 for(let i=0;i<=lat;i++){const th=i/lat*Math.PI;for(let j=0;j<=lon;j++){const ph=j/lon*Math.PI*2;
  const x=Math.sin(th)*Math.cos(ph)*.5,y=Math.cos(th)*.5,z=Math.sin(th)*Math.sin(ph)*.5;
  p.push(x,y,z);n.push(x*2,y*2,z*2)}}
 for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){const a=i*(lon+1)+j,b=a+lon+1;idx.push(a,b,a+1, b,b+1,a+1)}
 return buildMesh(p,n,idx);
}
const GEO={box:unitBox(),cyl:unitCylinder(10),cone:unitCone(9),sphere:unitSphere(6,9)};

/* ----------------------------------------------------------------- MAT4 */
function m4build(px,py,pz,yaw,pitch,sx,sy,sz,out){
 out=out||new Float32Array(16);
 const cy=Math.cos(yaw),sy_=Math.sin(yaw),cx=Math.cos(pitch),sx_=Math.sin(pitch);
 const r00=cy,r01=sy_*sx_,r02=sy_*cx;
 const r10=0,r11=cx,r12=-sx_;
 const r20=-sy_,r21=cy*sx_,r22=cy*cx;
 out[0]=r00*sx;out[1]=r10*sx;out[2]=r20*sx;out[3]=0;
 out[4]=r01*sy;out[5]=r11*sy;out[6]=r21*sy;out[7]=0;
 out[8]=r02*sz;out[9]=r12*sz;out[10]=r22*sz;out[11]=0;
 out[12]=px;out[13]=py;out[14]=pz;out[15]=1;
 return out;
}
function m4mul(a,b,out){
 out=out||new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];out[c*4+r]=s}
 return out;
}
function m4perspective(fovy,aspect,near,far){
 const f=1/Math.tan(fovy/2),out=new Float32Array(16);
 out[0]=f/aspect;out[5]=f;out[10]=(far+near)/(near-far);out[11]=-1;out[14]=(2*far*near)/(near-far);
 return out;
}
function m4lookAt(eye,ctr,up){
 let zx=eye[0]-ctr[0],zy=eye[1]-ctr[1],zz=eye[2]-ctr[2];
 let zl=Math.hypot(zx,zy,zz)||1;zx/=zl;zy/=zl;zz/=zl;
 let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;
 let xl=Math.hypot(xx,xy,xz)||1;xx/=xl;xy/=xl;xz/=xl;
 const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
 const out=new Float32Array(16);
 out[0]=xx;out[1]=yx;out[2]=zx;out[3]=0;
 out[4]=xy;out[5]=yy;out[6]=zy;out[7]=0;
 out[8]=xz;out[9]=yz;out[10]=zz;out[11]=0;
 out[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);
 out[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);
 out[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);
 out[15]=1;
 return out;
}

/* --------------------------------------------------------------- THEMES */
const THEMES={
 lakefront:{seed:11,len:2200,tail:380,ds:5,half:5.4,cmin:60,cmax:130,gmax:.045,traffic:14,tunnels:[],
  bg:[.09,.07,.16],fog:[.55,.32,.5],road:[.16,.16,.22],line:[.92,.9,.98],
  sideL:[.22,.14,.16],sideR:[.13,.19,.42],sideRname:'water',
  trees:[[.62,.42,.14],[.72,.3,.16],[.65,.5,.12]],bldg:[.34,.19,.18],lamp:[1,.78,.42],
  mix:[['sweep',4],['rise',3],['esses',2],['fast',1]]},
 casino:{seed:29,len:2500,tail:380,ds:5,half:4.8,cmin:34,cmax:78,gmax:.06,traffic:20,tunnels:[[.22,.12],[.58,.14],[.83,.09]],
  bg:[.06,.04,.13],fog:[.32,.09,.34],road:[.15,.14,.2],line:[.95,.9,.98],
  sideL:[.09,.06,.19],sideR:[.09,.06,.22],sideRname:'water',
  trees:[[.15,.5,.42],[.13,.42,.5],[.2,.44,.3]],bldg:[.24,.15,.36],lamp:[1,.35,.72],
  mix:[['fast',4],['esses',3],['sweep',2],['tight',1]]},
 lambeau:{seed:47,len:2800,tail:380,ds:5,half:4.2,cmin:24,cmax:60,gmax:.1,traffic:26,tunnels:[[.68,.1]],
  bg:[.05,.07,.09],fog:[.24,.16,.4],road:[.17,.17,.23],line:[.95,.92,.85],
  sideL:[.08,.16,.1],sideR:[.09,.13,.22],sideRname:'water',
  trees:[[.1,.3,.14],[.4,.3,.12],[.42,.16,.1]],bldg:[.28,.24,.2],lamp:[1,.82,.4],
  mix:[['crest',4],['tight',3],['esses',2],['sweep',1]]}
};

/* ---------------------------------------------------------------- TRACKS */
const TRACKS={};
function buildTrack(key){
 const th=THEMES[key],R=rng(th.seed),ds=th.ds;
 const N=Math.round((th.len+th.tail)/ds),finishN=Math.round(th.len/ds);
 const heading=new Float32Array(N+1),curve=new Float32Array(N+1),grade=new Float32Array(N+1);
 const px=new Float32Array(N+1),py=new Float32Array(N+1),pz=new Float32Array(N+1);
 let sign=R()<.5?-1:1,hillSign=1;
 const rc=()=>1/(th.cmin+R()*(th.cmax-th.cmin));
 const seg=(n,curveTarget,gradeTarget)=>{ // returns arrays via closure push
  for(let i=0;i<n;i++){segCurve.push(curveTarget*Math.sin(Math.min(1,(i+1)/Math.max(6,n*.3))*Math.PI/2));segGrade.push(gradeTarget)}
 };
 let segCurve=[],segGrade=[];
 const ease=(n,c0,c1,g0,g1)=>{for(let i=0;i<n;i++){const t=i/(n-1||1),e=t*t*(3-2*t);segCurve.push(lerp(c0,c1,e));segGrade.push(lerp(g0,g1,e))}};
 const pat={
  straight:()=>ease(30,0,0,0,0),
  fast:()=>ease(46,0,0,0,0),
  sweep:()=>{sign=-sign;const c=sign*rc();ease(50,0,c,0,0)},
  esses:()=>{sign=-sign;const c=sign*rc();ease(20,0,c,0,0);ease(24,c,-c,0,0);ease(20,-c,0,0,0)},
  tight:()=>{sign=-sign;const c=sign*(1/(th.cmin*0.85));ease(34,0,c,0,0)},
  rise:()=>{hillSign=-hillSign;ease(46,0,0,0,hillSign*th.gmax*.7)},
  crest:()=>{hillSign=-hillSign;sign=-sign;const c=sign*rc();ease(30,0,c,0,hillSign*th.gmax)}
 };
 const total=th.mix.reduce((a,m)=>a+m[1],0);
 const pick=()=>{let r=R()*total;for(const m of th.mix){if((r-=m[1])<0)return m[0]}return th.mix[0][0]};
 ease(20,0,0,0,0);
 while(segCurve.length<finishN-60)pat[pick()]();
 // ease back to flat & level before the tail loop so it drives smoothly
 const cur=segCurve[segCurve.length-1]||0,gr=segGrade[segGrade.length-1]||0;
 ease(40,cur,0,gr,0);
 while(segCurve.length<finishN)segCurve.push(0),segGrade.push(0);
 // gentle loop-back tail so idle/menu cruise wraps cleanly
 const tailN=N-finishN;
 // bring accumulated elevation back toward 0 over the tail
 let elevSoFar=0;for(let i=0;i<finishN;i++)elevSoFar+=segGrade[i]*ds;
 const correctGrade=tailN>0?(-elevSoFar/ds)/tailN:0;
 for(let i=0;i<tailN;i++){segCurve.push(0);segGrade.push(correctGrade)}
 for(let i=0;i<N;i++){curve[i]=segCurve[i]||0;grade[i]=segGrade[i]||0}
 for(let i=0;i<N;i++){
  heading[i+1]=heading[i]+curve[i]*ds;
  px[i+1]=px[i]+Math.sin(heading[i])*ds;
  pz[i+1]=pz[i]+Math.cos(heading[i])*ds;
  py[i+1]=py[i]+grade[i]*ds;
 }
 const tunnels=th.tunnels.map(([p,frac])=>[Math.floor(finishN*p),Math.floor(finishN*frac)]);
 const isTunnel=i=>tunnels.some(([s,l])=>i>=s&&i<s+l);
 const t={key,th,N,finishN,ds,heading,curve,grade,px,py,pz,tunnels,isTunnel,len:N*ds};
 t.sampleAt=function(s){
  s=((s%t.len)+t.len)%t.len;
  const f=s/ds,i=Math.min(N-1,Math.floor(f)),frac=f-i;
  const hd=lerp(heading[i],heading[i+1],frac);
  return{x:lerp(px[i],px[i+1],frac),y:lerp(py[i],py[i+1],frac),z:lerp(pz[i],pz[i+1],frac),heading:hd,curve:lerp(curve[i],curve[i+1],frac),grade:lerp(grade[i],grade[i+1],frac),seg:i};
 };
 buildTrackMeshes(t);
 placeScenery(t);
 return t;
}
function ribbonMesh(t,offA,offB,yLift){
 const p=[],n=[],idx=[];
 for(let i=0;i<=t.N;i++){
  const hd=t.heading[i],rx=Math.cos(hd),rz=-Math.sin(hd);
  const bx=t.px[i],by=t.py[i]+(yLift||0),bz=t.pz[i];
  p.push(bx+rx*offA,by,bz+rz*offA); n.push(0,1,0);
  p.push(bx+rx*offB,by,bz+rz*offB); n.push(0,1,0);
 }
 for(let i=0;i<t.N;i++){const a=i*2;idx.push(a,a+2,a+1, a+1,a+2,a+3)}
 return buildMesh(p,n,idx);
}
function buildTrackMeshes(t){
 const h=t.th.half;
 t.mesh={
  road:ribbonMesh(t,-h,h,0),
  lineL:ribbonMesh(t,-h+.22,-h+.42,.01),
  lineR:ribbonMesh(t,h-.42,h-.22,.01),
  lineC:ribbonMesh(t,-.12,.12,.008),
  sideL:ribbonMesh(t,-h-22,-h,-.03),
  sideR:ribbonMesh(t,h,h+22,-.03)
 };
}
function placeScenery(t){
 const th=t.th,R=rng(th.seed+500),props=[],gates=[];
 const put=(s,offset,geom,color,emissive,sx,sy,sz,yaw,yOff)=>{
  const p=t.sampleAt(s);
  const cy=p.y+(yOff!==undefined?yOff:sy/2);
  const m=m4build(p.x+Math.cos(p.heading)*offset,cy,p.z-Math.sin(p.heading)*offset,p.heading+(yaw||0),0,sx,sy,sz);
  props.push({geom,color,emissive:emissive?1:0,m,s});
 };
 const tree=(s,offset)=>{
  const c=th.trees[Math.floor(R()*th.trees.length)],trunkH=1.8+R()*.6,coneH=2.6+R(),coneR=1.5+R()*.6;
  put(s,offset,'cyl',[.28,.2,.16],0,.32,trunkH,.32,0,0,trunkH/2);
  put(s,offset,'cone',c,0,coneR,coneH,coneR,0,0,trunkH+coneH/2);
 };
 const lamp=(s,offset)=>{
  put(s,offset,'cyl',[.14,.13,.18],0,.18,5.6,.18,0);
  const p=t.sampleAt(s),m=m4build(p.x+Math.cos(p.heading)*offset,p.y+5.6,p.z-Math.sin(p.heading)*offset,p.heading,0,.55,.55,.55);
  props.push({geom:'sphere',color:th.lamp,emissive:1,m,s});
 };
 const building=(s,offset,side)=>{
  const w=6+R()*5,hgt=10+R()*22,d=6+R()*5;
  const p=t.sampleAt(s);
  const m=m4build(p.x+Math.cos(p.heading)*offset,p.y+hgt/2,p.z-Math.sin(p.heading)*offset,p.heading,0,w,hgt,d);
  props.push({geom:'box',color:th.bldg,emissive:0,m,s});
  for(let wcount=0;wcount<Math.floor(hgt/4);wcount++){
   if(R()<.5)continue;
   const wy=p.y+3+wcount*4;
   const wm=m4build(p.x+Math.cos(p.heading)*(offset-Math.sign(offset)*(d/2+.05)),wy,p.z-Math.sin(p.heading)*(offset-Math.sign(offset)*(d/2+.05)),p.heading,0,w*.7,1.6,.1);
   props.push({geom:'box',color:[1,.82,.5],emissive:1,m:wm,s});
  }
 };
 const pylon=(s,offset)=>{
  put(s,offset,'cyl',[.14,.1,.2],0,.5,7,.5,0);
  const p=t.sampleAt(s),m=m4build(p.x+Math.cos(p.heading)*offset,p.y+7.6,p.z-Math.sin(p.heading)*offset,p.heading,0,2.6,3.2,.5);
  props.push({geom:'box',color:[1,.35,.72],emissive:1,m,s});
 };
 for(let n=15;n<t.finishN-10;n++){
  const s=n*t.ds;
  if(t.isTunnel(n))continue;
  if(n%9===0)lamp(s,-(th.half+.6));
  if(n%9===4)lamp(s,th.half+.6);
  if(t.key==='lakefront'){
   if(n%6===2)tree(s,-(th.half+2.5+R()*4));
   if(n%11===7)building(s,-(th.half+8+R()*4),-1);
  }else if(t.key==='casino'){
   if(n%13===3)pylon(s,-(th.half+2.2));
   if(n%17===8)building(s,-(th.half+9+R()*5),-1);
   if(n%15===5)tree(s,th.half+2.5+R()*3);
  }else{
   if(n%5===1)tree(s,-(th.half+2+R()*5));
   if(n%7===3)tree(s,th.half+2+R()*5);
   if(n%23===11)building(s,-(th.half+9+R()*4),-1);
  }
 }
 for(let i=1;i<=12;i++){
  const s=t.finishN*t.ds*i/12,p=t.sampleAt(s);
  gates.push({s,p,finish:false});
 }
 gates.push({s:t.finishN*t.ds,p:t.sampleAt(t.finishN*t.ds),finish:true});
 t.props=props;t.gates=gates;
}
function getTrack(key){return TRACKS[key]||(TRACKS[key]=buildTrack(key))}

/* ------------------------------------------------------------------ CAR */
const WHEEL_R=.34,WHEEL_W=.24,TRACK_X=.82,WB_F=1.28,WB_R=-1.28;
function carParts(bodyColor){
 return[
  {geom:'box',color:bodyColor,local:[0,0.53,0, 0,0, 1.56,0.62,4.1]},
  {geom:'box',color:bodyColor,local:[0,1.07,-0.3, 0,0, 1.28,0.46,2.0]},
  {geom:'box',color:[.08,.08,.1],local:[0,1.17,-1.85, 0,0, 1.4,0.1,0.2]},
  {geom:'box',color:[.72,.82,.95],local:[0,1.08,0.05, 0,0, 1.1,0.32,1.15]}
 ];
}
const WHEEL_POS=[[TRACK_X,WHEEL_R,WB_F,1],[-TRACK_X,WHEEL_R,WB_F,1],[TRACK_X,WHEEL_R,WB_R,0],[-TRACK_X,WHEEL_R,WB_R,0]];
function drawCar(x,y,z,yaw,pitch,bodyColor,steer,spin,scale){
 scale=scale||1;
 for(const part of carParts(bodyColor)){
  const[lx,ly,lz,ly2,lz2,sx,sy,sz]=part.local;
  const carM=m4build(x,y,z,yaw,pitch,scale,scale,scale);
  const localM=m4build(lx,ly,lz,0,0,sx,sy,sz);
  const world=m4mul(carM,localM);
  drawMesh(GEO[part.geom],world,part.color,0);
 }
 const carM=m4build(x,y,z,yaw,pitch,scale,scale,scale);
 for(const wp of WHEEL_POS){
  const localPos=m4build(wp[0]*scale,wp[1]*scale,wp[2]*scale,wp[3]?steer:0,0,1,1,1);
  const spun=m4build(0,0,0,spin,0,WHEEL_R*2*scale,WHEEL_W*scale,WHEEL_R*2*scale);
  const oriented=m4mul(rotZ90,spun);
  const positioned=m4mul(localPos,oriented);
  const wheelWorld=m4mul(carM,positioned);
  drawMesh(GEO.cyl,wheelWorld,[.08,.08,.09],0);
 }
}
const rotZ90=(()=>{const m=new Float32Array(16);const c=0,s=1;// 90deg about Z: rotate cylinder (Y-axis) to X-axis for wheel orientation
 m[0]=c;m[1]=s;m[2]=0;m[3]=0; m[4]=-s;m[5]=c;m[6]=0;m[7]=0; m[8]=0;m[9]=0;m[10]=1;m[11]=0; m[12]=0;m[13]=0;m[14]=0;m[15]=1; return m})();

/* --------------------------------------------------------------- RENDER */
function drawMesh(mesh,model,color,emissive){
 gl.uniformMatrix4fv(U.model,false,model);
 gl.uniform3fv(U.color,color);
 gl.uniform1f(U.emissive,emissive?1:0);
 gl.bindBuffer(gl.ARRAY_BUFFER,mesh.pos);gl.vertexAttribPointer(A_POS,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,mesh.nrm);gl.vertexAttribPointer(A_NRM,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.idx);
 gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
}
function drawRibbon(mesh,color){const id=new Float32Array(16);id[0]=id[5]=id[10]=id[15]=1;drawMesh(mesh,id,color,0)}

/* ------------------------------------------------------------ WORLD STATE */
let trk=null,pos=0,lateral=0,steerVis=0,wheelSpin=0,facingYaw=0,time=0,shake=0,hudTick=0,toastT=0,countToken=0;
const traffic=[];
function setRoute(){$('#routeName').textContent=routes[state.route][0]}
function previewRoute(){trk=getTrack(routes[state.route][2]);pos=0;lateral=0;spawnTraffic(0);setRoute()}
function spawnTraffic(count){
 traffic.length=0;const th=trk.th,R=rng(th.seed*7+Math.floor(performance.now())%997);
 const palette=[[.8,.82,.9],[.8,.2,.25],[.15,.4,.8],[.9,.75,.2],[.3,.3,.35],[.6,.6,.66]];
 for(let i=0,tries=0;i<count&&tries<count*8;tries++){
  const s=(40+R()*(trk.finishN-120))*trk.ds,lane=[-.55,0,.55][Math.floor(R()*3)]*th.half;
  let clash=false;for(const c of traffic)if(Math.abs(c.s-s)<80&&Math.abs(c.lane-lane)<1.4)clash=true;
  if(clash)continue;
  traffic.push({s,lane,off:lane,speed:2200+R()*1600,color:palette[Math.floor(R()*palette.length)],ph:R()*6,passed:false,spin:0});
  i++;
 }
}

/* --------------------------------------------------------------- SIMULATE */
function crash(dir){
 lateral=clamp(lateral+dir*.9,-trk.th.half+.6,trk.th.half-.6);
 state.speed=Math.max(2600,state.speed*.45);state.hit=.8;state.boost=Math.max(0,state.boost-15);shake=1;
}
function update(dt){
 if(!trk)return;
 time+=dt;
 if(state.paused)return;
 const BASE_MAX=12000,maxBase=BASE_MAX*cars[state.car][2]/184;
 const p=trk.sampleAt(pos);
 let steer=0,boosting=false;
 const active=state.mode==='race'&&state.started;
 if(active){
  const k=state.keys;
  steer=(k.left||k.a?-1:0)+(k.right||k.d?1:0);
  const brake=k.brake||k.down||k.s;
  boosting=!!(k.boost||k[' '])&&state.boost>1;
  const cap=maxBase*(boosting?1.3:1);
  if(brake)state.speed=Math.max(maxBase*.14,state.speed-cap*1.05*dt);
  else if(state.speed<cap)state.speed=Math.min(cap,state.speed+cap*(boosting?.9:.42)*dt);
  else state.speed=Math.max(cap,state.speed-cap*.5*dt);
  const sp=state.speed/BASE_MAX,mps=state.speed/BASE_MAX*84;
  lateral+=steer*dt*7.5*clamp(sp,.35,1.3);
  lateral-=dt*mps*mps*p.curve*.55;
  const lim=trk.th.half-.9;
  if(Math.abs(lateral)>lim){const s=Math.sign(lateral);lateral=clamp(lateral,-lim-.2,lim+.2);state.speed=Math.max(maxBase*.4,state.speed-maxBase*.7*dt);shake=Math.max(shake,.3)}
  if(boosting)state.boost=Math.max(0,state.boost-dt*27);else state.boost=Math.min(100,state.boost+dt*8);
  pos+=mps*dt;state.time+=dt;state.hit=Math.max(0,state.hit-dt);
  state.progress=clamp(pos/(trk.finishN*trk.ds),0,1);
  const cp=Math.min(12,Math.floor(state.progress*12)+1);
  if(cp>state.checkpoint){if(state.checkpoint>0){$('#objective').textContent='CHECKPOINT '+String(cp-1).padStart(2,'0')+' CLEARED';toastT=1.6}state.checkpoint=cp}
  updateTraffic(dt,true);
  if(state.progress>=1)finish();
 }else if(state.mode==='race'){state.speed=0}
 else if(state.mode==='finish'){state.speed=Math.max(0,state.speed-maxBase*.5*dt);lateral=lerp(lateral,0,dt*1.5);pos+=state.speed/BASE_MAX*84*dt;updateTraffic(dt,false)}
 else{state.speed=lerp(state.speed,maxBase*.3,dt*1.2);lateral=lerp(lateral,Math.sin(time*.2)*trk.th.half*.3,dt*1.2);pos+=state.speed/BASE_MAX*84*dt}
 if(toastT>0){toastT-=dt;if(toastT<=0)$('#objective').textContent='PASSENGER ABOARD · RACE TO SAFETY'}
 shake=Math.max(0,shake-dt*2.2);
 const targetSteer=active?steer:0;steerVis=lerp(steerVis,targetSteer,Math.min(1,dt*8));
 wheelSpin+=(state.speed/BASE_MAX*84)/WHEEL_R*dt;
 facingYaw=lerp(facingYaw,-steerVis*.12,dt*6);
 if(state.mode==='race'&&++hudTick%3===0)updateHUD();
}
function updateTraffic(dt,checkHit){
 const th=trk.th;
 for(const c of traffic){
  c.s+=c.speed*dt;if(c.s>trk.finishN*trk.ds+300)c.s-=trk.len;
  c.off=c.lane+Math.sin(time*.7+c.ph)*.25;
  if(checkHit&&!c.passed&&c.s<pos-40&&state.speed>c.speed){c.passed=true;state.passes++;state.boost=Math.min(100,state.boost+6)}
 }
 if(checkHit&&state.hit<=0){
  for(const c of traffic){
   if(Math.abs(c.s-pos)<4.5&&Math.abs(c.off-lateral)<2.1&&state.speed>c.speed*.9){crash(lateral>=c.off?1:-1);break}
  }
 }
}

/* ---------------------------------------------------------------- RENDER */
function render(){
 if(!trk||!gl)return;
 const th=trk.th,W=canvas.width,H=canvas.height;
 gl.viewport(0,0,W,H);
 gl.clearColor(th.bg[0],th.bg[1],th.bg[2],1);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const p=trk.sampleAt(pos);
 const camBack=9.5,camUp=3.6,lookAhead=11;
 const cyaw=p.heading+facingYaw;
 const carX=p.x+Math.cos(p.heading)*lateral, carZ=p.z-Math.sin(p.heading)*lateral, carY=p.y;
 const eye=[carX-Math.sin(cyaw)*camBack, carY+camUp+Math.abs(p.curve)*4, carZ-Math.cos(cyaw)*camBack];
 const ctr=[carX+Math.sin(cyaw)*lookAhead, carY+1.2, carZ+Math.cos(cyaw)*lookAhead];
 if(shake>0){eye[0]+=(Math.random()-.5)*shake*.4;eye[1]+=(Math.random()-.5)*shake*.3}
 const view=m4lookAt(eye,ctr,[0,1,0]);
 const proj=m4perspective(62*D2R,W/Math.max(1,H),.4,340);
 gl.uniformMatrix4fv(U.view,false,view);
 gl.uniformMatrix4fv(U.proj,false,proj);
 gl.uniform3f(U.light,.45,.82,.35);
 gl.uniform3fv(U.fogColor,th.fog);
 gl.uniform1f(U.fogNear,60);gl.uniform1f(U.fogFar,230);
 gl.uniform1f(U.ambient,.5);

 drawRibbon(trk.mesh.sideL,th.sideL);
 drawRibbon(trk.mesh.sideR,th.sideR);
 drawRibbon(trk.mesh.road,th.road);
 drawRibbon(trk.mesh.lineL,th.line);
 drawRibbon(trk.mesh.lineR,th.line);
 drawRibbon(trk.mesh.lineC,[.95,.78,.25]);

 const near=pos-40,far=pos+230;
 for(const gt of trk.gates){
  let ds_=gt.s-pos;if(ds_<-trk.len/2)ds_+=trk.len;if(ds_>trk.len/2)ds_-=trk.len;
  if(ds_<-40||ds_>230)continue;
  drawGate(gt);
 }
 for(const pr of trk.props){
  let ds_=pr.s-pos;if(ds_<-trk.len/2)ds_+=trk.len;if(ds_>trk.len/2)ds_-=trk.len;
  if(ds_<-30||ds_>150)continue;
  drawMesh(GEO[pr.geom],pr.m,pr.color,pr.emissive);
 }
 for(const c of traffic){
  let ds_=c.s-pos;if(ds_<-trk.len/2)ds_+=trk.len;if(ds_>trk.len/2)ds_-=trk.len;
  if(ds_<-25||ds_>160)continue;
  const cp=trk.sampleAt(c.s);
  const cx=cp.x+Math.cos(cp.heading)*c.off,cz=cp.z-Math.sin(cp.heading)*c.off;
  c.spin+=(c.speed/12000*84)/WHEEL_R*0.016;
  drawCar(cx,cp.y,cz,cp.heading,0,c.color,0,c.spin,1);
 }
 drawCar(carX,carY,carZ,cyaw,-p.grade*.5,cars[state.car][1],steerVis*.5,wheelSpin,1);
}
function drawGate(gt){
 const th=trk.th,p=gt.p,half=th.half;
 const postH=gt.finish?9:7,beamH=gt.finish?1.4:.8,col=gt.finish?[.4,1,.6]:[.34,.9,.86];
 for(const side of[-1,1]){
  const m=m4build(p.x+Math.cos(p.heading)*(half+.4)*side,p.y+postH/2,p.z-Math.sin(p.heading)*(half+.4)*side,p.heading,0,.4,postH,.4);
  drawMesh(GEO.cyl,m,[.16,.15,.2],0);
 }
 const beamW=(half+.4)*2+.6;
 const bm=m4build(p.x,p.y+postH,p.z,p.heading,0,beamW,beamH,.5);
 drawMesh(GEO.box,bm,col,1);
}

/* ------------------------------------------------------------------ HUD */
function updateHUD(){
 const check=Math.min(12,Math.floor(state.progress*12)+1);
 const mph=Math.round(state.speed/12000*cars[state.car][2]);
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
 pos=0;lateral=0;shake=0;steerVis=0;wheelSpin=0;facingYaw=0;toastT=0;
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
 $('#app').classList.remove('racing');$('#hud').hidden=true;$('#boostHud').hidden=true;$('#touch').hidden=true;
 spawnTraffic(0);
}
function finish(){
 state.mode='finish';state.racing=false;state.started=false;
 $('#app').classList.remove('racing');$('#hud').hidden=true;$('#boostHud').hidden=true;$('#touch').hidden=true;
 const n=drivers[state.driver][0].split(' ')[0],tm=`${Math.floor(state.time/60)}:${String(Math.floor(state.time%60)).padStart(2,'0')}`;
 $('#finishCopy').innerHTML=`<p>SAFE ZONE REACHED</p><h2>YOU GOT THEM HOME.</h2><span>${n} carried the passenger through ${routes[state.route][0]} in ${tm}. The race never stopped.</span><div class="result-stats">12 / 12 CHECKPOINTS · ${state.passes} CLEAN OVERTAKES · ${Math.round(state.boost)}% SPARK REMAINING</div><button class="primary" id="again">RUN ANOTHER ROUTE <b>→</b></button>`;
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

/* --------------------------------------------------------------- RESIZE */
function resize(){
 const dpr=Math.min(devicePixelRatio||1,innerWidth>900?1.5:1.25);
 canvas.width=Math.max(2,Math.round(innerWidth*dpr));
 canvas.height=Math.max(2,Math.round(innerHeight*dpr));
}
addEventListener('resize',resize);

/* ---------------------------------------------------------------- START */
resize();selectUI();previewRoute();
let last=performance.now();
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(frame)}
requestAnimationFrame(frame);
})();
