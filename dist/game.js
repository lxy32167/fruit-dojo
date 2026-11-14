const $ = (id) => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d', { alpha: true });
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const choose = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const storage = { get(k, fallback) { try { return JSON.parse(localStorage.getItem(`dojo-${k}`)) ?? fallback; } catch { return fallback; } }, set(k, value) { try { localStorage.setItem(`dojo-${k}`, JSON.stringify(value)); } catch { /* Private browsing still supports playing. */ } } };
let W = 1000, H = 700, state = 'home', mode = 'classic', score = 0, misses = 0, elapsed = 0, spawnIn = 0;
let fruits = [], pieces = [], particles = [], splats = [], labels = [], trails = new Map(), strokes = new Map();
let best = storage.get('best', { classic: 0, zen: 0 }), soundOn = storage.get('sound', true), cutCount = 0, topCombo = 0;
let clock = 0, shake = 0, flash = 0, endDelay = -1, lastTime = 0, lastSwish = 0, dialogAction = null, secondaryAction = null, previousFocus;
let audioCtx, noiseBuffer, toastTimer, dialogReturn = 'home';
const types = [
 { name: '西瓜', color: '#e64b4b', rind: '#3f813a', light: '#a9c766', flesh: '#f66461', radius: 45 },
 { name: '橙子', color: '#ffa324', rind: '#e78216', light: '#ffcd4a', flesh: '#ffbc37', radius: 37 },
 { name: '苹果', color: '#e95545', rind: '#b72e32', light: '#ff8e57', flesh: '#ffe7b0', radius: 38 },
 { name: '猕猴桃', color: '#a3c34a', rind: '#85602f', light: '#b79b5a', flesh: '#b0d252', radius: 35 },
 { name: '柠檬', color: '#f2dc47', rind: '#d9ac22', light: '#fff28d', flesh: '#f9df63', radius: 35 },
 { name: '桃子', color: '#f5a580', rind: '#e97b6b', light: '#ffdea0', flesh: '#ffd49a', radius: 39 }
];
const splatImages = new Map();
const splatAtlas = new Image();
splatAtlas.onload = () => {
 for (const type of types) {
  const tile = document.createElement('canvas'); tile.width = tile.height = 128;
  const paint = tile.getContext('2d');
  paint.drawImage(splatAtlas, 256, 0, 256, 256, 0, 0, 128, 128);
  paint.globalCompositeOperation = 'source-in'; paint.fillStyle = type.color; paint.fillRect(0,0,128,128);
  splatImages.set(type.color,tile);
 }
};
splatAtlas.src = 'assets/splats.webp';
const audioFiles = { slice:'slice.wav', bomb:'bomb.wav', combo:'combo.wav', launch:'launch.wav' };
const soundBuffers = new Map(); let audioLoading = false;
function loadAudio() {
 if(audioLoading || !audioCtx)return; audioLoading = true;
 for(const [name,file] of Object.entries(audioFiles))fetch(`assets/${file}`).then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer();}).then(b=>audioCtx.decodeAudioData(b)).then(b=>soundBuffers.set(name,b)).catch(()=>{});
}
function sample(name,volume=0.4) {
 if(!soundOn||!audioCtx)return true;
 const buffer=soundBuffers.get(name);if(!buffer)return false;
 const source=audioCtx.createBufferSource(),gain=audioCtx.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain);gain.connect(audioCtx.destination);source.start();return true;
}
function resize() {
 const oldH = H, r = canvas.getBoundingClientRect();
 W = 1000; H = W * r.height / r.width;
 const dpr = Math.min(devicePixelRatio || 1, 2);
 canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
 for (const f of [...fruits, ...pieces]) f.y += H - oldH;
 trails.clear(); strokes.clear();
 if (state === 'playing') pause();
}
window.addEventListener('resize', resize); resize();
function unlockAudio() {
 if (!soundOn) return;
 try { audioCtx ??= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume().catch(() => {}); loadAudio(); } catch { /* Audio is optional. */ }
}
function tone(freq, length, shape = 'sine', gain = .08, end = freq) {
 if (!soundOn || !audioCtx) return;
 const t = audioCtx.currentTime, osc = audioCtx.createOscillator(), vol = audioCtx.createGain();
 osc.type = shape; osc.frequency.setValueAtTime(freq, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + length);
 vol.gain.setValueAtTime(gain, t); vol.gain.exponentialRampToValueAtTime(.001, t + length); osc.connect(vol); vol.connect(audioCtx.destination); osc.start(t); osc.stop(t + length);
}
function noise(length, gain, freq) {
 if (!soundOn || !audioCtx) return;
 if (!noiseBuffer) { noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate); const d = noiseBuffer.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1; }
 const source = audioCtx.createBufferSource(), filter = audioCtx.createBiquadFilter(), vol = audioCtx.createGain(), t = audioCtx.currentTime;
 source.buffer = noiseBuffer; filter.type = 'lowpass'; filter.frequency.value = freq; vol.gain.setValueAtTime(gain,t); vol.gain.exponentialRampToValueAtTime(.001,t+length);
 source.connect(filter); filter.connect(vol); vol.connect(audioCtx.destination); source.start(t); source.stop(t+length);
}
function toast(text) { $('toast').textContent=text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2400); }
function updateHud() {
 $('score').textContent=score; $('best').textContent=best[mode] || 0; $('home-best').textContent=best[mode] || 0;
 [...$('lives').children].forEach((n,i)=>n.classList.toggle('lost',i<misses)); $('lives').setAttribute('aria-label',`已漏掉 ${misses} 个水果`);
 const remaining=Math.max(0,Math.ceil(90-elapsed)); $('timer').textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
}
function saveBest() { if(score>(best[mode]||0)) { best[mode]=score; storage.set('best',best); } }
function start() {
 unlockAudio(); mode=document.querySelector('.mode.active').dataset.mode; state='playing'; score=0; misses=0; elapsed=0; spawnIn=.65;
 fruits=[];pieces=[];particles=[];splats=[];labels=[];trails.clear();strokes.clear();cutCount=0;topCombo=0;shake=0;flash=0;endDelay=-1;
 $('home').hidden=true; $('footer').hidden=true; $('overlay').hidden=true; $('hud').hidden=false; $('game-hint').hidden=false;document.body.classList.add('playing');
 $('lives').hidden=mode==='zen';$('timer').hidden=mode!=='zen';$('status-label').textContent=mode==='zen'?'剩余时间':'漏掉水果';
 updateHud(); tone(350,.12,'sine',.08,600); $('pause').focus({preventScroll:true});
}
function openDialog(kicker, title, content, primary, action, secondary='返回道场', other=home) {
 previousFocus=document.activeElement; $('dialog-kicker').textContent=kicker;$('dialog-title').textContent=title;$('dialog-content').innerHTML=content;
 $('dialog-primary').textContent=primary;$('dialog-secondary').textContent=secondary;dialogAction=action;secondaryAction=other;$('overlay').hidden=false;
 $('dialog-primary').focus({preventScroll:true});trails.clear();strokes.clear();
}
function closeDialog() { $('overlay').hidden=true; previousFocus?.focus({preventScroll:true}); }
function pause() { if(state!=='playing')return; for(const stroke of strokes.values())finishStroke(stroke); state='paused';openDialog('TAKE A BREATH','稍作休息','<p>刀收鞘，心放松。<br>你的水果正在等你回来。</p>','继续游戏 ↗',resume); }
function resume() { unlockAudio();state='playing';closeDialog();lastTime=performance.now(); }
function home() { saveBest();state='home';fruits=[];pieces=[];particles=[];splats=[];labels=[];trails.clear();strokes.clear();$('home').hidden=false;$('footer').hidden=false;$('hud').hidden=true;$('game-hint').hidden=true;$('overlay').hidden=true;document.body.classList.remove('playing');updateHud();$('start').focus({preventScroll:true}); }
function finish(reason) {
 if(state!=='playing')return;
 for(const stroke of strokes.values()) finishStroke(stroke);
 strokes.clear();const record=score>(best[mode]||0);saveBest();state='over';endDelay=-1;$('game-hint').hidden=true;
 openDialog(record?'A NEW PERSONAL BEST':'EVERY SLICE COUNTS',record?'新的纪录！':'下次，再多一刀',`<div class="result-score">${score}</div><div class="result-caption">${reason}</div><div class="result-stats"><div><b>${cutCount}</b><span>切开水果</span></div><div><b>${topCombo}</b><span>最佳连击</span></div><div><b>${best[mode]||0}</b><span>历史最高</span></div></div>`,'再来一局 ↗',start);
 updateHud();
}
function spawnWave() {
 const count=Math.min(6,Math.floor(rnd(2,4+Math.min(elapsed/40,3))));
 const center=rnd(240,760), apex=H*.29+rnd(0,H*.12), gravity=Math.max(720,H*1.35);
 for(let i=0;i<count;i++) {
  const type=choose(types), x=clamp(center+(i-(count-1)/2)*rnd(75,100),100,900);
  const vy=-Math.sqrt(2*gravity*(H+60-apex))+rnd(-35,30);
  fruits.push({x,y:H+80+i*18,vx:(500-x)*rnd(.07,.22)+rnd(-45,45),vy,g:gravity,r:type.radius,angle:rnd(0,TAU),spin:rnd(-2,2),type,bomb:false,entered:false});
 }
 if(mode==='classic' && elapsed>4 && Math.random()<Math.min(.65,.28+elapsed/160)) {
  const x=rnd(130,870);fruits.push({x,y:H+110,vx:(500-x)*.15,vy:-Math.sqrt(2*gravity*(H+100-apex*.85)),g:gravity,r:38,angle:0,spin:rnd(-1,1),bomb:true,entered:false});
 }
 spawnIn=Math.max(.95,2.15-elapsed*.006)+rnd(0,.35);if(!sample('launch',.13))tone(190,.17,'sine',.025,350);
}
function distanceToSegment(p,a,b) { const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t); }
function slice(f, angle, stroke) {
 f.dead=true;
 if(f.bomb) {
  flash=1;shake=24;endDelay=.65;if(!sample('bomb',.55)){noise(.8,.55,900);tone(65,.7,'sawtooth',.2,22);}
  for(let i=0;i<55;i++) particles.push({x:f.x,y:f.y,vx:rnd(-450,450),vy:rnd(-500,250),r:rnd(3,12),life:rnd(.3,1),max:1,color:choose(['#fff0ba','#ffa229','#e65b2e','#483d36'])});
  labels.push({x:f.x,y:f.y-70,text:'碰到炸弹！',color:'#ff9875',life:1.1,max:1.1,size:32});return;
 }
 score++;cutCount++;stroke.hits++;stroke.x=f.x;stroke.y=f.y;stroke.last=clock;
 const nx=-Math.sin(angle),ny=Math.cos(angle);
 for(const side of [-1,1]) pieces.push({...f,dead:false,x:f.x+nx*side*4,y:f.y+ny*side*4,vx:f.vx+nx*side*150,vy:f.vy*.25+ny*side*130-70,spin:side*rnd(1.6,3.8),side,cut:angle-f.angle,life:1.4});
 for(let i=0;i<23;i++) particles.push({x:f.x,y:f.y,vx:rnd(-260,260),vy:rnd(-280,150),r:rnd(2,7),life:rnd(.3,.8),max:.8,color:f.type.color});
 splats.push({x:f.x,y:f.y,r:rnd(20,40),color:f.type.color,life:7,angle:rnd(0,TAU)});if(splats.length>36)splats.shift();
 if(!sample('slice',.35)){noise(.1,.16,1700);tone(rnd(470,800),.075,'sine',.05,200);}updateHud();
}
function finishStroke(stroke) {
 if(stroke.hits>=3) { const bonus=stroke.hits;score+=bonus;topCombo=Math.max(topCombo,stroke.hits);labels.push({x:clamp(stroke.x,130,870),y:clamp(stroke.y-70,140,H-150),text:`${stroke.hits} 连击  +${bonus}`,color:'#ffd175',life:1.1,max:1.1,size:38});if(!sample('combo',.4))tone(660,.2,'triangle',.09,990);updateHud(); }
 stroke.hits=0;
}
function point(e) { const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height,t:clock}; }
canvas.addEventListener('pointerdown',e=>{
 if(state!=='playing'||endDelay>=0)return;e.preventDefault();unlockAudio();canvas.setPointerCapture(e.pointerId);const p=point(e);trails.set(e.pointerId,[p]);strokes.set(e.pointerId,{hits:0,last:clock,previous:p});
});
canvas.addEventListener('pointermove',e=>{
 const stroke=strokes.get(e.pointerId);if(!stroke||state!=='playing'||endDelay>=0)return;e.preventDefault();
 const events=e.getCoalescedEvents?.() || [e];
 for(const event of events.length?events:[e]) {
  const p=point(event),a=stroke.previous;const length=Math.hypot(p.x-a.x,p.y-a.y);if(length<2)continue;
  if(clock-stroke.last>.24&&stroke.hits)finishStroke(stroke);
  const angle=Math.atan2(p.y-a.y,p.x-a.x);
  // Line-segment collision catches fast swipes between pointer samples.
  for(const f of fruits) { if(!f.dead && distanceToSegment(f,a,p)<f.r*.9) {slice(f,angle,stroke);if(endDelay>=0)break;} }
  const trail=trails.get(e.pointerId);trail?.push(p);if(trail?.length>45)trail.shift();stroke.previous=p;
  if(length>15&&clock-lastSwish>.13){noise(.065,.025,3500);lastSwish=clock;}
  if(endDelay>=0)break;
 }
});
function release(e){const s=strokes.get(e.pointerId);if(s&&state==='playing')finishStroke(s);strokes.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);canvas.addEventListener('contextmenu',e=>e.preventDefault());
function fruitShape(type,r) {
 ctx.beginPath();
 if(type===types[4])ctx.ellipse(0,0,r*1.14,r*.84,0,0,TAU);
 else if(type===types[2]||type===types[5]){ctx.moveTo(0,-r*.78);ctx.bezierCurveTo(r*.8,-r*1.25,r*1.24,-r*.38,r*.78,r*.5);ctx.bezierCurveTo(r*.5,r*1.1,r*.2,r*.95,0,r*.87);ctx.bezierCurveTo(-r*.25,r,-r*.57,r,-r*.83,r*.45);ctx.bezierCurveTo(-r*1.24,-r*.4,-r*.65,-r*1.25,0,-r*.78);}
 else ctx.arc(0,0,r,0,TAU);
}
function drawFruit(f, half=false) {
 const r=f.r,type=f.type;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.angle);
 if(f.bomb){drawBomb(r);ctx.restore();return;}
 ctx.shadowColor='#09070577';ctx.shadowBlur=12;ctx.shadowOffsetY=9;
 fruitShape(type,r);const g=ctx.createRadialGradient(-r*.36,-r*.43,0,r*.15,r*.2,r*1.3);g.addColorStop(0,type.light);g.addColorStop(.55,type.rind);g.addColorStop(1,'#392514');ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 if(half){
  // Each half keeps the silhouette and presents its cut face along the actual swipe.
  ctx.rotate(f.cut);ctx.beginPath();ctx.rect(-r*1.5,f.side<0?-r*1.5:0,r*3,r*1.5);ctx.clip();
  fruitShape(type,r);ctx.fillStyle=type.rind;ctx.fill();ctx.scale(.88,.88);fruitShape(type,r);ctx.fillStyle=type===types[0]?'#e9e0a1':type.light;ctx.fill();ctx.scale(.90,.90);fruitShape(type,r);ctx.fillStyle=type.flesh;ctx.fill();
  if(type===types[1]||type===types[4]){ctx.strokeStyle='#fff6b68a';ctx.lineWidth=2;for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(i*TAU/9)*r,Math.sin(i*TAU/9)*r);ctx.stroke();}ctx.fillStyle='#fff2bc';ctx.beginPath();ctx.arc(0,0,5,0,TAU);ctx.fill();}
  else if(type===types[0]||type===types[3]){ctx.fillStyle=type===types[3]?'#ece9b7':'#ef8871';ctx.beginPath();ctx.ellipse(0,0,r*.2,r*.29,0,0,TAU);ctx.fill();ctx.fillStyle='#372718';for(let i=0;i<12;i++){const a=i*TAU/12;ctx.beginPath();ctx.ellipse(Math.cos(a)*r*.6,Math.sin(a)*r*.6,2,3.8,a,0,TAU);ctx.fill();}}
  else {ctx.fillStyle='#c9a175';ctx.beginPath();ctx.ellipse(0,0,7,13,0,0,TAU);ctx.fill();}
 } else {
  if(type===types[0]){ctx.save();fruitShape(type,r);ctx.clip();ctx.strokeStyle='#214f2d88';ctx.lineWidth=7;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*18,-r);ctx.bezierCurveTo(i*22-13,-r*.3,i*22+12,r*.35,i*17,r);ctx.stroke();}ctx.restore();}
  else if(type===types[1]||type===types[3]||type===types[4]){ctx.fillStyle=type===types[3]?'#4c351c66':'#fff6bd35';for(let i=0;i<48;i++){const a=i*2.399,rad=Math.sqrt(i/48)*r*.85;ctx.beginPath();ctx.arc(Math.cos(a)*rad,Math.sin(a)*rad,1,0,TAU);ctx.fill();}}
  if(type===types[2]||type===types[5]||type===types[1]){ctx.strokeStyle='#6e4826';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,-r*.76);ctx.quadraticCurveTo(-4,-r*.98,5,-r*1.1);ctx.stroke();ctx.fillStyle='#80a646';ctx.beginPath();ctx.ellipse(13,-r*.95,14,6,-.45,0,TAU);ctx.fill();}
  ctx.fillStyle='#fff6d629';ctx.beginPath();ctx.ellipse(-r*.34,-r*.4,r*.16,r*.28,.5,0,TAU);ctx.fill();
 }
 ctx.restore();
}
function drawBomb(r) {
 const g=ctx.createRadialGradient(-r*.35,-r*.4,2,0,0,r);g.addColorStop(0,'#66645d');g.addColorStop(.4,'#303333');g.addColorStop(1,'#101516');ctx.shadowColor='#0008';ctx.shadowBlur=12;ctx.shadowOffsetY=8;ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.save();ctx.rotate(-.35);ctx.fillStyle='#4b4940';ctx.fillRect(-8,-r-8,16,14);ctx.strokeStyle='#c9ae78';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,-r-8);ctx.quadraticCurveTo(0,-r-30,19,-r-21);ctx.stroke();const x=19,y=-r-21;ctx.fillStyle='#ffcf56';ctx.beginPath();ctx.arc(x,y,4+Math.sin(clock*35)*2,0,TAU);ctx.fill();ctx.strokeStyle='#ffc75d';ctx.lineWidth=2;for(let i=0;i<7;i++){const a=i*TAU/7+clock*3;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*7,y+Math.sin(a)*7);ctx.lineTo(x+Math.cos(a)*14,y+Math.sin(a)*14);ctx.stroke();}ctx.restore();
 ctx.fillStyle='#e6d9bc';ctx.font=`bold ${r*.7}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('×',0,1);
}
function renderHome() {
 const portrait=W/H<1.05;
 const x=portrait?850:720, y=portrait?H*.28:H*.47, s=portrait?.74:1;
 // Floating fruit illustration with a single bright slash.
 const layout=[{i:0,x:35,y:50,r:105,a:-.3},{i:1,x:-110,y:-95,r:58,a:.2},{i:2,x:142,y:-139,r:62,a:.4},{i:3,x:-87,y:184,r:47,a:-.5},{i:5,x:162,y:131,r:58,a:.5}];
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=portrait?.60:1;
 ctx.fillStyle='#b97e2110';ctx.beginPath();ctx.arc(10,20,240,0,TAU);ctx.fill();ctx.strokeStyle='#c7aa6230';ctx.lineWidth=1;ctx.setLineDash([2,11]);ctx.beginPath();ctx.arc(10,20,228,0,TAU);ctx.stroke();ctx.setLineDash([]);
 for(const [j,f] of layout.entries())drawFruit({x:f.x+Math.sin(clock*.45+j)*7,y:f.y+Math.cos(clock*.6+j)*10,r:f.r,angle:f.a+Math.sin(clock*.35+j)*.1,type:types[f.i]});
 for(let i=0;i<15;i++){const a=i*2.4;ctx.fillStyle=i%2?'#e4af4a99':'#e66b4366';ctx.beginPath();ctx.ellipse(Math.cos(a)*(175+i*4),Math.sin(a)*(130+i*5),3+i%4,2+i%3,a,0,TAU);ctx.fill();}
 ctx.save();ctx.rotate(-.55);ctx.shadowColor='#ffd68c';ctx.shadowBlur=18;ctx.fillStyle='#fff3c9';ctx.beginPath();ctx.moveTo(-245,40);ctx.quadraticCurveTo(20,6,260,20);ctx.quadraticCurveTo(10,22,-245,40);ctx.fill();ctx.restore();
 if(!portrait){ctx.font='11px sans-serif';ctx.fillStyle='#c8ab7c';ctx.textAlign='center';ctx.fillText('挥 动 指 尖  ·  切 开 好 心 情',15,295);}
 ctx.restore();
}
function update(dt, realDt = dt) {
 clock+=realDt;
 if(state==='playing') {
  if(endDelay>=0){endDelay-=dt;if(endDelay<0){finish('切中了炸弹');return;}}
  else {
   elapsed+=realDt;spawnIn-=dt;if(spawnIn<=0)spawnWave();
   if(mode==='zen'&&elapsed>=90){finish('90 秒挑战完成');return;}
   for(const s of strokes.values())if(s.hits&&clock-s.last>.24)finishStroke(s);
   for(const f of fruits){if(f.dead)continue;f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=f.g*dt;f.angle+=f.spin*dt;if(f.y<H-f.r)f.entered=true;
    if(f.y>H+f.r+20&&f.vy>0){f.dead=true;if(!f.bomb&&f.entered&&mode==='classic'){misses++;labels.push({x:clamp(f.x,90,910),y:H-90,text:'漏掉了！',color:'#ed8b70',life:.9,max:.9,size:22});tone(170,.16,'triangle',.06,80);if(misses>=3){updateHud();finish('漏掉了 3 个水果');return;}}}
   }
   fruits=fruits.filter(f=>!f.dead);updateHud();
  }
 }
 if(state==='paused'||state==='help')return;
 for(const p of pieces){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.g*dt;p.angle+=p.spin*dt;p.life-=dt;}pieces=pieces.filter(p=>p.life>0&&p.y<H+130);
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=600*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
 for(const p of splats)p.life-=dt;splats=splats.filter(p=>p.life>0);
 for(const l of labels){l.life-=dt;l.y-=24*dt;}labels=labels.filter(l=>l.life>0);
 for(const [id,trail] of trails){while(trail.length&&clock-trail[0].t>.16)trail.shift();if(!trail.length&&!strokes.has(id))trails.delete(id);}
 shake=Math.max(0,shake-dt*40);flash=Math.max(0,flash-dt*2.7);
}
function render() {
 ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);ctx.save();
 if(shake)ctx.translate(rnd(-shake,shake),rnd(-shake,shake));
 if(state==='home'||(state==='help'&&dialogReturn==='home')){renderHome();ctx.restore();return;}
 for(const s of splats){ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.angle);ctx.globalAlpha=Math.min(.18,s.life*.05);ctx.fillStyle=s.color;ctx.beginPath();for(let i=0;i<24;i++){const a=i*TAU/24,r=s.r*(i%2?1:.42);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();if(splatImages.has(s.color))ctx.drawImage(splatImages.get(s.color),-s.r*1.5,-s.r*1.5,s.r*3,s.r*3);else ctx.fill();ctx.restore();}
 for(const f of fruits)if(!f.dead)drawFruit(f);
 for(const p of pieces){ctx.save();ctx.globalAlpha=Math.min(1,p.life*2);ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.rotate(p.cut);ctx.beginPath();ctx.rect(-p.r*1.5,p.side<0?-p.r*1.5:0,p.r*3,p.r*1.5);ctx.clip();ctx.rotate(-p.cut);ctx.rotate(-p.angle);ctx.translate(-p.x,-p.y);drawFruit(p,true);ctx.restore();}
 for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(p.x,p.y,p.r,p.r*.7,Math.atan2(p.vy,p.vx),0,TAU);ctx.fill();}ctx.globalAlpha=1;
 for(const trail of trails.values()){if(trail.length<2)continue;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor='#9eeaff';ctx.shadowBlur=14;for(let i=1;i<trail.length;i++){const a=trail[i-1],b=trail[i],alpha=clamp(1-(clock-b.t)/.16,0,1);ctx.strokeStyle=`rgba(164,232,255,${alpha*.3})`;ctx.lineWidth=13*alpha;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle=`rgba(255,255,239,${alpha})`;ctx.lineWidth=4*alpha;ctx.stroke();}ctx.shadowBlur=0;}
 for(const l of labels){ctx.globalAlpha=Math.min(1,l.life*3);ctx.font=`bold ${l.size}px -apple-system, sans-serif`;ctx.textAlign='center';ctx.fillStyle=l.color;ctx.shadowColor='#160c08';ctx.shadowBlur=7;ctx.fillText(l.text,l.x,l.y);ctx.shadowBlur=0;}ctx.globalAlpha=1;
 if(flash){ctx.fillStyle=`rgba(255,220,165,${flash*.65})`;ctx.fillRect(0,0,W,H);}ctx.restore();
}
function frame(time){const realDt=lastTime?Math.max(0,(time-lastTime)/1000):0;const dt=Math.min(realDt,.033);lastTime=time;update(dt,realDt);render();requestAnimationFrame(frame);}
$('start').addEventListener('click',start);$('pause').addEventListener('click',pause);$('dialog-primary').addEventListener('click',()=>dialogAction?.());$('dialog-secondary').addEventListener('click',()=>secondaryAction?.());
for(const button of document.querySelectorAll('.mode'))button.addEventListener('click',()=>{mode=button.dataset.mode;for(const b of document.querySelectorAll('.mode')){b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));}updateHud();});
function syncSound(){ $('sound').textContent=soundOn?'♪':'♩';$('sound').style.opacity=soundOn?'1':'.45';$('sound').setAttribute('aria-label',soundOn?'关闭声音':'开启声音');$('sound').setAttribute('aria-pressed',String(soundOn)); }
$('sound').addEventListener('click',()=>{soundOn=!soundOn;storage.set('sound',soundOn);unlockAudio();syncSound();toast(soundOn?'声音已开启':'声音已关闭');});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('dojo').requestFullscreen)await $('dojo').requestFullscreen();else toast('在 Safari 分享菜单中选择“添加到主屏幕”');}catch{toast('可通过 Safari“添加到主屏幕”全屏游玩');}});
$('help').addEventListener('click',()=>{dialogReturn=state;if(state==='playing')pause();state='help';openDialog('HOW TO PLAY','指尖，就是刀锋','<p>按住鼠标拖动，或用手指划过水果。<br>一刀连切 3 个及以上，获得额外加分。<br><br><b>经典模式</b>：漏掉三颗水果或切中炸弹，挑战结束。<br><b>禅模式</b>：90 秒内尽情切，没有炸弹，不计漏果。<br><br>Esc / P 暂停 · 切换页面自动暂停</p>','明白了 ↗',()=>{state=dialogReturn;closeDialog();},'回到道场',home);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});window.addEventListener('blur',()=>{if(state==='playing')pause();});
document.addEventListener('keydown',e=>{if(e.code==='Escape'||e.code==='KeyP'){if(state==='playing')pause();else if(state==='paused')resume();else if(state==='help'){state=dialogReturn;closeDialog();}}if(e.key==='Tab'&&!$('overlay').hidden){const buttons=[$('dialog-primary'),$('dialog-secondary')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[1].focus();}else if(!e.shiftKey&&document.activeElement===buttons[1]){e.preventDefault();buttons[0].focus();}}});
syncSound();updateHud();requestAnimationFrame(frame);
if('serviceWorker' in navigator && window.isSecureContext)navigator.serviceWorker.register('./sw.js').catch(()=>{});
