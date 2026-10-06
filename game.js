(() => {
'use strict';
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=true;
const W=1600,H=900,WORLD_W=8200,GROUND=770;
const A=window.ASSETS||{},images={};
let leftToLoad=Object.keys(A).length;
if(!leftToLoad) ready();
for(const [k,src] of Object.entries(A)){const im=new Image();im.onload=im.onerror=()=>{if(--leftToLoad===0)ready()};im.src=src;images[k]=im;}

const keys={left:false,right:false,up:false,down:false,jump:false};
const pressed=new Set();
const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',Space:'jump'};
addEventListener('keydown',e=>{const k=keyMap[e.code];if(k){if(!keys[k])pressed.add(k);keys[k]=true;e.preventDefault();}
 if(e.code==='Digit1')setForm('normal'); if(e.code==='Digit2')setForm('ball'); if(e.code==='Digit3')setForm('cape'); if(e.code==='Digit4')setForm('box');
 if(e.code==='KeyQ')cycleForm(-1); if(e.code==='KeyE')cycleForm(1); if(e.code==='Enter'&&(mode==='title'||mode==='won'))startGame(); if(e.code==='KeyR'&&mode==='play')respawn();});
addEventListener('keyup',e=>{const k=keyMap[e.code];if(k){keys[k]=false;e.preventDefault();}});
for(const b of document.querySelectorAll('#touch [data-key]')){const k=b.dataset.key;const dn=e=>{e.preventDefault();if(!keys[k])pressed.add(k);keys[k]=true};const up=e=>{e.preventDefault();keys[k]=false};b.addEventListener('pointerdown',dn);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up)}
for(const b of document.querySelectorAll('#touch [data-form]'))b.addEventListener('pointerdown',e=>{e.preventDefault();setForm(b.dataset.form)});
canvas.addEventListener('pointerdown',()=>{if(mode==='title')startGame()});

let audioCtx=null;
function tone(freq=440,d=.08,type='sine',gain=.04){try{audioCtx||=new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.value=gain;o.connect(g);g.connect(audioCtx.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+d);o.stop(audioCtx.currentTime+d)}catch{}}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

let mode='title',time=0,last=0,cameraX=0,shake=0,message='',messageT=0,unlockFreeze=0;
const formDims={normal:[108,104],ball:[88,88],cape:[144,92],box:[100,94]};
const player={x:180,y:GROUND-104,vx:0,vy:0,face:1,form:'normal',onGround:false,standing:null,wall:0,inv:0,ballAngle:0,cans:0,rare:0,
 unlocked:{normal:true,ball:false,cape:false,box:false},checkpoint:{x:180,y:GROUND-104},idleT:0,airT:0,landT:0,boxTransition:null,boxT:0,pendingForm:null};
function dims(f=player.form){return{w:formDims[f][0],h:formDims[f][1]}}
function pRect(x=player.x,y=player.y,f=player.form){const d=dims(f);return{x,y,w:d.w,h:d.h}}
function beginBoxTransition(enter,target='normal'){
 if(!player.onGround)return;
 player.boxTransition=enter?'enter':'exit';player.boxT=0;player.pendingForm=target;player.vx=0;
 if(enter){const old=dims();const foot=player.y+old.h;player.form='box';player.y=foot-dims('box').h;}
}
function setForm(f){
 if(mode!=='play'||!player.unlocked[f]||player.form===f||player.boxTransition)return;
 if(f==='box'){beginBoxTransition(true);return;}
 if(player.form==='box'){beginBoxTransition(false,f);return;}
 const old=dims(),foot=player.y+old.h;player.form=f;player.y=foot-dims().h;player.standing=null;tone({normal:310,ball:170,cape:520}[f]||260,.08,'triangle');
}
function cycleForm(dir){const arr=['normal','ball','cape','box'].filter(f=>player.unlocked[f]);let i=arr.indexOf(player.form);if(i<0)i=0;setForm(arr[(i+dir+arr.length)%arr.length])}

const platforms=[],movers=[],breakables=[],fans=[],checkpoints=[],pickups=[],mice=[],unlocks=[];
function P(x,y,w,h=36,kind='normal'){platforms.push({x,y,w,h,kind,id:'p'+platforms.length})}
function M(x,y,w,h,axis,range,speed){movers.push({x,y,w,h,axis,range,speed,baseX:x,baseY:y,px:x,py:y,phase:Math.random()*6.28,id:'m'+movers.length})}
function B(x,y,w,h=26){breakables.push({x,y,w,h,stage:0,timer:0,broken:false,respawn:0,id:'b'+breakables.length})}
function Fan(x,y,w,h,power=1180,dx=.65,dy=-.8){fans.push({x,y,w,h,power,dx,dy})}
function CP(x){checkpoints.push({x,y:GROUND,active:false,anim:0})}
function PU(x,y,type='can'){pickups.push({x,y,type,got:false})}
function Mouse(x,min,max){mice.push({x,y:GROUND-70,min,max,v:88,w:98,h:70,alive:true,deadTimer:0,vx:0,vy:0,rot:0})}
function U(x,y,form,label){unlocks.push({x,y,form,label})}

function buildLevel(){
 P(0,GROUND,WORLD_W,130,'ground');
 // 0–1:15 — базовое движение + stomp
 P(330,645,210,38);P(665,565,180,38);P(940,505,165,38);PU(730,500);Mouse(1190,1130,1470);CP(1510);U(1630,680,'ball','ШАР');
 // 1:15–2:45 — шар + стекло
 B(1880,630,165);B(2110,575,165);B(2350,520,165);P(2590,455,180,38);PU(2670,390);M(2880,585,180,40,'x',120,1.4);CP(3180);
 // 2:45–4:20 — плащ + вентиляторы
 U(3330,680,'cape','ПЛАЩ');P(3530,580,170,38);Fan(3780,590,225,180);P(4110,465,180,38);M(4380,455,190,44,'y',110,1.05);PU(4440,355,'rare');P(4680,565,190,38);Mouse(4930,4860,5180);CP(5240);
 // 4:20–6:00 — коробка и stealth corridor
 U(5420,680,'box','КОРОБКА');P(5590,585,740,32,'ceiling');Mouse(5680,5630,5840);Mouse(5910,5860,6070);Mouse(6140,6090,6270);PU(6210,700);P(6410,560,180,38);CP(6640);
 // 6:00–8:30 — комбо-финал
 M(6820,585,180,44,'x',145,1.3);B(7110,540,175);Fan(7330,585,230,185);P(7610,475,185,38);Mouse(7850,7780,8010);
 // хозяйка/колени
 P(7960,635,220,28,'lap');
}
buildLevel();
const owner={x:7780,y:145,lapX:7960,lapY:635,trigger:{x:7880,y:450,w:300,h:320}};

function resetTransient(){player.idleT=0;player.airT=0;player.landT=0;player.boxTransition=null;player.boxT=0;player.pendingForm=null}
function startGame(){mode='play';time=0;cameraX=0;shake=0;message='';messageT=0;unlockFreeze=0;player.x=180;player.y=GROUND-dims('normal').h;player.vx=player.vy=0;player.face=1;player.form='normal';player.onGround=false;player.cans=0;player.rare=0;player.unlocked={normal:true,ball:false,cape:false,box:false};player.checkpoint={x:180,y:GROUND-dims('normal').h};player.inv=0;resetTransient();for(const p of pickups)p.got=false;for(const c of checkpoints){c.active=false;c.anim=0}for(const b of breakables){b.stage=0;b.timer=0;b.broken=false;b.respawn=0}for(const m of mice){m.alive=true;m.deadTimer=0;m.vx=0;m.vy=0;m.rot=0;m.y=GROUND-m.h}tone(392,.12,'triangle')}
function respawn(){player.form='normal';player.x=player.checkpoint.x;player.y=player.checkpoint.y;player.vx=player.vy=0;player.inv=.8;shake=7;resetTransient();tone(120,.18,'sawtooth',.025)}
function unlock(u){if(player.unlocked[u.form])return;player.unlocked[u.form]=true;message='НОВАЯ ФОРМА: '+u.label;messageT=2.2;unlockFreeze=.42;tone(523,.08,'triangle');setTimeout(()=>tone(659,.12,'triangle'),70)}
function solids(){return platforms.concat(movers).concat(breakables.filter(b=>!b.broken))}

function updateMovers(dt){for(const m of movers){m.px=m.x;m.py=m.y;const s=Math.sin(time*m.speed+m.phase);if(m.axis==='x')m.x=m.baseX+s*m.range;else m.y=m.baseY+s*m.range}}
function updateBreakables(dt){for(const b of breakables){if(b.broken){b.respawn-=dt;if(b.respawn<=0){b.broken=false;b.stage=0;b.timer=0}}else if(b.timer>0){b.timer+=dt;b.stage=clamp(Math.floor(b.timer/.12),0,4);if(b.timer>=.60){b.broken=true;b.respawn=2.8;b.timer=0;b.stage=4;shake=5;tone(95,.11,'square',.02)}}}}
function updateMice(dt){for(const m of mice){if(m.alive){m.x+=m.v*dt;if(m.x<m.min){m.x=m.min;m.v=Math.abs(m.v)}if(m.x>m.max){m.x=m.max;m.v=-Math.abs(m.v)}}else if(m.deadTimer>0){m.deadTimer-=dt;m.x+=m.vx*dt;m.y+=m.vy*dt;m.vy+=1180*dt;m.rot+=7.8*dt}}}

function finishBoxTransition(dt){if(!player.boxTransition)return false;player.boxT+=dt;player.vx=0;if(player.boxT>=.38){if(player.boxTransition==='exit'){const foot=player.y+dims('box').h;player.form=player.pendingForm||'normal';player.y=foot-dims().h;tone(300,.06,'triangle')}else tone(180,.06,'square');player.boxTransition=null;player.pendingForm=null;player.boxT=0}return true}

function update(dt){
 time+=dt;if(messageT>0)messageT-=dt;if(shake>0)shake=Math.max(0,shake-dt*24);if(player.inv>0)player.inv-=dt;if(player.landT>0)player.landT-=dt;for(const c of checkpoints)if(c.active&&c.anim<1)c.anim+=dt;
 updateMovers(dt);updateBreakables(dt);updateMice(dt);
 if(unlockFreeze>0){unlockFreeze-=dt;pressed.clear();return}
 if(finishBoxTransition(dt)){pressed.clear();return}
 const wasOnGround=player.onGround;const d=dims();const wasStanding=player.standing;player.standing=null;player.wall=0;
 if(wasStanding){const m=movers.find(q=>q.id===wasStanding);if(m){player.x+=m.x-m.px;player.y+=m.y-m.py}}
 const dir=(keys.right?1:0)-(keys.left?1:0);if(dir)player.face=dir;
 let accel=2200,max=390,fric=.80,jump=650,gravity=1780;
 if(player.form==='ball'){accel=1550;max=650;fric=.94;jump=665;player.ballAngle+=player.vx*dt/44}
 if(player.form==='cape'){accel=1750;max=435;fric=.85;jump=620;if(keys.jump&&player.vy>20)gravity=360}
 if(player.form==='box'){accel=700;max=130;fric=.72;jump=0;gravity=1780}
 if(dir)player.vx+=dir*accel*dt;else player.vx*=Math.pow(fric,dt*60);player.vx=clamp(player.vx,-max,max);
 if(pressed.has('jump')&&player.onGround&&jump>0){player.vy=-jump;player.onGround=false;player.airT=0;player.idleT=0;tone(player.form==='ball'?180:280,.045,'triangle',.02)}
 if(keys.jump&&player.vy<0&&player.form==='normal')gravity*=.58;player.vy+=gravity*dt;if(player.form==='cape'&&keys.jump&&player.vy>165)player.vy=165;
 for(const f of fans)if(player.form==='cape'&&overlap(pRect(),f)){player.vx+=f.dx*f.power*dt*.45;player.vy+=f.dy*f.power*dt;player.vx=clamp(player.vx,-540,540);player.vy=Math.max(player.vy,-560)}
 const oldX=player.x;player.x+=player.vx*dt;let pr=pRect();
 for(const s of solids()){if(s.kind==='lap'&&mode==='play')continue;if(!overlap(pr,s))continue;const prevR=oldX+d.w,prevL=oldX;if(player.vx>0&&prevR<=s.x+14){player.x=s.x-d.w;player.vx=0;player.wall=1}else if(player.vx<0&&prevL>=s.x+s.w-14){player.x=s.x+s.w;player.vx=0;player.wall=-1}pr=pRect()}
 const oldY=player.y,oldFoot=oldY+d.h;player.y+=player.vy*dt;player.onGround=false;pr=pRect();
 for(const s of solids()){if(s.kind==='lap'&&mode==='play')continue;if(!overlap(pr,s))continue;if(player.vy>=0&&oldFoot<=s.y+16){player.y=s.y-d.h;player.vy=0;player.onGround=true;player.standing=s.id||null;if(!wasOnGround)player.landT=.10;if(s.id&&s.id[0]==='b'){const b=breakables.find(q=>q.id===s.id);if(b&&!b.broken&&b.timer===0)b.timer=.001}}else if(player.vy<0&&oldY>=s.y+s.h-16){player.y=s.y+s.h;player.vy=0}pr=pRect()}
 if(!player.onGround){player.airT+=dt;player.idleT=0}else if(player.form==='normal'&&Math.abs(player.vx)<18&&!dir){player.idleT+=dt}else player.idleT=0;
 if(player.y>H+220){respawn();pressed.clear();return}
 for(const c of checkpoints){if(!c.active&&overlap(pRect(),{x:c.x-32,y:GROUND-130,w:72,h:130})){for(const q of checkpoints)q.active=false;c.active=true;c.anim=.001;player.checkpoint={x:c.x,y:GROUND-dims('normal').h};message='ЧЕКПОИНТ';messageT=1.3;tone(588,.08,'triangle')}}
 for(const p of pickups)if(!p.got&&overlap(pRect(),{x:p.x-34,y:p.y-34,w:68,h:68})){p.got=true;if(p.type==='rare')player.rare++;else player.cans++;shake=3;tone(p.type==='rare'?720:480,.1,'triangle',.03)}
 for(const u of unlocks)if(!player.unlocked[u.form]&&overlap(pRect(),{x:u.x-48,y:u.y-48,w:96,h:96}))unlock(u);
 const prev=pRect(player.x,oldY);const now=pRect();
 for(const m of mice){if(!m.alive)continue;const mr={x:m.x,y:m.y,w:m.w,h:m.h};if(!overlap(now,mr))continue;if(player.form==='box')continue;const stomp=player.vy>110&&prev.y+prev.h<=m.y+14;if(stomp){m.alive=false;m.deadTimer=1.15;m.vx=180*player.face;m.vy=-380;m.rot=Math.PI;player.vy=-430;shake=4;tone(240,.06,'square',.03)}else if(player.inv<=0){respawn();pressed.clear();return}}
 if(overlap(pRect(),owner.trigger)){mode='cutscene';player.form='normal';player.vx=player.vy=0;player.x=owner.lapX+48;player.y=owner.lapY-dims('normal').h+4;time=0}
 pressed.clear();cameraX=clamp(player.x-W*.34,0,WORLD_W-W);
}

function updateCutscene(dt){time+=dt;cameraX+=(owner.x-300-cameraX)*Math.min(1,dt*2.3);cameraX=clamp(cameraX,0,WORLD_W-W);if(time>4.2)mode='won'}

function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(r,w/2,h/2))}
function drawBackground(){if(images.bg?.width)ctx.drawImage(images.bg,0,0,W,H);else{ctx.fillStyle='#ead0ac';ctx.fillRect(0,0,W,H)}}
function drawGround(p){const im=images.ground;if(!im?.width)return;const h=82,w=im.width*(h/im.height);for(let x=p.x;x<p.x+p.w+w;x+=w-2)ctx.drawImage(im,x,p.y-8,w,h)}
function drawPlatform(p){if(p.kind==='ground')return;const im=images.platform;if(!im?.width)return;const h=p.kind==='ceiling'?42:44;ctx.save();if(p.kind==='ceiling'){ctx.translate(p.x,p.y+h);ctx.scale(1,-1);ctx.drawImage(im,0,0,p.w,h)}else ctx.drawImage(im,p.x,p.y-8,p.w,h);ctx.restore()}
function drawMover(m){if(images.moving?.width)ctx.drawImage(images.moving,m.x,m.y-16,m.w,m.h+42)}
function drawBreak(b){if(b.broken||!images.glass?.width)return;const sw=images.glass.width/5;ctx.drawImage(images.glass,sw*clamp(b.stage,0,4),0,sw,images.glass.height,b.x,b.y-10,b.w,b.h+32)}
function drawFan(f){if(images.fan?.width)ctx.drawImage(images.fan,f.x-28,f.y-46,f.w+80,f.h+102);ctx.save();ctx.globalAlpha=.17;ctx.strokeStyle='#d4f1ff';for(let i=0;i<3;i++){const x=f.x+60+i*32+Math.sin(time*2+i)*8;ctx.beginPath();ctx.moveTo(x,f.y+f.h);ctx.bezierCurveTo(x+50,f.y+f.h-60,x+115,f.y+40,f.x+f.w-5,f.y-30);ctx.lineWidth=15-i*3;ctx.stroke()}ctx.restore()}
function drawAtlas(im,count,frame,cx,foot,size,flip=1,rot=0){if(!im?.width)return;const sw=im.width/count,sh=im.height;ctx.save();ctx.translate(cx,foot);ctx.scale(flip,1);ctx.rotate(rot);ctx.drawImage(im,sw*frame,0,sw,sh,-size/2,-size,size,size);ctx.restore()}
function drawCheckpoint(c){if(!images.flag?.width)return;const f=c.active?Math.min(5,Math.floor(c.anim/.08)):0;drawAtlas(images.flag,6,f,c.x,GROUND+4,138,1);if(c.active){ctx.save();ctx.globalAlpha=.18+.15*Math.sin(time*7);ctx.fillStyle='#ffd85d';ctx.beginPath();ctx.arc(c.x,GROUND-82,48,0,Math.PI*2);ctx.fill();ctx.restore()}}
function drawPickup(p){if(p.got)return;const im=p.type==='rare'?images.rare:images.can,s=p.type==='rare'?88:68;if(!im?.width)return;ctx.save();ctx.translate(p.x,p.y+Math.sin(time*3+p.x)*7);ctx.shadowColor=p.type==='rare'?'#ffd34f':'#f2b66b';ctx.shadowBlur=p.type==='rare'?24:10;ctx.drawImage(im,-s/2,-s/2,s,s);ctx.restore()}
function drawUnlock(u){if(player.unlocked[u.form]||!images.upgrade?.width)return;const bob=Math.sin(time*2.6+u.x*.01)*7,glow=18+(Math.sin(time*5+u.x*.02)*.5+.5)*22;ctx.save();ctx.translate(u.x,u.y+bob);ctx.shadowColor='#ffd84d';ctx.shadowBlur=glow;ctx.globalAlpha=.22;ctx.fillStyle='#ffd84d';ctx.beginPath();ctx.arc(0,0,54+glow*.12,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.drawImage(images.upgrade,-47,-47,94,94);ctx.shadowBlur=0;ctx.fillStyle='#fff1cf';ctx.font='900 14px system-ui';ctx.textAlign='center';ctx.fillText(u.label,0,67);ctx.restore()}
function drawMouse(m){if(!images.mouse?.width)return;ctx.save();if(m.alive){const flip=m.v<0?-1:1;ctx.translate(m.x+(flip<0?m.w:0),m.y);ctx.scale(flip,1);ctx.drawImage(images.mouse,0,-4,m.w,m.h+10)}else if(m.deadTimer>0){ctx.translate(m.x+m.w/2,m.y+m.h/2);ctx.rotate(m.rot);ctx.scale(1,-1);ctx.drawImage(images.mouse,-m.w/2,-m.h/2,m.w,m.h)}ctx.restore()}
function drawOwner(){if(images.owner?.width)ctx.drawImage(images.owner,owner.x,owner.y,580,720)}
function drawHand(){if(!images.hand?.width)return;const bob=Math.sin(time*6)*8;ctx.save();ctx.translate(player.x+74,player.y-68+bob);ctx.rotate(-.22+.04*Math.sin(time*6));ctx.drawImage(images.hand,-40,-35,180,180);ctx.restore()}

function drawNormalPlayer(){const d=dims(),cx=player.x+d.w/2,foot=player.y+d.h+7,flip=player.face<0?-1:1;
 if(player.landT>0){drawAtlas(images.jump,8,7,cx,foot,142,flip);return}
 if(!player.onGround){let f=3;if(player.vy<-480)f=2;else if(player.vy<-220)f=3;else if(player.vy<80)f=4;else if(player.vy<330)f=5;else f=6;drawAtlas(images.jump,8,f,cx,foot,148,flip);return}
 if(Math.abs(player.vx)>32){const fps=8+Math.min(6,Math.abs(player.vx)/75),f=Math.floor(time*fps)%9;drawAtlas(images.run,9,f,cx,foot,144,flip);return}
 if(player.idleT>.18){const f=clamp(Math.floor((player.idleT-.18)/.07),0,7);drawAtlas(images.sit,8,f,cx,foot,146,flip);return}
 ctx.save();ctx.translate(cx,player.y+d.h/2);if(flip<0)ctx.scale(-1,1);ctx.drawImage(images.cat,-67,-66,134,132);ctx.restore()}
function drawPlayer(){if(player.inv>0&&Math.floor(player.inv*12)%2===0)return;const d=dims(),cx=player.x+d.w/2,foot=player.y+d.h+7,flip=player.face<0?-1:1;
 if(player.form==='normal'){drawNormalPlayer();return}
 if(player.form==='ball'){ctx.save();ctx.translate(cx,player.y+d.h/2);if(flip<0)ctx.scale(-1,1);ctx.rotate(player.ballAngle*player.face);ctx.drawImage(images.ball,-47,-47,94,94);ctx.restore();return}
 if(player.form==='cape'){ctx.save();ctx.translate(cx,player.y+d.h/2);if(flip<0)ctx.scale(-1,1);ctx.rotate(clamp(player.vy/1000,-.15,.15));ctx.drawImage(images.cape,-80,-53,160,106);ctx.restore();return}
 if(player.form==='box'){
   if(player.boxTransition){const t=clamp(player.boxT/.38,0,1);let f=Math.min(6,Math.floor(t*7));if(player.boxTransition==='exit')f=6-f;drawAtlas(images.boxcover,7,f,cx,foot,142,flip);return}
   if(Math.abs(player.vx)>10){const f=Math.floor(time*8)%6;drawAtlas(images.boxwalk,6,f,cx,foot,138,flip);return}
   drawAtlas(images.boxcover,7,6,cx,foot,138,flip);return
 }}
function drawWorld(){ctx.save();ctx.translate(-cameraX,0);for(const p of platforms)if(p.kind==='ground')drawGround(p);drawOwner();for(const p of platforms)if(p.kind!=='ground')drawPlatform(p);for(const m of movers)drawMover(m);for(const b of breakables)drawBreak(b);for(const f of fans)drawFan(f);for(const c of checkpoints)drawCheckpoint(c);for(const p of pickups)drawPickup(p);for(const u of unlocks)drawUnlock(u);for(const m of mice)drawMouse(m);drawPlayer();if(mode==='cutscene'||mode==='won')drawHand();ctx.restore()}
function drawHUD(){ctx.save();ctx.fillStyle='#fff5e6e8';ctx.strokeStyle='#60483d';ctx.lineWidth=3;rr(28,24,610,88,22);ctx.fill();ctx.stroke();ctx.fillStyle='#44342e';ctx.font='800 27px system-ui';ctx.fillText('🥫 '+player.cans+'    ✨ '+player.rare+'×3',52,62);ctx.font='700 20px system-ui';ctx.fillText('1 КОТ',52,95);const forms=[['ball','2 ШАР'],['cape','3 ПЛАЩ'],['box','4 КОРОБКА']];let x=160;for(const[f,l]of forms){ctx.fillStyle=player.unlocked[f]?(player.form===f?'#d85d50':'#806452'):'#b9a99c';ctx.globalAlpha=player.unlocked[f]?1:.45;rr(x,73,f==='box'?135:105,29,10);ctx.fill();ctx.fillStyle='white';ctx.font='800 14px system-ui';ctx.fillText(l,x+9,94);x+=f==='box'?145:115}ctx.globalAlpha=1;ctx.fillStyle='#4f4038';rr(1160,35,390,22,11);ctx.fill();ctx.fillStyle='#e16652';rr(1160,35,390*Math.min(1,player.x/8000),22,11);ctx.fill();ctx.fillStyle='#44342e';ctx.font='700 16px system-ui';ctx.textAlign='right';ctx.fillText('К ЗОЗЯЦКЕ →',1548,84);ctx.textAlign='left';if(messageT>0){ctx.globalAlpha=Math.min(1,messageT*3);ctx.fillStyle='#382c29e8';rr(W/2-230,130,460,66,20);ctx.fill();ctx.fillStyle='#fff4e5';ctx.font='900 26px system-ui';ctx.textAlign='center';ctx.fillText(message,W/2,172)}if(mode==='cutscene'||mode==='won'){ctx.globalAlpha=1;ctx.fillStyle='rgba(55,40,34,.72)';rr(W/2-205,28,410,46,18);ctx.fill();ctx.fillStyle='#fff0e0';ctx.textAlign='center';ctx.font='900 22px system-ui';ctx.fillText('Зозяцка гладит котика',W/2,58);if(mode==='won'){ctx.fillStyle='rgba(255,245,231,.95)';rr(W-280,H-76,250,48,16);ctx.fill();ctx.fillStyle='#533d31';ctx.font='800 18px system-ui';ctx.fillText('ENTER — ещё раз',W-155,H-45)}}ctx.restore()}
function drawTitle(){drawBackground();ctx.fillStyle='#2e2421aa';ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(W/2,H/2-80);ctx.fillStyle='#fff0dd';ctx.strokeStyle='#5a3e33';ctx.lineWidth=8;rr(-430,-240,860,500,42);ctx.fill();ctx.stroke();ctx.textAlign='center';ctx.fillStyle='#d85d50';ctx.font='1000 68px system-ui';ctx.fillText('К ЗОЗЯЦКЕ!',0,-125);ctx.fillStyle='#44342e';ctx.font='700 26px system-ui';ctx.fillText('кот, шар, плащ и стелс-коробка',0,-72);ctx.font='650 24px system-ui';ctx.fillText('A/D или ←/→ — идти    SPACE — прыгать',0,10);ctx.fillText('прыжок сверху на мышь — stomp',0,50);ctx.fillText('в коробке мыши тебя не замечают',0,90);ctx.fillStyle='#d85d50';rr(-190,145,380,74,22);ctx.fill();ctx.fillStyle='white';ctx.font='900 30px system-ui';ctx.fillText('НАЖМИ ENTER',0,193);ctx.restore()}
function render(){ctx.clearRect(0,0,W,H);const sx=shake?(Math.random()-.5)*shake:0,sy=shake?(Math.random()-.5)*shake:0;ctx.save();ctx.translate(sx,sy);drawBackground();if(mode==='title')drawTitle();else{drawWorld();drawHUD()}ctx.restore()}
function loop(ts){const dt=Math.min(.033,(ts-last)/1000||0);last=ts;if(mode==='play')update(dt);else if(mode==='cutscene')updateCutscene(dt);render();requestAnimationFrame(loop)}
function ready(){const l=document.getElementById('loading');if(l)l.style.display='none';requestAnimationFrame(loop)}
})();