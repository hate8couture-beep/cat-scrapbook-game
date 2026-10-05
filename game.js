(() => {
'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
const W=1600,H=900,WORLD_W=10000,GROUND=760;

const ASSETS=window.ASSETS||{};
const images={};
let loaded=0;
for(const [k,src] of Object.entries(ASSETS)){
  const im=new Image(); im.onload=()=>{ if(++loaded===Object.keys(ASSETS).length) ready(); }; im.onerror=()=>{ if(++loaded===Object.keys(ASSETS).length) ready(); }; im.src=src; images[k]=im;
}

const keys={left:false,right:false,up:false,down:false,jump:false};
const pressed=new Set();
const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',Space:'jump'};
addEventListener('keydown',e=>{
  if(keyMap[e.code]){ if(!keys[keyMap[e.code]]) pressed.add(keyMap[e.code]); keys[keyMap[e.code]]=true; e.preventDefault(); }
  if(e.code==='Digit1') setForm('normal');
  if(e.code==='Digit2') setForm('ball');
  if(e.code==='Digit3') setForm('cape');
  if(e.code==='Digit4') setForm('jelly');
  if(e.code==='KeyQ') cycleForm(-1);
  if(e.code==='KeyE') cycleForm(1);
  if(e.code==='Enter' && mode!=='play') startGame();
  if(e.code==='KeyR' && mode==='play') respawn();
});
addEventListener('keyup',e=>{ if(keyMap[e.code]){keys[keyMap[e.code]]=false;e.preventDefault();}});

for(const b of document.querySelectorAll('#touch [data-key]')){
  const k=b.dataset.key; const down=e=>{e.preventDefault(); if(!keys[k]) pressed.add(k);keys[k]=true;}; const up=e=>{e.preventDefault();keys[k]=false;};
  b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up);
}
for(const b of document.querySelectorAll('#touch [data-form]')) b.addEventListener('pointerdown',e=>{e.preventDefault();setForm(b.dataset.form)});
canvas.addEventListener('pointerdown',()=>{ if(mode!=='play') startGame(); });

let mode='title', last=0, time=0, cameraX=0, shake=0, message='', messageT=0, unlockFreeze=0, petT=0;
let audioCtx=null;
function tone(freq=440,d=.08,type='sine',gain=.04){
  try{ audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.value=gain;o.connect(g);g.connect(audioCtx.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+d);o.stop(audioCtx.currentTime+d);}catch{}
}

const formDims={normal:[108,104],ball:[88,88],cape:[148,96],jelly:[148,46]};
const player={x:180,y:GROUND-104,vx:0,vy:0,form:'normal',face:1,onGround:false,standing:null,wall:0,inv:0,ballAngle:0,unlocked:{normal:true,ball:false,cape:false,jelly:false},cans:0,rare:0,checkpoint:{x:180,y:GROUND-104},trail:[]};
function dims(form=player.form){return {w:formDims[form][0],h:formDims[form][1]};}
function setForm(f){
  if(mode!=='play'||!player.unlocked[f]||player.form===f) return;
  const old=dims(), foot=player.y+old.h; player.form=f; const n=dims(); player.y=foot-n.h; player.standing=null; tone({normal:310,ball:170,cape:520,jelly:240}[f],.08,'triangle');
}
function cycleForm(dir){ const arr=['normal','ball','cape','jelly'].filter(f=>player.unlocked[f]); let i=arr.indexOf(player.form);setForm(arr[(i+dir+arr.length)%arr.length]); }

const platforms=[];
const ramps=[];
const movers=[];
const breakables=[];
const hazards=[];
const updrafts=[];
const checkpoints=[];
const pickups=[];
const mice=[];
const unlocks=[];
function P(x,y,w,h=40,kind='card'){platforms.push({x,y,w,h,kind,id:'p'+platforms.length});}
function R(x,y,w,h,dir=1){ramps.push({x,y,w,h,dir,id:'r'+ramps.length});}
function M(x,y,w,h,axis,range,speed,kind='wood'){movers.push({x,y,w,h,baseX:x,baseY:y,axis,range,speed,phase:Math.random()*6.28,kind,id:'m'+movers.length,px:x,py:y});}
function B(x,y,w,h=34){breakables.push({x,y,w,h,kind:'break',id:'b'+breakables.length,t:0,down:0});}

[[0,920],[1050,1730],[1800,3270],[3470,4320],[4690,5510],[5740,6500],[6760,8110],[8350,10000]].forEach(([x,e])=>P(x,GROUND,e-x,140,'floor'));

P(240,635,250,34,'fabric');
P(560,555,220,32,'wood');
M(890,620,145,28,'x',105,1.6,'wood');
P(1110,575,190,30,'book');
P(1370,520,220,30,'book');
pickups.push({x:650,y:500,type:'can',got:false});

unlocks.push({x:1775,y:670,form:'ball',label:'ШАР'});
R(1840,650,360,110,1);
R(2260,650,330,110,-1);
B(2680,630,170);
B(2880,585,170);
M(3120,570,170,30,'y',110,1.4,'wood');
P(3160,430,220,28,'wood');
pickups.push({x:3230,y:365,type:'can',got:false});
checkpoints.push({x:3000,y:665,active:false});

P(3580,650,220,30,'card');
P(3870,575,190,30,'card');
P(4080,500,190,30,'wood');
unlocks.push({x:4250,y:440,form:'cape',label:'ПЛАЩ'});

hazards.push({x:4320,y:760,w:370,h:140,type:'pit'});
P(4380,395,210,28,'wood');
updrafts.push({x:4460,y:245,w:170,h:515,power:1250});
P(4690,475,210,30,'wood');
M(4970,555,180,28,'y',130,1.1,'wood');
P(5240,430,220,30,'wood');
pickups.push({x:5305,y:365,type:'rare',got:false});
checkpoints.push({x:5400,y:665,active:false});

hazards.push({x:5850,y:738,w:260,h:30,type:'puddle'});
M(5900,620,160,26,'x',190,1.4,'sponge');
P(6190,555,190,28,'wood');

unlocks.push({x:6570,y:675,form:'jelly',label:'ЖЕЛЕ'});
P(6680,650,510,46,'roof');
P(6680,695,70,65,'wall');
P(7120,695,70,65,'wall');
pickups.push({x:6925,y:715,type:'can',got:false});

P(7290,430,72,330,'wall');
P(7290,400,400,32,'wood');
P(7640,540,270,28,'wood');
checkpoints.push({x:8050,y:665,active:false});

R(8200,650,330,110,1);
hazards.push({x:8530,y:760,w:360,h:140,type:'pit'});
updrafts.push({x:8620,y:300,w:180,h:460,power:1050});
P(8800,530,230,28,'wood');
P(9010,650,290,46,'roof');
P(9010,695,55,65,'wall');
P(9245,695,55,65,'wall');

P(9360,615,390,34,'knee');

mice.push({x:1470,y:GROUND-42,min:1350,max:1690,v:75,w:66,h:42});
mice.push({x:3720,y:GROUND-42,min:3530,max:4150,v:95,w:66,h:42});
mice.push({x:7850,y:GROUND-42,min:7700,max:8070,v:90,w:66,h:42});

function startGame(){
  mode='play';
  player.x=180;
  player.y=GROUND-dims().h;
  player.vx=player.vy=0;
  player.form='normal';
  player.cans=0;
  player.rare=0;
  player.unlocked={normal:true,ball:false,cape:false,jelly:false};
  player.checkpoint={x:180,y:GROUND-104};
  player.inv=0;
  cameraX=0;
  petT=0;

  for(const p of pickups)p.got=false;
  for(const c of checkpoints)c.active=false;
  for(const b of breakables){b.t=0;b.down=0;}

  tone(392,.12,'triangle');
}

function respawn(){
  const d=dims('normal');
  player.form='normal';
  player.x=player.checkpoint.x;
  player.y=player.checkpoint.y??GROUND-d.h;
  player.vx=0;
  player.vy=0;
  player.inv=.8;
  shake=7;
  tone(120,.18,'sawtooth',.025);
}

function unlock(u){
  if(player.unlocked[u.form])return;
  player.unlocked[u.form]=true;
  message='НОВАЯ ФОРМА: '+u.label;
  messageT=2.4;
  unlockFreeze=.45;
  tone(523,.08,'triangle');
  setTimeout(()=>tone(659,.12,'triangle'),70);
}

function rectsOverlap(a,b){
  return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
}

function playerRect(){
  const d=dims();
  return{x:player.x,y:player.y,w:d.w,h:d.h};
}

function activeSolids(){
  return platforms.concat(movers).concat(breakables.filter(b=>!b.down));
}

function update(dt){
  time+=dt;

  if(messageT>0)messageT-=dt;
  if(shake>0)shake=Math.max(0,shake-dt*24);
  if(player.inv>0)player.inv-=dt;

  if(unlockFreeze>0){
    unlockFreeze-=dt;
    return;
  }

  for(const m of movers){
    m.px=m.x;
    m.py=m.y;

    const s=Math.sin(time*m.speed+m.phase);

    if(m.axis==='x')m.x=m.baseX+s*m.range;
    else m.y=m.baseY+s*m.range;
  }

  for(const b of breakables){
    if(b.down>0){
      b.down-=dt;

      if(b.down<=0){
        b.down=0;
        b.t=0;
      }
    }else if(b.t>0){
      b.t+=dt;

      if(b.t>.72){
        b.down=3.0;
        shake=5;
        tone(95,.12,'square',.02);
      }
    }
  }

  for(const m of mice){
    m.x+=m.v*dt;

    if(m.x<m.min){
      m.x=m.min;
      m.v=Math.abs(m.v);
    }

    if(m.x>m.max){
      m.x=m.max;
      m.v=-Math.abs(m.v);
    }
  }

  const d=dims();
  const wasStanding=player.standing;

  player.standing=null;
  player.wall=0;

  if(wasStanding){
    const m=movers.find(q=>q.id===wasStanding);

    if(m){
      player.x+=m.x-m.px;
      player.y+=m.y-m.py;
    }
  }

  const left=keys.left?1:0;
  const right=keys.right?1:0;
  const dir=right-left;

  if(dir)player.face=dir;

  let accel=2200;
  let max=390;
  let fric=0.80;
  let jump=650;
  let gravity=1780;

  if(player.form==='ball'){
    accel=1550;
    max=650;
    fric=.94;
    jump=665;
    player.ballAngle+=player.vx*dt/44;
  }

  if(player.form==='cape'){
    accel=1750;
    max=430;
    fric=.84;
    jump=620;

    if(keys.jump&&player.vy>20)gravity=360;
  }

  if(player.form==='jelly'){
    accel=1600;
    max=255;
    fric=.76;
    jump=480;
    gravity=1500;
  }

  if(dir)player.vx+=dir*accel*dt;
  else player.vx*=Math.pow(fric,dt*60);

  player.vx=Math.max(-max,Math.min(max,player.vx));

  if(pressed.has('jump')&&player.onGround){
    player.vy=-jump;
    player.onGround=false;
    tone(player.form==='ball'?180:280,.045,'triangle',.02);
  }

  if(player.form==='jelly'&&player.wall&&keys.up){
    player.vy=-250;
    gravity=120;
  }

  if(player.form==='jelly'&&player.wall&&keys.down){
    player.vy=220;
    gravity=120;
  }

  if(keys.jump&&player.vy<0&&player.form!=='jelly'){
    gravity*=.58;
  }

  player.vy+=gravity*dt;

  if(player.form==='cape'&&keys.jump&&player.vy>150){
    player.vy=150;
  }

  const pr0=playerRect();

  if(player.form==='cape'){
    for(const u of updrafts){
      if(rectsOverlap(pr0,u)){
        player.vy-=u.power*dt;

        if(player.vy<-520){
          player.vy=-520;
        }
      }
    }
  }

  const oldX=player.x;
  player.x+=player.vx*dt;

  let pr=playerRect();

  for(const s of activeSolids()){
    if(!rectsOverlap(pr,s))continue;

    const prevRight=oldX+d.w;
    const prevLeft=oldX;

    if(player.vx>0&&prevRight<=s.x+8){
      player.x=s.x-d.w;
      player.vx=0;
      player.wall=1;
    }else if(player.vx<0&&prevLeft>=s.x+s.w-8){
      player.x=s.x+s.w;
      player.vx=0;
      player.wall=-1;
    }

    pr=playerRect();
  }

  const oldY=player.y;
  const oldFoot=oldY+d.h;

  player.y+=player.vy*dt;
  player.onGround=false;
  pr=playerRect();

  for(const s of activeSolids()){
    if(!rectsOverlap(pr,s))continue;

    if(player.vy>=0&&oldFoot<=s.y+10){
      player.y=s.y-d.h;
      player.vy=0;
      player.onGround=true;
      player.standing=s.id;

      if(s.id[0]==='b'){
        const b=breakables.find(q=>q.id===s.id);
        if(b&&!b.t)b.t=.001;
      }
    }else if(player.vy<0&&oldY>=s.y+s.h-8){
      player.y=s.y+s.h;
      player.vy=0;
    }

    pr=playerRect();
  }

  if(player.vy>=0){
    const footX=player.x+d.w*.52;
    const footY=player.y+d.h;

    for(const r of ramps){
      if(footX<r.x||footX>r.x+r.w)continue;

      const t=(footX-r.x)/r.w;
      const fy=r.dir===1
        ? (r.y+r.h-r.h*t)
        : (r.y+r.h*t);

      if(
        footY>=fy-12 &&
        footY<=fy+32 &&
        oldFoot<=fy+28
      ){
        player.y=fy-d.h;
        player.vy=0;
        player.onGround=true;
        player.standing=r.id;
      }
    }
  }

  player.x=Math.max(
    0,
    Math.min(WORLD_W-d.w,player.x)
  );

  if(player.y>H+200){
    respawn();
  }

  pr=playerRect();

  for(const h of hazards){
    if(rectsOverlap(pr,h)){
      respawn();
    }
  }

  for(const c of checkpoints){
    if(!c.active&&player.x>c.x){
      for(const q of checkpoints){
        q.active=false;
      }

      c.active=true;

      player.checkpoint={
        x:c.x+25,
        y:GROUND-dims('normal').h
      };

      message='ЧЕКПОИНТ';
      messageT=1.3;
      tone(440,.08,'sine');
    }
  }

  for(const u of unlocks){
    if(
      Math.abs((player.x+d.w/2)-u.x)<70 &&
      Math.abs((player.y+d.h/2)-u.y)<110
    ){
      unlock(u);
    }
  }

  for(const p of pickups){
    if(p.got)continue;

    const hit={
      x:p.x-36,
      y:p.y-36,
      w:72,
      h:72
    };

    if(rectsOverlap(pr,hit)){
      p.got=true;

      if(p.type==='rare'){
        player.rare++;
        message='РЕДКАЯ КОНСЕРВА ×3!';
        messageT=1.8;
        tone(784,.1,'triangle');
        setTimeout(()=>tone(1047,.14,'triangle'),80);
      }else{
        player.cans++;
        message='КОНСЕРВА +1';
        messageT=.9;
        tone(660,.07,'triangle');
      }
    }
  }

  for(const m of mice){
    if(player.inv>0)break;

    const mr={
      x:m.x,
      y:m.y,
      w:m.w,
      h:m.h
    };

    if(rectsOverlap(pr,mr)){
      player.inv=.9;
      player.vx=(player.x<m.x?-420:420);
      player.vy=-330;
      shake=9;
      tone(125,.1,'square',.025);
    }
  }

  if(
    player.x>9380 &&
    player.y+d.h<=655 &&
    player.x<9770
  ){
    mode='won';
    petT=0;
    player.vx=player.vy=0;

    tone(523,.09,'triangle');
    setTimeout(()=>tone(659,.1,'triangle'),90);
    setTimeout(()=>tone(784,.2,'triangle'),180);
  }

  const target=Math.max(
    0,
    Math.min(
      WORLD_W-W,
      player.x-W*.34
    )
  );

  cameraX+=(target-cameraX)*Math.min(1,dt*5.5);

  pressed.clear();
}

function rr(x,y,w,h,r){
  const q=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,q);
}

