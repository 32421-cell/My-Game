/* game.js
   Enhanced: multiple enemies, boss wave, powerups, rocket ending, leaderboard integration.
   Frontend expects a backend API at API_BASE + '/api/scores' (POST to submit, GET to fetch top).
   Change API_BASE if your server runs elsewhere.
*/

(() => {
  // --- CONFIG ---
  const API_BASE = 'http://localhost:3000'; // change to your backend URL if hosted
  const CANVAS_W = 820; // logical canvas size for display area
  const CANVAS_H = 360;

  // --- DOM & Canvas ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const muteBtn = document.getElementById('muteBtn');
  const scoreText = document.getElementById('scoreText');
  const overlayBox = document.getElementById('overlayBox');
  const overlayStart = document.getElementById('overlayStart');
  const leadersList = document.getElementById('leadersList');
  const submitBtn = document.getElementById('submitBtn');
  const playerNameInput = document.getElementById('playerName');
  const submitMsg = document.getElementById('submitMsg');

  // Audio basics
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;
  let masterGain = null;
  if (audioCtx) { masterGain = audioCtx.createGain(); masterGain.gain.value = 0.9; masterGain.connect(audioCtx.destination); }
  let muted = false;
  const toggleMute = () => { muted = !muted; if (masterGain) masterGain.gain.value = muted ? 0 : 0.9; muteBtn.textContent = muted ? '🔇' : '🔊'; };
  muteBtn.addEventListener('click', toggleMute);

  // small SFX helpers
  function sfxBeep(freq=880, dur=0.06, type='sine') {
    if (!audioCtx || muted) return;
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = 0.0001; o.connect(g); g.connect(masterGain);
    g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
    o.start(); o.stop(audioCtx.currentTime + dur);
  }
  function sfxExplosion() {
    if (!audioCtx || muted) return;
    const bufferSize = audioCtx.sampleRate * 0.28;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
    const src = audioCtx.createBufferSource(); src.buffer = buffer;
    const g = audioCtx.createGain(); g.gain.value = 0.6;
    src.connect(g); g.connect(masterGain); src.start();
  }

  // --- Sprites (embedded SVGs as data URLs) ---
  function svgToDataURL(s){ return 'data:image/svg+xml;utf8,' + encodeURIComponent(s); }
  const hogSVG = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='120'><rect x='10' y='40' width='120' height='56' rx='8' fill='#b86c45' stroke='#6a3e2a' stroke-width='3'/><circle cx='110' cy='30' r='12' fill='#222'/><rect x='120' y='22' width='56' height='6' rx='3' fill='#d6c07a' transform='rotate(-14 120 22)' /></svg>`;
  const hogImg = new Image(); hogImg.src = svgToDataURL(hogSVG);

  const barbSVG = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='140'><rect x='10' y='40' width='60' height='72' rx='6' fill='#c07a40' stroke='#7a4d2a' stroke-width='3'/><rect x='12' y='26' width='56' height='12' rx='3' fill='#a6a6a6'/><rect x='62' y='70' width='12' height='6' fill='#6b3b2a' transform='rotate(18 62 70)' /></svg>`;
  const barbImg = new Image(); barbImg.src = svgToDataURL(barbSVG);

  const archerSVG = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='120'><rect x='6' y='40' width='40' height='50' rx='6' fill='#8bb2d7'/><rect x='8' y='26' width='38' height='8' rx='3' fill='#aacbe6'/><circle cx='34' cy='26' r='6' fill='#222'/><rect x='28' y='46' width='36' height='6' fill='#6b3b2a' transform='rotate(-18 28 46)' /></svg>`;
  const archerImg = new Image(); archerImg.src = svgToDataURL(archerSVG);

  const bruteSVG = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='160'><rect x='6' y='30' width='80' height='90' rx='8' fill='#7a4d2a'/><rect x='28' y='12' width='40' height='12' rx='5' fill='#9b6b48'/><rect x='78' y='80' width='18' height='10' fill='#4a2b21'/></svg>`;
  const bruteImg = new Image(); bruteImg.src = svgToDataURL(bruteSVG);

  const rocketSVG = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='160'><rect x='30' y='40' width='60' height='30' rx='8' fill='#ddd'/><path d='M90 40 L120 60 L90 80 Z' fill='#c33'/><ellipse cx='30' cy='55' rx='8' ry='6' fill='#ff7a00'/></svg>`;
  const rocketImg = new Image(); rocketImg.src = svgToDataURL(rocketSVG);

  // --- Background parallax setup ---
  let clouds = [];
  for (let i=0;i<6;i++) clouds.push({x: Math.random()*CANVAS_W, y: 30 + Math.random()*40, w: 80+Math.random()*120, h:18+Math.random()*14, speed: 0.25 + Math.random()*0.6});

  // --- Game state ---
  let running=false, paused=false, lastTS=0;
  let score=0, high=Number(localStorage.getItem('hr_high')||0);
  let obstacles=[], particles=[];
  let spawnTimer=0, spawnInterval=1100;
  let rocketSequence=false, bossActive=false, boss=null;
  let shake=0;

  // Player
  const groundY = CANVAS_H - 86;
  const player = {
    x: 84, y: groundY, w: 96, h: 72, vy:0, jumping:false, ducking:false, shield:false,
    update(dt){ this.vy += 0.9 * (dt/16); this.y += this.vy * (dt/16); if (this.y>=groundY) { this.y=groundY; this.vy=0; this.jumping=false; } },
    draw(ctx){ ctx.drawImage(hogImg, this.x, this.y, this.w, this.h); if (this.shield){ ctx.strokeStyle='#44aaff'; ctx.lineWidth=3; ctx.strokeRect(this.x-6,this.y-6,this.w+12,this.h+12); } },
    bounds(){ return {x:this.x+8,y:this.y+8,w:this.w-16,h:this.h-16}; }
  };

  // Enemy classes
  class Obstacle {
    constructor(kind, speed){
      this.kind = kind; this.speed = speed;
      if (kind==='barbarian'){ this.w = 48 + Math.random()*24; this.h = 56 + Math.random()*18; this.img = barbImg; }
      else if (kind==='archer'){ this.w = 40; this.h = 36; this.img = archerImg; }
      else if (kind==='brute'){ this.w = 68; this.h = 84; this.img = bruteImg; }
      else if (kind==='fast'){ this.w=36; this.h=44; this.img = barbImg; } // reuse sprite
      this.x = CANVAS_W + 40; this.y = groundY + (player.h - this.h);
      if (kind === 'archer') this.y = groundY - 80; // flying/archer placed higher
      this.passed=false;
      this.hp = (kind==='brute') ? 3 : 1;
    }
    update(dt){ this.x -= this.speed * (dt/16); }
    draw(ctx){
      // shadow
      ctx.fillStyle='rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(this.x + this.w/2, this.y + this.h + 6, this.w*0.55, 7, 0,0,Math.PI*2); ctx.fill();
      ctx.drawImage(this.img, this.x, this.y, this.w, this.h);
      // HP bar for brute
      if (this.hp>1){
        ctx.fillStyle='#222'; ctx.fillRect(this.x, this.y-10, this.w, 6);
        ctx.fillStyle='#ff6f3c'; ctx.fillRect(this.x, this.y-10, this.w * (this.hp/3), 6);
      }
    }
    bounds(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; }
  }

  // Boss (special)
  class Boss {
    constructor(){
      this.x = CANVAS_W + 120; this.y = groundY - 140; this.w = 220; this.h = 220;
      this.vx = -1.2; this.hp = 60; this.phase = 0; this.attackTimer = 0;
    }
    update(dt){
      // slight entrance
      if (this.x > CANVAS_W - 420) { this.x -= 0.6 * (dt/16); return; }
      this.attackTimer += dt;
      // boss attacks periodically (spawn minions or shots)
      if (this.attackTimer > 1800) {
        this.attackTimer = 0;
        // spawn two brutes and one archer from boss position
        const bs = [new Obstacle('brute', 2.0), new Obstacle('brute', 2.4), new Obstacle('archer', 3.0)];
        for (let b of bs) { b.x = this.x - 40 + Math.random()*40; obstacles.push(b); }
      }
    }
    draw(ctx){
      ctx.save();
      // boss body
      ctx.fillStyle = '#4a2b21'; ctx.fillRect(this.x, this.y, this.w, this.h);
      // battlements
      ctx.fillStyle='#2b2b2b'; for (let i=0;i<12;i++) ctx.fillRect(this.x + i*18, this.y-16, 12, 12);
      // hp
      ctx.fillStyle='#222'; ctx.fillRect(this.x+20, this.y+8, this.w-40, 12);
      ctx.fillStyle='#ff6f3c'; ctx.fillRect(this.x+20, this.y+8, (this.w-40) * (this.hp/60), 12);
      ctx.restore();
    }
    hit(damage){ this.hp -= damage; if (this.hp <= 0) { bossActive=false; boss=null; spawnParticles(this.x + this.w/2, this.y + this.h/2, 80); sfxExplosion(); shake = 18; setTimeout(()=>{ running=false; showEnd(true); }, 900); } }
  }

  // Particles
  function spawnParticles(x,y,count=30) {
    for (let i=0;i<count;i++) particles.push({x,y,vx:(Math.random()-0.5)*6, vy:(Math.random()-1.5)*6, life:60+Math.random()*80, size:2+Math.random()*3, col:['#ffcf5c','#ff6f3c','#ff3c3c'][Math.floor(Math.random()*3)]});
    sfxExplosion();
  }

  // Rocket cinematic
  const rocket = {active:false, x: CANVAS_W+80, y:-120, vx:-10, vy:4, targetX: CANVAS_W - 180, targetY: groundY - 14, launch(){ this.active=true; this.x=CANVAS_W+80; this.y=-120; this.vx=-10; this.vy=4; sfxBeep(140,0.5,'sawtooth'); } };
  function updateRocket(dt){
    if (!rocket.active) return;
    const ax = (rocket.targetX - rocket.x) * 0.002;
    const ay = (rocket.targetY - rocket.y) * 0.003;
    rocket.vx += ax * (dt/16);
    rocket.vy += ay * (dt/16);
    rocket.x += rocket.vx * (dt/16);
    rocket.y += rocket.vy * (dt/16);
    particles.push({x:rocket.x+6, y:rocket.y+10, vx:(Math.random()-0.5)*1, vy:Math.random()*1+0.5, life:30+Math.random()*30, size:2, col:'#ff8d3c'});
    if (rocket.x < rocket.targetX + 6 && rocket.y > rocket.targetY - 10) {
      rocket.active = false;
      spawnParticles(rocket.targetX, rocket.targetY, 120);
      shake = 20;
      setTimeout(()=>{ running=false; showEnd(true); }, 900);
    }
  }

  // Collision check
  function overlaps(a,b){ return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h); }

  // Controls
  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') && !player.jumping) { player.vy = -14; player.jumping = true; sfxBeep(880,0.06); }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') player.ducking = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'ArrowDown' || e.code === 'KeyS') player.ducking = false; });

  canvas.addEventListener('mousedown', ()=>{ if (!running) startGame(); if (!player.jumping) { player.vy = -14; player.jumping = true; sfxBeep(880,0.06); } });
  canvas.addEventListener('touchstart', (ev)=>{ ev.preventDefault(); if (!running) startGame(); if (!player.jumping){ player.vy = -14; player.jumping = true; sfxBeep(880,0.06); } }, {passive:false});

  // Draw background
  function drawBackground(ts){
    // sky gradient
    const grd = ctx.createLinearGradient(0,0,0,CANVAS_H);
    grd.addColorStop(0,'#3d3d42'); grd.addColorStop(0.6,'#2a2a2c'); grd.addColorStop(1,'#171718');
    ctx.fillStyle = grd; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    // clouds parallax
    for (let i=0;i<clouds.length;i++){
      const c = clouds[i];
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.ellipse((c.x - (ts*0.02*c.speed)) % (CANVAS_W + 200) - 120, c.y, c.w, c.h, 0,0,Math.PI*2); ctx.fillStyle='#bfbfbf'; ctx.fill();
    }
    ctx.globalAlpha = 1;
    // distant banners
    for (let i=0;i<3;i++){ const bx = (i*260 + (ts*0.03*(0.4+i*0.12))) % (CANVAS_W+300) - 60; ctx.fillStyle='#7a2c2c'; ctx.fillRect(bx, CANVAS_H - 140 - i*8, 28, 20 + Math.sin(ts*0.002 + i)*6); }
    // hills
    ctx.save(); ctx.fillStyle='#333'; ctx.beginPath(); ctx.moveTo(-40, CANVAS_H-80); ctx.quadraticCurveTo(120, CANVAS_H-160, 320, CANVAS_H-80); ctx.quadraticCurveTo(540, CANVAS_H-20, 760, CANVAS_H-80); ctx.quadraticCurveTo(920, CANVAS_H-120, 1100, CANVAS_H-60); ctx.lineTo(CANVAS_W, CANVAS_H); ctx.lineTo(0,CANVAS_H); ctx.closePath(); ctx.fill(); ctx.restore();
    // base (target)
    ctx.save(); ctx.fillStyle='#222'; ctx.fillRect(CANVAS_W - 260, CANVAS_H - 92, 220, 72); ctx.fillStyle='#111'; for (let i=0;i<6;i++) ctx.fillRect(CANVAS_W - 260 + i*34, CANVAS_H - 104, 20,12); ctx.fillStyle='#b22222'; ctx.beginPath(); ctx.moveTo(CANVAS_W - 60, CANVAS_H - 110); ctx.lineTo(CANVAS_W - 40, CANVAS_H - 114); ctx.lineTo(CANVAS_W - 60, CANVAS_H - 98); ctx.closePath(); ctx.fill(); ctx.restore();
    // ground strip
    ctx.fillStyle='#111'; ctx.fillRect(0, CANVAS_H - 20, CANVAS_W, 20);
  }

  // Draw everything
  function draw(ts){
    let ox=0, oy=0;
    if (shake>0){ ox=(Math.random()-0.5)*shake; oy=(Math.random()-0.5)*shake; shake=Math.max(0, shake-0.6); }
    ctx.save(); ctx.translate(ox,oy);
    drawBackground(ts);
    for (const o of obstacles) o.draw(ctx);
    if (bossActive && boss) boss.draw(ctx);
    player.draw(ctx);
    // particles
    for (let i = particles.length -1; i>=0; i--){
      const p = particles[i];
      ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 1; if (p.life<=0) particles.splice(i,1);
    }
    // rocket (draw)
    if (rocket.active) ctx.drawImage(rocketImg, rocket.x, rocket.y, 64, 96);
    // HUD
    ctx.fillStyle='#fff'; ctx.font='18px Inter, Arial'; ctx.textAlign='left'; ctx.fillText(`Score: ${Math.floor(score)}`, 14, 26);
    ctx.restore();
  }

  // game update
  function update(dt, ts){
    if (!running) return;
    const difficulty = 1 + Math.min(3.2, score / 900);
    const speed = 3.6 * difficulty;

    player.update(dt);

    // spawn varied enemies: weighted random
    spawnTimer += dt;
    if (spawnTimer > spawnInterval / difficulty){
      spawnTimer = 0;
      const r = Math.random();
      if (!bossActive && Math.floor(score) >= 1200 && !rocketSequence){
        // trigger boss entrance (once)
        bossActive = true; boss = new Boss();
      } else if (r < 0.45) obstacles.push(new Obstacle('barbarian', speed + Math.random()*1.4));
      else if (r < 0.65) obstacles.push(new Obstacle('fast', speed * 1.6));
      else if (r < 0.85) obstacles.push(new Obstacle('archer', speed * 0.9));
      else obstacles.push(new Obstacle('brute', speed * 0.7));
      // make spawn interval dynamic
      spawnInterval = Math.max(480, 1100 - score/1.7);
    }

    for (let i = obstacles.length - 1; i >= 0; i--){
      const o = obstacles[i];
      o.update(dt);
      if (o.x + o.w < -40) obstacles.splice(i,1);
      else {
        if (overlaps(player.bounds(), o.bounds())){
          if (player.shield){ player.shield=false; obstacles.splice(i,1); spawnParticles(o.x + o.w/2, o.y + o.h/2, 18); }
          else { running=false; showEnd(false); return; }
        }
        if (!o.passed && o.x + o.w < player.x){ o.passed=true; score += (o.kind==='brute')? 80 : 25; if (Math.floor(score) > high) { high = Math.floor(score); localStorage.setItem('hr_high', high); } }
      }
    }

    // boss update and collisions with player (player can "hit" boss by passing under? for demo we let passing produce damage)
    if (bossActive && boss){
      boss.update(dt);
      // if player is roughly aligned with boss's x while jumping down, treat as player strike (fun mechanic)
      if (player.y < groundY && Math.abs((player.x + player.w/2) - (boss.x + boss.w/2)) < 80) {
        boss.hit(4); score += 12;
      }
    }

    // rocket trigger at high score
    if (Math.floor(score) >= 2000 && !rocketSequence) { rocketSequence = true; setTimeout(()=>rocket.launch(), 1300); }

    updateRocket(dt);

    // time-based scoring
    score += 0.03 * (dt/16) * (1 + difficulty*0.16);
  }

  // main loop
  function loop(ts){
    if (!running) return;
    const dt = lastTS ? Math.min(40, ts - lastTS) : 16;
    lastTS = ts;
    if (!paused) { update(dt, ts); ctx.clearRect(0,0,CANVAS_W,CANVAS_H); draw(ts); }
    scoreText.textContent = `Score: ${Math.floor(score)} • High: ${high}`;
    requestAnimationFrame(loop);
  }

  // overlay / end
  function showEnd(victory){
    overlayBox.style.display = 'block';
    document.getElementById('overlayTitle').textContent = victory ? 'Victory! Rocket Impact!' : 'Defeated';
    document.getElementById('overlayDesc').innerHTML = victory ? `The rocket destroyed the base! Final score: <strong>${Math.floor(score)}</strong>` :
      `You were stopped by the enemy. Final score: <strong>${Math.floor(score)}</strong>`;
    overlayStart.textContent = 'Play Again';
    startBtn.style.display = 'inline-block'; pauseBtn.style.display = 'none';
    if (Math.floor(score) > high) { high = Math.floor(score); localStorage.setItem('hr_high', high); }
  }

  // controls UI
  function startGame(){
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    obstacles=[]; particles=[]; score=0; spawnTimer=0; spawnInterval=1100; player.y=groundY; player.vy=0; player.jumping=false; player.shield=false;
    rocket.active=false; rocketSequence=false; bossActive=false; boss=null; shake=0;
    running=true; paused=false; lastTS=0;
    overlayBox.style.display='none'; startBtn.style.display='none'; pauseBtn.style.display='inline-block';
    requestAnimationFrame(loop);
  }
  function togglePause(){ paused = !paused; pauseBtn.textContent = paused ? 'Resume' : 'Pause'; }

  // hook UI
  startBtn.addEventListener('click', startGame);
  overlayStart.addEventListener('click', startGame);
  pauseBtn.addEventListener('click', togglePause);

  // Leaderboard frontend: fetch & submit
  async function fetchLeaderboard(){
    leadersList.innerHTML = '<li>Loading...</li>';
    try {
      const res = await fetch(`${API_BASE}/api/scores`);
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      leadersList.innerHTML = '';
      if (!data || data.length === 0) leadersList.innerHTML = '<li>No scores yet</li>';
      for (const item of data) {
        const li = document.createElement('li');
        li.textContent = `${item.name} — ${item.score}`;
        leadersList.appendChild(li);
      }
    } catch (err) {
      leadersList.innerHTML = '<li>Unable to load (run server?)</li>';
      console.warn('Leaderboard fetch failed:', err);
    }
  }
  fetchLeaderboard();
  setInterval(fetchLeaderboard, 30_000); // refresh leaderboard every 30s

  submitBtn.addEventListener('click', async () => {
    const name = (playerNameInput.value || 'Anon').slice(0,16).trim();
    const payload = { name, score: Math.floor(score) };
    submitMsg.textContent = 'Submitting...';
    try {
      const res = await fetch(`${API_BASE}/api/scores`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      if (!res.ok) throw new Error('Submit failed');
      submitMsg.textContent = 'Submitted ✅';
      playerNameInput.value = '';
      fetchLeaderboard();
    } catch (err) {
      submitMsg.textContent = 'Submit failed (server?)';
      console.warn('Submit error', err);
    }
    setTimeout(()=> submitMsg.textContent = '', 2500);
  });

  // initial overlay show
  overlayBox.style.display = 'block';
  console.log('Enhanced Hog Rider Runner loaded (multi-enemies + leaderboard front-end).');

})();
