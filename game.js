(() => {
'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
const W = canvas.width, H = canvas.height;
const WORLD_W = 9800;
const GROUND_Y = 770;
const ASSETS = window.ASSETS || {};
const images = {};
let toLoad = Object.keys(ASSETS).length;
if (toLoad === 0) ready();
for (const [k, src] of Object.entries(ASSETS)) {
  const im = new Image();
  im.onload = im.onerror = () => { if (--toLoad === 0) ready(); };
  im.src = src;
  images[k] = im;
}

const keys = { left:false, right:false, up:false, down:false, jump:false };
const pressed = new Set();
const keyMap = { ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right', ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down', Space:'jump' };
addEventListener('keydown', e => {
  const k = keyMap[e.code];
  if (k) { if (!keys[k]) pressed.add(k); keys[k] = true; e.preventDefault(); }
  if (e.code === 'Digit1') setForm('normal');
  if (e.code === 'Digit2') setForm('ball');
  if (e.code === 'Digit3') setForm('cape');
  if (e.code === 'Digit4') setForm('jelly');
  if (e.code === 'KeyQ') cycleForm(-1);
  if (e.code === 'KeyE') cycleForm(1);
  if (e.code === 'Enter' && (mode === 'title' || mode === 'won')) startGame();
  if (e.code === 'KeyR' && mode === 'play') respawn();
});
addEventListener('keyup', e => {
  const k = keyMap[e.code];
  if (k) { keys[k] = false; e.preventDefault(); }
});
for (const b of document.querySelectorAll('#touch [data-key]')) {
  const k = b.dataset.key;
  const down = e => { e.preventDefault(); if (!keys[k]) pressed.add(k); keys[k] = true; };
  const up = e => { e.preventDefault(); keys[k] = false; };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
}
for (const b of document.querySelectorAll('#touch [data-form]')) {
  b.addEventListener('pointerdown', e => { e.preventDefault(); setForm(b.dataset.form); });
}
canvas.addEventListener('pointerdown', () => { if (mode === 'title') startGame(); });

let audioCtx = null;
function tone(freq=440,d=.08,type='sine',gain=.04){
  try{
    audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = gain;
    o.connect(g); g.connect(audioCtx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+d);
    o.stop(audioCtx.currentTime+d);
  }catch{}
}

const formDims = { normal:[108,104], ball:[88,88], cape:[156,92], jelly:[148,46] };
const player = {
  x: 180, y: GROUND_Y-104, vx:0, vy:0, face:1, onGround:false, standing:null, wall:0,
  form:'normal', inv:0, ballAngle:0, cans:0, rare:0,
  unlocked:{ normal:true, ball:false, cape:false, jelly:false },
  checkpoint:{ x:180, y:GROUND_Y-104 },
};
function dims(form=player.form){ return { w:formDims[form][0], h:formDims[form][1] }; }
function playerRect(x=player.x,y=player.y,form=player.form){ const d=dims(form); return {x,y,w:d.w,h:d.h}; }
function setForm(f){
  if (mode !== 'play' || !player.unlocked[f] || player.form === f) return;
  const old = dims(), foot = player.y + old.h;
  player.form = f;
  const d = dims();
  player.y = foot - d.h;
  tone({normal:310,ball:170,cape:520,jelly:240}[f],.08,'triangle');
}
function cycleForm(dir){
  const arr = ['normal','ball','cape','jelly'].filter(f=>player.unlocked[f]);
  const i = arr.indexOf(player.form);
  setForm(arr[(i+dir+arr.length)%arr.length]);
}

let mode='title', time=0, last=0, cameraX=0, shake=0, message='', messageT=0, unlockFreeze=0;
let cutscene = { phase:0, t:0, targetX:0, targetY:0 };

const platforms = [];
const movers = [];
const breakables = [];
const fans = [];
const checkpoints = [];
const pickups = [];
const mice = [];
const unlocks = [];
const owner = { x:9200, y:135, lap:{ x:9380, y:635, w:270, h:26 }, trigger:{ x:9130, y:450, w:500, h:330 } };

function P(x,y,w,h=36,kind='solid'){ platforms.push({x,y,w,h,kind,id:'p'+platforms.length}); }
function M(x,y,w,h,axis,range,speed,kind='flying'){ movers.push({x,y,w,h,axis,range,speed,kind,baseX:x,baseY:y,px:x,py:y,phase:Math.random()*6.28,id:'m'+movers.length}); }
function B(x,y,w,h=28){ breakables.push({x,y,w,h,stage:0,timer:0,broken:false,respawn:0,id:'b'+breakables.length}); }
function Fan(x,y,w,h,power=1180,dx=.62,dy=-.82){ fans.push({x,y,w,h,power,dx,dy}); }
function checkpoint(x,y){ checkpoints.push({x,y,active:false,anim:0}); }
function unlockAt(x,y,form,label){ unlocks.push({x,y,form,label}); }
function pickup(x,y,type){ pickups.push({x,y,type,got:false}); }
function mouse(x,y,min,max){ mice.push({x,y:y-10,min,max,v:85,w:96,h:68,alive:true,deadTimer:0,vx:0,vy:0,rot:0}); }

function buildLevel(){
  platforms.length=0; movers.length=0; breakables.length=0; fans.length=0; checkpoints.length=0; pickups.length=0; mice.length=0; unlocks.length=0;
  // ground strip
  P(0, GROUND_Y, WORLD_W, 130, 'ground');
  // section 1 - basic
  P(350, 645, 230, 38, 'normal');
  P(710, 565, 200, 38, 'normal');
  P(990, 500, 170, 38, 'normal');
  pickup(760, 495, 'can');
  mouse(1210, GROUND_Y-58, 1160, 1540);
  checkpoint(1540, GROUND_Y-10);
  unlockAt(1645, 684, 'ball', 'ШАР');
  // ball + breakables
  B(1930, 630, 170, 28);
  B(2150, 575, 170, 28);
  B(2380, 520, 170, 28);
  P(2610, 455, 180, 38, 'normal');
  pickup(2680, 390, 'can');
  // mid section
  P(3000, 625, 220, 38, 'normal');
  M(3330, 590, 210, 46, 'x', 160, 1.2, 'flying');
  P(3650, 515, 200, 38, 'normal');
  checkpoint(3870, GROUND_Y-10);
  unlockAt(4100, 618, 'cape', 'ПЛАЩ');
  // fans and pits
  P(4360, 690, 140, 20, 'invisible');
  Fan(4500, 600, 230, 170, 1200, .72, -.76);
  P(4840, 480, 190, 38, 'normal');
  M(5150, 445, 210, 46, 'y', 110, 1.0, 'flying');
  pickup(5215, 365, 'rare');
  mouse(5480, GROUND_Y-58, 5410, 5770);
  checkpoint(5740, GROUND_Y-10);
  // jelly section
  P(6020, 645, 210, 38, 'normal');
  unlockAt(6320, 680, 'jelly', 'ЖЕЛЕ');
  P(6510, 720, 520, 34, 'low');
  P(6510, 690, 70, 80, 'wall');
  P(6960, 690, 70, 80, 'wall');
  pickup(6770, 708, 'can');
  P(7240, 430, 70, 340, 'wall');
  P(7240, 405, 340, 38, 'normal');
  M(7650, 510, 210, 46, 'x', 180, 1.3, 'flying');
  mouse(7920, GROUND_Y-58, 7830, 8180);
  checkpoint(8150, GROUND_Y-10);
  // finale
  B(8440, 575, 190, 28);
  Fan(8700, 580, 240, 190, 1120, .66, -.78);
  P(9035, 660, 180, 26, 'normal');
  P(owner.lap.x, owner.lap.y, owner.lap.w, owner.lap.h, 'lap');
}
buildLevel();

function startGame(){
  mode='play'; time=0; cameraX=0; shake=0; message=''; messageT=0; unlockFreeze=0;
  player.x=180; player.y=GROUND_Y-dims('normal').h; player.vx=0; player.vy=0; player.face=1; player.form='normal'; player.cans=0; player.rare=0;
  player.unlocked={ normal:true, ball:false, cape:false, jelly:false }; player.checkpoint={ x:180, y:GROUND_Y-dims('normal').h }; player.inv=0; player.standing=null;
  for (const p of pickups) p.got=false;
  for (const c of checkpoints){ c.active=false; c.anim=0; }
  for (const u of unlocks){}
  for (const b of breakables){ b.stage=0; b.timer=0; b.broken=false; b.respawn=0; }
  for (const m of mice){ m.alive=true; m.deadTimer=0; m.vx=0; m.vy=0; m.rot=0; }
  cutscene = { phase:0, t:0, targetX:owner.lap.x+74, targetY:owner.lap.y-84 };
  tone(392,.12,'triangle');
}
function respawn(){
  const d = dims('normal');
  player.form='normal'; player.x=player.checkpoint.x; player.y=player.checkpoint.y ?? (GROUND_Y-d.h); player.vx=0; player.vy=0; player.inv=.8; shake=7;
  tone(120,.18,'sawtooth',.025);
}
function unlockForm(u){
  if (player.unlocked[u.form]) return;
  player.unlocked[u.form] = true;
  message = 'НОВАЯ ФОРМА: ' + u.label;
  messageT = 2.2; unlockFreeze = .42;
  tone(523,.08,'triangle'); setTimeout(()=>tone(659,.12,'triangle'),70);
}
function rectsOverlap(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function currentSolids(){
  return platforms.filter(p=>p.kind!=='invisible').concat(movers).concat(breakables.filter(b=>!b.broken));
}

function startCutscene(){
  if (mode !== 'play') return;
  mode = 'cutscene';
  cutscene = { phase:0, t:0, targetX:owner.lap.x + owner.lap.w*0.5 - dims('normal').w*0.45, targetY: owner.lap.y - dims('normal').h + 6 };
  player.vx = 0; player.vy = 0; player.form = 'normal';
}

function updateMice(dt){
  for (const m of mice){
    if (m.alive){
      m.x += m.v * dt;
      if (m.x < m.min){ m.x = m.min; m.v = Math.abs(m.v); }
      if (m.x > m.max){ m.x = m.max; m.v = -Math.abs(m.v); }
    } else if (m.deadTimer > 0) {
      m.deadTimer -= dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.vy += 1180 * dt;
      m.rot += 7.8 * dt;
    }
  }
}
function updateBreakables(dt){
  for (const b of breakables){
    if (b.broken){
      b.respawn -= dt;
      if (b.respawn <= 0){ b.broken = false; b.respawn = 0; b.timer = 0; b.stage = 0; }
    } else {
      if (b.timer > 0){
        b.timer += dt;
        b.stage = clamp(Math.floor(b.timer / 0.12), 0, 4);
        if (b.timer >= 0.60){ b.broken = true; b.respawn = 2.8; b.timer = 0; b.stage = 4; shake = 5; tone(95,.11,'square',.02); }
      } else b.stage = 0;
    }
  }
}
function updateMovers(dt){
  for (const m of movers){
    m.px = m.x; m.py = m.y;
    const s = Math.sin(time*m.speed + m.phase);
    if (m.axis === 'x') m.x = m.baseX + s*m.range; else m.y = m.baseY + s*m.range;
  }
}

function updatePlay(dt){
  time += dt;
  if (messageT>0) messageT -= dt;
  if (shake>0) shake = Math.max(0, shake-dt*24);
  if (player.inv>0) player.inv -= dt;
  if (unlockFreeze>0){ unlockFreeze -= dt; return; }
  updateMovers(dt); updateBreakables(dt); updateMice(dt);
  for (const c of checkpoints){ if (c.active && c.anim < 999) c.anim += dt; }

  const d = dims();
  const wasStanding = player.standing;
  player.standing = null; player.wall = 0;
  if (wasStanding){
    const m = movers.find(q=>q.id===wasStanding);
    if (m){ player.x += m.x-m.px; player.y += m.y-m.py; }
  }

  const left = keys.left ? 1 : 0, right = keys.right ? 1 : 0, dir = right-left;
  if (dir) player.face = dir;
  let accel=2200, max=390, fric=0.80, jump=650, gravity=1780;
  if (player.form==='ball'){ accel=1550; max=650; fric=.94; jump=665; player.ballAngle += player.vx*dt/44; }
  if (player.form==='cape'){ accel=1750; max=440; fric=.85; jump=620; if (keys.jump && player.vy>20) gravity=360; }
  if (player.form==='jelly'){ accel=1600; max=255; fric=.76; jump=480; gravity=1500; }
  if (dir) player.vx += dir*accel*dt; else player.vx *= Math.pow(fric,dt*60);
  player.vx = clamp(player.vx, -max, max);

  if (pressed.has('jump') && player.onGround){ player.vy = -jump; player.onGround = false; tone(player.form==='ball'?180:280,.045,'triangle',.02); }
  if (player.form==='jelly' && player.wall && keys.up){ player.vy = -250; gravity = 120; }
  if (player.form==='jelly' && player.wall && keys.down){ player.vy = 220; gravity = 120; }
  if (keys.jump && player.vy < 0 && player.form !== 'jelly') gravity *= .58;
  player.vy += gravity*dt;
  if (player.form==='cape' && keys.jump && player.vy > 170) player.vy = 170;

  for (const f of fans){
    if (player.form==='cape' && rectsOverlap(playerRect(), f)){
      player.vx += f.dx * f.power * dt * 0.45;
      player.vy += f.dy * f.power * dt;
      player.vx = clamp(player.vx,-540,540);
      player.vy = Math.max(player.vy,-560);
    }
  }

  const oldX = player.x;
  player.x += player.vx * dt;
  let pr = playerRect();
  for (const s of currentSolids()){
    if (s.kind==='lap' && mode==='play') continue;
    if (!rectsOverlap(pr,s)) continue;
    const prevRight = oldX + d.w, prevLeft = oldX;
    if (player.vx > 0 && prevRight <= s.x + 14){ player.x = s.x - d.w; player.vx = 0; player.wall = 1; }
    else if (player.vx < 0 && prevLeft >= s.x + s.w - 14){ player.x = s.x + s.w; player.vx = 0; player.wall = -1; }
    pr = playerRect();
  }

  const oldY = player.y, oldFoot = oldY + d.h;
  player.y += player.vy * dt;
  player.onGround = false; pr = playerRect();
  for (const s of currentSolids()){
    if (s.kind==='lap' && mode==='play') continue;
    if (!rectsOverlap(pr,s)) continue;
    if (player.vy >= 0 && oldFoot <= s.y + 16){
      player.y = s.y - d.h; player.vy = 0; player.onGround = true; player.standing = s.id || null;
      if (s.id && s.id.startsWith('b')){ const b = breakables.find(q=>q.id===s.id); if (b && !b.broken && b.timer===0) b.timer = 0.001; }
    } else if (player.vy < 0 && oldY >= s.y + s.h - 16) {
      player.y = s.y + s.h; player.vy = 0;
    }
    pr = playerRect();
  }

  if (player.y > H + 250) { respawn(); }

  for (const c of checkpoints){
    const r = { x:c.x-30, y:c.y-120, w:70, h:120 };
    if (!c.active && rectsOverlap(playerRect(), r)){
      for (const q of checkpoints) q.active = false;
      c.active = true;
      c.anim = 0.001;
      player.checkpoint = { x:c.x, y:GROUND_Y-dims('normal').h };
      message = 'ЧЕКПОИНТ'; messageT = 1.4; tone(588,.08,'triangle');
    }
  }
  for (const p of pickups){
    if (!p.got && rectsOverlap(playerRect(), {x:p.x-32,y:p.y-32,w:64,h:64})){
      p.got = true;
      if (p.type==='rare') player.rare += 1; else player.cans += 1;
      shake = 3; tone(p.type==='rare'?720:480,.1,'triangle',.03);
    }
  }
  for (const u of unlocks){
    if (!player.unlocked[u.form] && rectsOverlap(playerRect(), {x:u.x-44,y:u.y-44,w:88,h:88})) unlockForm(u);
  }

  const prevRect = playerRect(player.x, oldY, player.form);
  const nowRect = playerRect();
  for (const m of mice){
    if (m.deadTimer <= 0 && !m.alive) continue;
    const mr = {x:m.x, y:m.y, w:m.w, h:m.h};
    if (!rectsOverlap(nowRect, mr)) continue;
    const stomp = m.alive && player.vy > 120 && prevRect.y + prevRect.h <= m.y + 10;
    if (stomp){
      m.alive = false; m.deadTimer = 1.15; m.vx = 170 * player.face; m.vy = -360; m.rot = Math.PI; player.vy = -430; shake = 4;
      tone(240,.06,'square',.03); setTimeout(()=>tone(420,.05,'triangle',.02),40);
    } else if (m.alive && player.inv <= 0) {
      respawn(); return;
    }
  }

  if (rectsOverlap(playerRect(), owner.trigger) && mode === 'play') startCutscene();
  pressed.clear();
  cameraX = clamp(player.x - W*0.33, 0, WORLD_W-W);
}

function updateCutscene(dt){
  time += dt;
  if (shake>0) shake = Math.max(0, shake-dt*24);
  cutscene.t += dt;
  updateMovers(dt);
  updateMice(dt);
  for (const c of checkpoints){ if (c.active && c.anim < 999) c.anim += dt; }
  if (cutscene.phase === 0){
    const tx = cutscene.targetX, ty = cutscene.targetY;
    player.x += (tx - player.x) * Math.min(1, dt*4.5);
    player.y += (ty - player.y) * Math.min(1, dt*4.5);
    player.face = 1;
    if (Math.abs(player.x - tx) < 4 && Math.abs(player.y - ty) < 4){
      player.x = tx; player.y = ty; cutscene.phase = 1; cutscene.t = 0;
      tone(490,.12,'triangle',.03);
    }
  } else if (cutscene.phase === 1 && cutscene.t > 3.6) {
    mode = 'won';
  }
  cameraX += ((owner.x - 260) - cameraX) * Math.min(1, dt*2.3);
  cameraX = clamp(cameraX, 0, WORLD_W-W);
  pressed.clear();
}

function drawRounded(x,y,w,h,r){ const q=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.roundRect(x,y,w,h,q); }
function drawBackground(){
  const bg = images.bgRoom;
  if (bg && bg.width){
    ctx.drawImage(bg, 0, 0, W, H);
    // мягкий параллакс-оверлей, чтобы сцена не была совсем статичной
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#7c5a44';
    ctx.lineWidth = 3;
    for(let i=-240;i<W+260;i+=180){ ctx.beginPath(); ctx.moveTo(i-(cameraX*.05%180),0); ctx.lineTo(i+90-(cameraX*.05%180),H); ctx.stroke(); }
    ctx.restore();
  } else {
    const sky = ctx.createLinearGradient(0,0,0,H); sky.addColorStop(0,'#f2dec3'); sky.addColorStop(1,'#dbb286'); ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
  }
}

function drawGroundStrip(seg){
  const im = images.groundTile;
  if (!im || !im.width) return;
  const drawH = seg.h + 8;
  const tileW = im.width * (drawH / im.height);
  for (let x = seg.x; x < seg.x + seg.w + tileW; x += tileW - 2) {
    ctx.drawImage(im, x, seg.y-2, tileW, drawH);
  }
}
function drawNormalPlatform(p){
  const im = images.platformNormal2;
  if (im && im.width) ctx.drawImage(im, p.x, p.y-8, p.w, p.h+26);
  else { ctx.fillStyle='#85a54e'; ctx.fillRect(p.x,p.y,p.w,p.h); }
}
function drawMovingPlatform(m){
  const im = images.platformFly2;
  if (im && im.width) ctx.drawImage(im, m.x, m.y-16, m.w, m.h+46);
  else { ctx.fillStyle='#d6b26b'; ctx.fillRect(m.x,m.y,m.w,m.h); }
}
function drawGlassPlatform(b){
  if (b.broken) return;
  const sheet = images.platformGlassSheet;
  if (sheet && sheet.width){
    const sw = sheet.width / 5, sh = sheet.height;
    const sx = clamp(b.stage,0,4) * sw;
    ctx.drawImage(sheet, sx, 0, sw, sh, b.x, b.y-12, b.w, b.h+36);
  } else {
    ctx.fillStyle='#b9e7ff'; ctx.fillRect(b.x,b.y,b.w,b.h);
  }
}
function drawFan(f){
  const im = images.fanDiagonal;
  if (im && im.width) ctx.drawImage(im, f.x-24, f.y-34, f.w+72, f.h+94);
  ctx.save();
  ctx.globalAlpha = .17;
  for (let i=0;i<3;i++){
    const px = f.x + 65 + i*34 + Math.sin(time*2+i)*7;
    ctx.beginPath();
    ctx.moveTo(px, f.y+f.h-8);
    ctx.bezierCurveTo(px+60, f.y+f.h-65, px+120, f.y+40, f.x+f.w-10, f.y-30);
    ctx.lineWidth = 16 - i*3;
    ctx.strokeStyle = '#d4f1ff';
    ctx.stroke();
  }
  ctx.restore();
}
function drawCheckpoint(c){
  const im = images.checkpointFlagRaiseSheet || images.checkpointFlag2;
  if (im && im.width){
    if (images.checkpointFlagRaiseSheet && images.checkpointFlagRaiseSheet.width){
      const cols = 6;
      const sw = im.width / cols, sh = im.height;
      const frame = c.active ? Math.min(5, Math.floor((c.anim||999) / 0.08)) : 0;
      ctx.drawImage(im, sw*frame, 0, sw, sh, c.x-58, c.y-144, 120, 120);
    } else {
      ctx.drawImage(im, c.x-52, c.y-136, 120, 120);
    }
  }
  if (c.active){
    ctx.save();
    ctx.globalAlpha=.28 + Math.sin(time*7)*.2;
    ctx.fillStyle='#ffd25f';
    ctx.beginPath(); ctx.arc(c.x+2,c.y-88,42,0,7); ctx.fill();
    ctx.restore();
  }
}
function drawPickup(p){
  if (p.got) return;
  const im = p.type==='rare' ? images.rare : images.can;
  const s = p.type==='rare' ? 92 : 70;
  if (!im || !im.width) return;
  ctx.save(); ctx.translate(p.x, p.y+Math.sin(time*3+p.x)*8); ctx.shadowColor = p.type==='rare' ? '#ffd34f' : '#f2b66b'; ctx.shadowBlur = p.type==='rare' ? 24 : 12; ctx.drawImage(im,-s/2,-s/2,s,s); ctx.restore();
}
function drawUnlock(u){
  if (player.unlocked[u.form]) return;
  const im = images.upgradePawIcon;
  const bob = Math.sin(time*2.5 + u.x*0.01) * 7;
  const glow = 18 + (Math.sin(time*5 + u.x*0.02) * 0.5 + 0.5) * 18;
  ctx.save();
  ctx.translate(u.x, u.y + bob);
  ctx.shadowColor = '#ffd84d';
  ctx.shadowBlur = glow;
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#ffd84d';
  ctx.beginPath(); ctx.arc(0,0,50 + glow*0.18,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  if (im && im.width) ctx.drawImage(im,-46,-46,92,92);
  ctx.shadowBlur = 0;
  ctx.fillStyle='rgba(255,245,221,.95)';
  ctx.font='900 14px system-ui';
  ctx.textAlign='center';
  ctx.fillText(u.label, 0, 66);
  ctx.restore();
}
function drawMouse(m){
  const im = images.mouseLarge || images.mouse;
  if (!im || !im.width) return;
  ctx.save();
  if (m.alive){
    const flip = m.v < 0 ? -1 : 1;
    ctx.translate(m.x + (flip<0?m.w:0), m.y);
    ctx.scale(flip,1);
    ctx.drawImage(im, 0, -6, m.w, m.h+10);
  } else if (m.deadTimer > 0) {
    ctx.translate(m.x + m.w/2, m.y + m.h/2);
    ctx.rotate(m.rot);
    ctx.scale(1,-1);
    ctx.drawImage(im, -m.w/2, -m.h/2, m.w, m.h);
  }
  ctx.restore();
}
function drawOwner(){
  const body = images.ownerBody2;
  if (body && body.width) ctx.drawImage(body, owner.x, owner.y, 690, 760);
}
function drawPetHand(){
  const hand = images.ownerHand2;
  if (!hand || !hand.width) return;
  let hx = owner.lap.x + 90, hy = owner.lap.y - 150;
  if (mode === 'cutscene' || mode === 'won'){
    const bob = Math.sin(time*6) * 8;
    hx = player.x + 28;
    hy = player.y - 82 + bob;
  }
  ctx.drawImage(hand, hx, hy, 180, 180);
}
function drawPlayer(){
  const d = dims();
  if (player.inv>0 && Math.floor(player.inv*12)%2===0) return;
  ctx.save();
  ctx.translate(player.x+d.w/2, player.y+d.h/2);
  if (player.face<0) ctx.scale(-1,1);
  if (player.form==='normal') ctx.drawImage(images.cat, -d.w*.62, -d.h*.61, d.w*1.24, d.h*1.24);
  else if (player.form==='ball'){ ctx.rotate(player.ballAngle*player.face); ctx.drawImage(images.ball, -d.w/2,-d.h/2,d.w,d.h); }
  else if (player.form==='cape'){
    const stretchX = 1.18 + Math.min(Math.abs(player.vx)/430, .38);
    const stretchY = .96 - Math.min(Math.abs(player.vy)/1200, .18);
    const rot = clamp(player.vy/900, -.18, .18);
    ctx.rotate(rot);
    ctx.scale(stretchX, stretchY);
    ctx.drawImage(images.cape, -d.w*.54, -d.h*.60, d.w*1.08, d.h*1.22);
  } else {
    const frame = images.jelly && images.jelly.width ? Math.floor(time*7)%6 : 0;
    if (images.jelly && images.jelly.width){
      const sw = images.jelly.width/6, sh = images.jelly.height;
      ctx.drawImage(images.jelly, frame*sw, 0, sw, sh, -d.w*.57,-d.h*.82,d.w*1.14,d.h*1.64);
    }
  }
  ctx.restore();
}
function drawWorld(){
  ctx.save(); ctx.translate(-cameraX,0);
  for (const p of platforms){
    if (p.kind==='ground') drawGroundStrip(p);
  }
  drawOwner();
  for (const p of platforms){
    if (p.kind==='normal' || p.kind==='lap') drawNormalPlatform(p);
    else if (p.kind==='wall') drawNormalPlatform(p);
    else if (p.kind==='low') drawNormalPlatform(p);
  }
  for (const m of movers) drawMovingPlatform(m);
  for (const b of breakables) drawGlassPlatform(b);
  for (const f of fans) drawFan(f);
  for (const c of checkpoints) drawCheckpoint(c);
  for (const p of pickups) drawPickup(p);
  for (const u of unlocks) drawUnlock(u);
  for (const m of mice) drawMouse(m);
  drawPlayer();
  if (mode === 'cutscene' || mode === 'won') drawPetHand();
  ctx.restore();
}
function drawHUD(){
  ctx.save();
  ctx.fillStyle='#fff5e6e8'; ctx.strokeStyle='#60483d'; ctx.lineWidth=3; drawRounded(28,24,520,88,22); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#44342e'; ctx.font='800 27px system-ui'; ctx.fillText('🥫 '+player.cans+'    ✨ '+player.rare+'×3',52,62); ctx.font='700 20px system-ui'; ctx.fillText('1 КОТ',52,95);
  const forms=[['ball','2 ШАР'],['cape','3 ПЛАЩ'],['jelly','4 ЖЕЛЕ']]; let xx=160;
  for (const [f,l] of forms){ ctx.fillStyle = player.unlocked[f] ? (player.form===f?'#d85d50':'#806452') : '#b9a99c'; ctx.globalAlpha = player.unlocked[f]?1:.45; drawRounded(xx,73,105,29,10); ctx.fill(); ctx.fillStyle='white'; ctx.font='800 14px system-ui'; ctx.fillText(l,xx+9,94); xx+=115; }
  ctx.globalAlpha = 1;
  ctx.fillStyle='#4f4038'; drawRounded(1160,35,390,22,11); ctx.fill(); ctx.fillStyle='#e16652'; drawRounded(1160,35,390*Math.min(1,player.x/(owner.trigger.x+120)),22,11); ctx.fill(); ctx.fillStyle='#44342e'; ctx.font='700 16px system-ui'; ctx.textAlign='right'; ctx.fillText('К ЗОЗЯЦКЕ →',1548,84); ctx.textAlign='left';
  if (messageT>0){ const a=Math.min(1,messageT*3); ctx.globalAlpha=a; ctx.fillStyle='#382c29e8'; drawRounded(W/2-230,130,460,66,20); ctx.fill(); ctx.fillStyle='#fff4e5'; ctx.font='900 26px system-ui'; ctx.textAlign='center'; ctx.fillText(message,W/2,172); ctx.textAlign='left'; }
  if (mode==='cutscene' || mode==='won'){
    ctx.fillStyle='rgba(55,40,34,.72)'; drawRounded(W/2-210,28,420,46,18); ctx.fill(); ctx.fillStyle='#fff0e0'; ctx.textAlign='center'; ctx.font='900 22px system-ui'; ctx.fillText('Зозяцка гладит котика', W/2, 58); ctx.textAlign='left';
    if (mode==='won'){ ctx.fillStyle='rgba(255,245,231,.95)'; drawRounded(W-280,H-76,250,48,16); ctx.fill(); ctx.fillStyle='#533d31'; ctx.font='800 18px system-ui'; ctx.textAlign='center'; ctx.fillText('ENTER — ещё раз', W-155, H-45); ctx.textAlign='left'; }
  }
  ctx.restore();
}
function drawTitle(){
  drawBackground();
  ctx.fillStyle='#2e2421aa'; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.translate(W/2,H/2-80);
  ctx.fillStyle='#fff0dd'; ctx.strokeStyle='#5a3e33'; ctx.lineWidth=8; drawRounded(-420,-240,840,500,42); ctx.fill(); ctx.stroke();
  ctx.textAlign='center'; ctx.fillStyle='#d85d50'; ctx.font='1000 68px system-ui'; ctx.fillText('К ЗОЗЯЦКЕ!',0,-125);
  ctx.fillStyle='#44342e'; ctx.font='700 27px system-ui'; ctx.fillText('scrapbook-платформер про очень целеустремлённого кота',0,-72);
  ctx.font='650 25px system-ui'; ctx.fillText('A/D или ←/→ — идти    SPACE — прыгать',0,10); ctx.fillText('прыжок сверху по мыши — убивает её, как в Mario',0,52); ctx.fillText('1 — кот   2 — шар   3 — плащ   4 — желе',0,94);
  ctx.fillStyle='#d85d50'; drawRounded(-190,145,380,74,22); ctx.fill(); ctx.fillStyle='white'; ctx.font='900 30px system-ui'; ctx.fillText('НАЖМИ ENTER',0,193);
  ctx.restore();
}
function render(){
  ctx.clearRect(0,0,W,H);
  const sx = shake ? (Math.random()-.5)*shake : 0, sy = shake ? (Math.random()-.5)*shake : 0;
  ctx.save(); ctx.translate(sx,sy);
  drawBackground();
  if (mode==='title') drawTitle(); else { drawWorld(); drawHUD(); }
  ctx.restore();
}
function loop(ts){
  const dt = Math.min(.033, (ts-last)/1000 || 0); last = ts;
  if (mode==='play') updatePlay(dt); else if (mode==='cutscene' || mode==='won') updateCutscene(dt);
  render(); requestAnimationFrame(loop);
}
function ready(){ const l = document.getElementById('loading'); if (l) l.style.display='none'; requestAnimationFrame(loop); }
})();