function paperRect(x,y,w,h,kind='card'){
  ctx.save();

  ctx.shadowColor='#5b332b44';
  ctx.shadowBlur=8;
  ctx.shadowOffsetY=4;

  rr(x,y,w,h,8);

  ctx.fillStyle=
    kind==='floor' ? '#81502f' :
    kind==='wood' ? '#a76938' :
    kind==='fabric' ? '#8aa2b8' :
    kind==='book' ? '#6c876d' :
    kind==='roof' ? '#b9854d' :
    kind==='wall' ? '#a56d3f' :
    kind==='sponge' ? '#e8b84c' :
    '#b97a45';

  ctx.fill();

  ctx.shadowColor='transparent';

  ctx.lineWidth=4;
  ctx.strokeStyle='#5a3828';
  ctx.stroke();

  ctx.fillStyle='#f6ead6';
  ctx.fillRect(
    x+3,
    y+2,
    w-6,
    Math.min(10,h/3)
  );

  ctx.restore();
}

function drawRamp(r){
  ctx.save();

  ctx.beginPath();

  if(r.dir===1){
    ctx.moveTo(r.x,r.y+r.h);
    ctx.lineTo(r.x+r.w,r.y);
    ctx.lineTo(r.x+r.w,r.y+r.h);
  }else{
    ctx.moveTo(r.x,r.y);
    ctx.lineTo(r.x+r.w,r.y+r.h);
    ctx.lineTo(r.x,r.y+r.h);
  }

  ctx.closePath();

  ctx.fillStyle='#a96f40';
  ctx.fill();

  ctx.lineWidth=4;
  ctx.strokeStyle='#5a3828';
  ctx.stroke();

  ctx.restore();
}

function drawBreak(b){
  if(b.down)return;

  paperRect(
    b.x,
    b.y,
    b.w,
    b.h,
    'card'
  );

  if(b.t>0){
    ctx.save();

    ctx.strokeStyle='#6c3f2c';
    ctx.lineWidth=3;

    ctx.beginPath();
    ctx.moveTo(
      b.x+b.w*.45,
      b.y+3
    );
    ctx.lineTo(
      b.x+b.w*.52,
      b.y+15
    );
    ctx.lineTo(
      b.x+b.w*.43,
      b.y+b.h-3
    );
    ctx.stroke();

    ctx.restore();
  }
}

function drawFan(u){
  const x=u.x+u.w/2;
  const y=GROUND-18;

  ctx.save();
  ctx.translate(x,y);

  ctx.fillStyle='#ddd0bc';
  ctx.strokeStyle='#4a4541';
  ctx.lineWidth=5;

  rr(-52,-50,104,68,10);
  ctx.fill();
  ctx.stroke();

  for(let i=0;i<4;i++){
    ctx.save();

    ctx.rotate(
      time*3+i*Math.PI/2
    );

    ctx.fillStyle='#747679';

    ctx.beginPath();

    ctx.ellipse(
      0,
      -21,
      12,
      28,
      .3,
      0,
      Math.PI*2
    );

    ctx.fill();

    ctx.restore();
  }

  ctx.fillStyle='#474747';

  ctx.beginPath();
  ctx.arc(0,-18,9,0,7);
  ctx.fill();

  ctx.restore();

  ctx.save();

  ctx.globalAlpha=.34;

  const grad=ctx.createLinearGradient(
    0,
    u.y,
    0,
    u.y+u.h
  );

  grad.addColorStop(0,'#bde9ff00');
  grad.addColorStop(.25,'#bde9ff88');
  grad.addColorStop(1,'#8fd7ff22');

  ctx.fillStyle=grad;

  for(let i=0;i<5;i++){
    const xx=
      u.x+
      20+
      i*30+
      Math.sin(time*2+i)*8;

    ctx.beginPath();

    ctx.moveTo(
      xx,
      u.y+u.h
    );

    ctx.bezierCurveTo(
      xx+35,
      u.y+u.h*.7,
      xx-35,
      u.y+u.h*.35,
      xx+10,
      u.y
    );

    ctx.lineWidth=10;
    ctx.strokeStyle='#b8e8ff';
    ctx.stroke();
  }

  ctx.restore();
}

function drawCheckpoint(c){
  ctx.save();

  ctx.translate(
    c.x,
    GROUND-75
  );

  ctx.fillStyle='#6f452f';
  ctx.fillRect(
    -5,
    -60,
    10,
    60
  );

  ctx.fillStyle=
    c.active
      ? '#e95d57'
      : '#c98164';

  ctx.beginPath();

  ctx.moveTo(
    5,
    -58
  );

  ctx.lineTo(
    75,
    -45
  );

  ctx.lineTo(
    5,
    -25
  );

  ctx.closePath();
  ctx.fill();

  ctx.fillStyle='#fff0d7';
  ctx.font='bold 24px system-ui';

  ctx.fillText(
    '🐾',
    18,
    -34
  );

  ctx.restore();
}

function drawPickup(p){
  if(p.got)return;

  const im=
    p.type==='rare'
      ? images.rare
      : images.can;

  const s=
    p.type==='rare'
      ? 92
      : 70;

  ctx.save();

  ctx.translate(
    p.x,
    p.y+
    Math.sin(
      time*3+p.x
    )*8
  );

  ctx.shadowColor=
    p.type==='rare'
      ? '#ffd34f'
      : '#f2b66b';

  ctx.shadowBlur=
    p.type==='rare'
      ? 24
      : 12;

  ctx.drawImage(
    im,
    -s/2,
    -s/2,
    s,
    s
  );

  ctx.restore();
}

function drawUnlock(u){
  if(player.unlocked[u.form]){
    return;
  }

  ctx.save();

  ctx.translate(
    u.x,
    u.y+
    Math.sin(
      time*2.5
    )*7
  );

  ctx.fillStyle='#fff0d9';
  ctx.strokeStyle='#5c4439';
  ctx.lineWidth=5;

  ctx.beginPath();

  ctx.arc(
    0,
    0,
    48,
    0,
    7
  );

  ctx.fill();
  ctx.stroke();

  ctx.fillStyle='#d85e50';
  ctx.textAlign='center';
  ctx.font='900 19px system-ui';

  ctx.fillText(
    u.label,
    0,
    6
  );

  ctx.restore();
}

function drawMouse(m){
  const flip=
    m.v<0
      ? -1
      : 1;

  ctx.save();

  ctx.translate(
    m.x+
    (flip<0?m.w:0),
    m.y
  );

  ctx.scale(
    flip,
    1
  );

  ctx.drawImage(
    images.mouse,
    0,
    -12,
    m.w,
    m.h+20
  );

  ctx.restore();
}

function drawBackground(){
  const x=cameraX;

  const g=ctx.createLinearGradient(
    0,
    0,
    0,
    H
  );

  g.addColorStop(
    0,
    '#efd7b5'
  );

  g.addColorStop(
    1,
    '#d8b38c'
  );

  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);

  ctx.globalAlpha=.12;
  ctx.strokeStyle='#7c5a44';
  ctx.lineWidth=3;

  for(let i=-200;i<W+300;i+=180){
    ctx.beginPath();

    ctx.moveTo(
      i-(x*.08%180),
      0
    );

    ctx.lineTo(
      i+80-(x*.08%180),
      H
    );

    ctx.stroke();
  }

  ctx.globalAlpha=1;

  const wx=
    220-
    cameraX*.12;

  ctx.fillStyle='#8ecae6';

  ctx.fillRect(
    wx,
    90,
    310,
    300
  );

  ctx.fillStyle='#fbefd5';
  ctx.lineWidth=16;
  ctx.strokeStyle='#e9d1aa';

  ctx.strokeRect(
    wx,
    90,
    310,
    300
  );

  ctx.fillRect(
    wx+145,
    90,
    18,
    300
  );

  ctx.fillRect(
    wx,
    230,
    310,
    18
  );

  const off=
    -cameraX*.18;

  ctx.fillStyle='#855b3f';

  ctx.fillRect(
    680+off,
    260,
    520,
    380
  );

  ctx.fillStyle='#5d7b68';

  ctx.fillRect(
    3600+off,
    160,
    520,
    480
  );

  ctx.fillStyle='#6f8b75';

  ctx.fillRect(
    5700+off,
    160,
    780,
    500
  );

  ctx.fillStyle='#a26b45';

  ctx.fillRect(
    7700+off,
    220,
    620,
    420
  );

  ctx.fillStyle='#6b422d';

  for(const sx of [
    900,
    2600,
    3900,
    6100,
    7900
  ]){
    const xx=sx+off;

    ctx.fillRect(
      xx,
      340,
      420,
      28
    );

    ctx.fillRect(
      xx,
      520,
      420,
      28
    );
  }

  ctx.fillStyle='#54714b';

  for(let i=0;i<24;i++){
    const xx=
      (
        500+
        i*430+
        off
      )%2100;

    ctx.beginPath();

    ctx.ellipse(
      xx,
      160+(i%3)*30,
      22,
      42,
      i%2?.6:-.6,
      0,
      7
    );

    ctx.fill();
  }

  ctx.strokeStyle='#a98568';
  ctx.globalAlpha=.22;

  for(let yy=280;yy<660;yy+=70){
    ctx.beginPath();

    ctx.moveTo(
      5200+off,
      yy
    );

    ctx.lineTo(
      9300+off,
      yy
    );

    ctx.stroke();
  }

  ctx.globalAlpha=1;
}

function drawWorld(){
  ctx.save();
  ctx.translate(-cameraX,0);

  for(const h of hazards){
    if(h.type==='puddle'){
      ctx.fillStyle='#79b9c8aa';

      ctx.beginPath();

      ctx.ellipse(
        h.x+h.w/2,
        h.y+h.h/2,
        h.w/2,
        h.h/2,
        0,
        0,
        7
      );

      ctx.fill();

      ctx.strokeStyle='#d7f4fa';
      ctx.lineWidth=4;
      ctx.stroke();
    }else{
      ctx.fillStyle='#5c4035';

      ctx.fillRect(
        h.x,
        h.y,
        h.w,
        h.h
      );
    }
  }

  for(const p of platforms){
    paperRect(
      p.x,
      p.y,
      p.w,
      p.h,
      p.kind
    );
  }

  for(const r of ramps){
    drawRamp(r);
  }

  for(const m of movers){
    paperRect(
      m.x,
      m.y,
      m.w,
      m.h,
      m.kind
    );
  }

  for(const b of breakables){
    drawBreak(b);
  }

  for(const u of updrafts){
    drawFan(u);
  }

  for(const c of checkpoints){
    drawCheckpoint(c);
  }

  for(const p of pickups){
    drawPickup(p);
  }

  for(const u of unlocks){
    drawUnlock(u);
  }

  for(const m of mice){
    drawMouse(m);
  }

  ctx.save();

  ctx.translate(
    9130,
    64
  );

  ctx.drawImage(
    images.owner,
    0,
    0,
    760,
    950
  );

  ctx.restore();

  drawPlayer();

  ctx.restore();
}

function drawPlayer(){
  const d=dims();

  if(
    player.inv>0 &&
    Math.floor(
      player.inv*12
    )%2===0
  ){
    return;
  }

  ctx.save();

  ctx.translate(
    player.x+d.w/2,
    player.y+d.h/2
  );

  if(player.face<0){
    ctx.scale(-1,1);
  }

  if(player.form==='normal'){
    ctx.drawImage(
      images.cat,
      -d.w*.62,
      -d.h*.61,
      d.w*1.24,
      d.h*1.24
    );
  }else if(player.form==='ball'){
    ctx.rotate(
      player.ballAngle*
      player.face
    );

    ctx.drawImage(
      images.ball,
      -d.w/2,
      -d.h/2,
      d.w,
      d.h
    );
  }else if(player.form==='cape'){
    ctx.drawImage(
      images.cape,
      -d.w*.55,
      -d.h*.60,
      d.w*1.1,
      d.h*1.2
    );
  }else{
    const frame=
      Math.floor(
        time*7
      )%6;

    const sw=
      images.jelly.width/6;

    const sh=
      images.jelly.height;

    ctx.drawImage(
      images.jelly,
      frame*sw,
      0,
      sw,
      sh,
      -d.w*.57,
      -d.h*.82,
      d.w*1.14,
      d.h*1.64
    );
  }

  ctx.restore();
}

function drawHUD(){
  ctx.save();

  ctx.fillStyle='#fff5e6e8';
  ctx.strokeStyle='#60483d';
  ctx.lineWidth=3;

  rr(
    28,
    24,
    510,
    88,
    22
  );

  ctx.fill();
  ctx.stroke();

  ctx.fillStyle='#44342e';
  ctx.font='800 27px system-ui';

  ctx.fillText(
    '🥫 '+player.cans+
    '    ✨ '+player.rare+
    '×3',
    52,
    62
  );

  ctx.font='700 20px system-ui';
  ctx.fillText('1 КОТ',52,95);

  const forms=[
    ['ball','2 ШАР'],
    ['cape','3 ПЛАЩ'],
    ['jelly','4 ЖЕЛЕ']
  ];

  let xx=160;

  for(const [f,l] of forms){
    ctx.fillStyle=
      player.unlocked[f]
        ? (
          player.form===f
            ? '#d85d50'
            : '#806452'
        )
        : '#b9a99c';

    ctx.globalAlpha=
      player.unlocked[f]
        ? 1
        : .45;

    rr(
      xx,
      73,
      105,
      29,
      10
    );

    ctx.fill();

    ctx.fillStyle='white';
    ctx.font='800 14px system-ui';

    ctx.fillText(
      l,
      xx+9,
      94
    );

    xx+=115;
  }

  ctx.globalAlpha=1;

  ctx.fillStyle='#4f4038';

  rr(
    1160,
    35,
    390,
    22,
    11
  );

  ctx.fill();

  ctx.fillStyle='#e16652';

  rr(
    1160,
    35,
    390*
    Math.min(
      1,
      player.x/9500
    ),
    22,
    11
  );

  ctx.fill();

  ctx.fillStyle='#44342e';
  ctx.font='700 16px system-ui';
  ctx.textAlign='right';

  ctx.fillText(
    'К ЗОЗЯЦКЕ →',
    1548,
    84
  );

  ctx.textAlign='left';

  if(messageT>0){
    const a=Math.min(
      1,
      messageT*3
    );

    ctx.globalAlpha=a;
    ctx.fillStyle='#382c29e8';

    rr(
      W/2-230,
      130,
      460,
      66,
      20
    );

    ctx.fill();

    ctx.fillStyle='#fff4e5';
    ctx.font='900 26px system-ui';
    ctx.textAlign='center';

    ctx.fillText(
      message,
      W/2,
      172
    );
  }

  ctx.restore();
}

function drawTitle(){
  drawBackground();

  ctx.fillStyle='#2e2421aa';
  ctx.fillRect(0,0,W,H);

  ctx.save();

  ctx.translate(
    W/2,
    H/2-80
  );

  ctx.fillStyle='#fff0dd';
  ctx.strokeStyle='#5a3e33';
  ctx.lineWidth=8;

  rr(
    -420,
    -240,
    840,
    500,
    42
  );

  ctx.fill();
  ctx.stroke();

  ctx.textAlign='center';

  ctx.fillStyle='#d85d50';
  ctx.font='1000 68px system-ui';

  ctx.fillText(
    'К ЗОЗЯЦКЕ!',
    0,
    -125
  );

  ctx.fillStyle='#44342e';
  ctx.font='700 27px system-ui';

  ctx.fillText(
    'scrapbook-платформер про очень целеустремлённого кота',
    0,
    -72
  );

  ctx.font='650 25px system-ui';

  ctx.fillText(
    'A/D или ←/→ — идти    SPACE — прыгать',
    0,
    10
  );

  ctx.fillText(
    '1 — кот   2 — шар   3 — плащ   4 — желе',
    0,
    52
  );

  ctx.fillText(
    'R — вернуться к чекпоинту',
    0,
    94
  );

  ctx.fillStyle='#d85d50';

  rr(
    -190,
    145,
    380,
    74,
    22
  );

  ctx.fill();

  ctx.fillStyle='white';
  ctx.font='900 30px system-ui';

  ctx.fillText(
    'НАЖМИ ENTER',
    0,
    193
  );

  ctx.restore();
}

function drawWin(){
  drawBackground();
  drawWorld();

  petT+=1/60;

  ctx.save();

  ctx.translate(
    -cameraX,
    0
  );

  const bob=
    Math.sin(
      petT*4
    )*8;

  ctx.translate(
    9420,
    350+bob
  );

  ctx.rotate(-.18);

  ctx.drawImage(
    images.hand,
    -40,
    -40,
    300,
    290
  );

  ctx.restore();

  ctx.fillStyle='#2d2420aa';
  ctx.fillRect(0,0,W,H);

  ctx.fillStyle='#fff2df';
  ctx.strokeStyle='#5a4035';
  ctx.lineWidth=7;

  rr(
    W/2-360,
    H/2-190,
    720,
    380,
    34
  );

  ctx.fill();
  ctx.stroke();

  ctx.textAlign='center';

  ctx.fillStyle='#d75b4e';
  ctx.font='1000 58px system-ui';

  ctx.fillText(
    'МУР. ДОБРАЛСЯ.',
    W/2,
    H/2-82
  );

  ctx.fillStyle='#44342e';
  ctx.font='800 30px system-ui';

  ctx.fillText(
    `Консервы: ${player.cans}   •   редкая: ${player.rare}×3`,
    W/2,
    H/2-20
  );

  ctx.font='650 23px system-ui';

  ctx.fillText(
    'Зозяцка гладит. Уровень пройден.',
    W/2,
    H/2+35
  );

  ctx.fillStyle='#d85d50';

  rr(
    W/2-170,
    H/2+82,
    340,
    66,
    20
  );

  ctx.fill();

  ctx.fillStyle='white';
  ctx.font='900 25px system-ui';

  ctx.fillText(
    'ENTER — ещё раз',
    W/2,
    H/2+124
  );

  ctx.textAlign='left';

  ctx.restore();
}

function render(){
  ctx.clearRect(0,0,W,H);

  const sx=
    shake
      ? (Math.random()-.5)*shake
      : 0;

  const sy=
    shake
      ? (Math.random()-.5)*shake
      : 0;

  ctx.save();

  ctx.translate(
    sx,
    sy
  );

  drawBackground();

  if(mode==='title'){
    drawTitle();
  }else if(mode==='won'){
    drawWin();
  }else{
    drawWorld();
    drawHUD();
  }

  ctx.restore();
}

function loop(ts){
  const dt=Math.min(
    .033,
    (ts-last)/1000||0
  );

  last=ts;

  if(mode==='play'){
    update(dt);
  }

  render();

  requestAnimationFrame(loop);
}

function ready(){
  document.getElementById('loading').style.display='none';
  requestAnimationFrame(loop);
}

})();
