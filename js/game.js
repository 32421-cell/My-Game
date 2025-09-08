// Advanced Hog Rider Runner — All-in-one JS
// Works with index.html + style.css as given.
// No external assets required; everything's drawn to canvas.

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // UI elements
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const muteBtn = document.getElementById('muteBtn');
  const scoreLabel = document.getElementById('scoreLabel');
  const highLabel = document.getElementById('highLabel');
  const overlayContent = document.getElementById('overlayContent');

  // canvas logical size for crisp scaling
  const W = (canvas.width = 960);
  const H = (canvas.height = 360);

  // Game state
  let lastTime = 0;
  let dt = 0;
  let running = false;
  let paused = false;
  let score = 0;
  let distance = 0;
  let highScore = Number(localStorage.getItem('hr_high') || 0);
  let spawnTimer = 0;
  let spawnInterval = 1500; // ms
  let obstacles = [];
  let powerups = [];
  let gameSpeed = 4;
  let gravity = 0.8;
  let mute = false;
  let rocketSequenceStarted = false;

  highLabel.textContent = `High: ${highScore}`;

  // Controls
  const keys = {};
  window.addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  // Mobile tap to jump
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!running) startGame();
    player.jump();
  }, {passive:false});

  canvas.addEventListener('mousedown', (e) => {
    if (!running) startGame();
    player.jump();
  });

  // Basic sound generator (beeps) via WebAudio — small, optional
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;
  function beep(freq=440, time=0.08) {
    if (mute || !audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(audioCtx.destination);
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
    o.start();
    o.stop(audioCtx.currentTime + time);
  }

  // Parallax background layers (drawn shapes to suggest war scene)
  const bg = {
    clouds: [],
    hills: [],
    banners: [],
    base: {x: W - 260, y: H - 92, w: 220, h: 72}
  };

  // Create background objects
  for (let i=0;i<8;i++){
    bg.clouds.push({x: Math.random()*W, y: 20 + Math.random()*60, w: 60+Math.random()*80, h: 20+Math.random()*30, speed: 0.2+Math.random()*0.6});
  }
  for (let i=0;i<5;i++){
    bg.hills.push({x: i*220, y: H-80, w: 300, h: 80, color:'#3b3b3b', speed:0.4 + i*0.02});
  }
  for (let i=0;i<3;i++){
    bg.banners.push({x: 120 + i*260, y: H-130 - (i*4), speed:0.7 + i*0.1});
  }

  // Player Hog Rider
  const player = {
    x: 90,
    y: H - 70,
    w: 72,
    h: 54,
    vy: 0,
    grounded: true,
    ducking: false,
    frame: 0,
    frameTimer: 0,
    frameRate: 120,
    jumpPower: -13,
    color: '#b86c45',
    update(dt){
      // Controls: jump with Space or ArrowUp or KeyW
      if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW']) && this.grounded) {
        this.jump();
      }

      // Duck with ArrowDown
      this.ducking = !!(keys['ArrowDown'] || keys['KeyS']);

      // Physics
      this.vy += gravity * (dt/16);
      this.y += this.vy * (dt/16);
      if (this.y >= H - 70) {
        this.y = H - 70;
        this.vy = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }

      // simple animation frame
      this.frameTimer += dt;
      if (this.frameTimer > this.frameRate) {
        this.frameTimer = 0;
        this.frame = (this.frame + 1) % 4;
      }
    },
    jump(){
      if (!this.grounded) return;
      this.vy = this.jumpPower;
      this.grounded = false;
      beep(880, 0.06);
    },
    draw(ctx){
      // Draw hog rider — stylized
      ctx.save();
      // body shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(this.x+36, this.y+60, this.w*0.6, 8, 0, 0, Math.PI*2);
      ctx.fill();

      // hog mount (ellipse)
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.ellipse(this.x+36, this.y+28, this.w*0.6, this.h*0.6, 0, 0, Math.PI*2);
      ctx.fill();

      // rider (small circle) front
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath();
      ctx.arc(this.x+52, this.y+12, 10, 0, Math.PI*2);
      ctx.fill();

      // spear
      ctx.strokeStyle = '#d6c07a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.x+62, this.y+6);
      ctx.lineTo(this.x+96, this.y-6);
      ctx.stroke();

      // small leg lines for motion when running
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4;
      ctx.beginPath();
      const legY = this.y+36;
      const legOffset = (this.frame % 2 === 0) ? -6 : 6;
      ctx.moveTo(this.x+18, legY);
      ctx.lineTo(this.x+10, legY+14+legOffset*0.2);
      ctx.moveTo(this.x+50, legY);
      ctx.lineTo(this.x+58, legY+14-legOffset*0.2);
      ctx.stroke();

      // small shield
      ctx.fillStyle = '#b23';
      ctx.beginPath();
      ctx.arc(this.x+10, this.y+18, 8, 0, Math.PI*2);
      ctx.fill();

      ctx.restore();
    },
    bounds(){
      // return bounding rect for collision (smaller than drawing)
      return {x: this.x+8, y: this.y+6, w: this.w-20, h: this.h-12};
    }
  };

  // Obstacles: Barbarians
  class Obstacle {
    constructor(x, y, speed){
      this.x = x; this.y = y; this.w = 44 + Math.random()*30; this.h = 48 + Math.random()*16;
      this.speed = speed;
      this.color = '#96806a';
      this.hp = 1;
      this.type = 'barbarian';
      this.passed = false;
    }
    update(dt){
      this.x -= this.speed * (dt/16);
    }
    draw(ctx){
      ctx.save();
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(this.x+6, this.y+this.h-8, this.w-4, 6);

      // body
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.w, this.h);

      // helmet
      ctx.fillStyle = '#bcbcbc';
      ctx.fillRect(this.x+6, this.y-8, this.w-12, 8);

      // face
      ctx.fillStyle = '#3b2b1f';
      ctx.fillRect(this.x+10, this.y+6, 12, 12);

      // weapon
      ctx.strokeStyle = '#5a3726';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(this.x + this.w - 8, this.y + this.h/2 - 2);
      ctx.lineTo(this.x + this.w + 10, this.y + this.h/2 - 10);
      ctx.stroke();

      ctx.restore();
    }
    bounds(){ return {x:this.x, y:this.y, w:this.w, h:this.h}; }
  }

  // Powerup (rare): Speed boost or shield
  class PowerUp {
    constructor(x,y,kind='shield'){
      this.x = x; this.y = y; this.w = 26; this.h = 26; this.kind = kind; this.speed = 2.8;
      this.color = kind === 'shield' ? '#44aaff' : '#ffd24d';
    }
    update(dt){ this.x -= (gameSpeed * (dt/16) + this.speed*(dt/16)); }
    draw(ctx){
      ctx.save();
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x+13, this.y+13, 12, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.kind === 'shield' ? 'S' : 'B', this.x+13, this.y+13);
      ctx.restore();
    }
    bounds(){ return {x:this.x, y:this.y, w:this.w, h:this.h}; }
  }

  // Utility: AABB collision
  function rectsOverlap(a,b){
    return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
  }

  // Explosion particles for the ending
  const particles = [];
  function spawnExplosion(x,y,count=28){
    for (let i=0;i<count;i++){
      particles.push({
        x,y,
        vx: (Math.random()-0.5)*8,
        vy: (Math.random()-1.5)*6,
        life: 120 + Math.random()*80,
        size: 2 + Math.random()*4,
        col: ['#ffcf5c','#ff6f3c','#ff3c3c','#ffd3a3'][Math.floor(Math.random()*4)]
      });
    }
    beep(220,0.3);
  }

  // Rocket for the final cinematic sequence
  const rocket = {
    active:false,
    x: W + 40, y: -60,
    vx: -6, vy: 3,
    targetX: bg.base.x + bg.base.w/2,
    targetY: bg.base.y + 10,
    update(dt){
      if (!this.active) return;
      // homing-ish: move toward target with velocity + gravity
      const ax = (this.targetX - this.x) * 0.002;
      const ay = (this.targetY - this.y) * 0.003;
      this.vx += ax * (dt/16);
      this.vy += ay * (dt/16);
      this.x += this.vx * (dt/16);
      this.y += this.vy * (dt/16);
      // small trail particles
      particles.push({x:this.x+6,y:this.y+10,vx:(Math.random()-0.5)*1,vy:Math.random()*1+0.5,life:30+Math.random()*30,size:2,col:'#ff8d3c'});
      // detect crash
      if (this.x < this.targetX + 6 && this.y > this.targetY - 10) {
        this.active = false;
        spawnExplosion(this.targetX, this.targetY, 120);
        rocketSequenceStarted = false;
        showEnding();
      }
    },
    draw(ctx){
      if (!this.active) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.atan2(this.vy, this.vx));
      // rocket body
      ctx.fillStyle = '#ddd';
      ctx.fillRect(-10,-6,24,12);
      // nose
      ctx.beginPath();
      ctx.moveTo(14,0);
      ctx.lineTo(22,6);
      ctx.lineTo(22,-6);
      ctx.closePath();
      ctx.fillStyle = '#c33';
      ctx.fill();
      // flame
      ctx.fillStyle = '#ff7a00';
      ctx.beginPath();
      ctx.ellipse(-14, 0, 6, 4, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    },
    launch(){
      this.active = true;
      this.x = W + 80; this.y = -90;
      this.vx = -8; this.vy = 3;
      beep(140, 0.5);
    }
  };

  // Draw background each frame
  function drawBackground(ctx, t) {
    // sky gradient
    const grd = ctx.createLinearGradient(0,0,0,H);
    grd.addColorStop(0, '#4a4a4a');
    grd.addColorStop(0.6, '#343536');
    grd.addColorStop(1, '#151516');
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,W,H);

    // clouds
    for (let c of bg.clouds) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#bfbfbf';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      c.x -= c.speed * 0.3;
      if (c.x < -120) c.x = W + 120;
    }

    // distant banners & smoke (war feel)
    for (let i=0;i<bg.banners.length;i++){
      const b = bg.banners[i];
      ctx.save();
      ctx.fillStyle = '#7a2c2c';
      ctx.fillRect(b.x, b.y, 34, 20 + Math.sin(t*0.002 + i)*6);
      ctx.restore();

      b.x -= b.speed * 0.2;
      if (b.x < -40) b.x = W + 40;
    }

    // hills
    for (let h of bg.hills) {
      ctx.save();
      ctx.fillStyle = h.color;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y+10);
      ctx.quadraticCurveTo(h.x+150, h.y-40, h.x+300, h.y+10);
      ctx.lineTo(h.x+300, H);
      ctx.lineTo(h.x, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      h.x -= h.speed * 0.2;
      if (h.x < -360) h.x += 900;
    }

    // base (castle-like structure) to the right — target of rocket
    ctx.save();
    ctx.translate(bg.base.x, bg.base.y);
    // base body
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(0, 0, bg.base.w, bg.base.h);
    // battlements
    ctx.fillStyle = '#151515';
    for (let i=0;i<6;i++){
      ctx.fillRect(i*34, -12, 20, 12);
    }
    // flag
    ctx.fillStyle = '#b22222';
    ctx.beginPath();
    ctx.moveTo(bg.base.w - 18, -18);
    ctx.lineTo(bg.base.w + 6, -24);
    ctx.lineTo(bg.base.w - 18, -10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // foreground ground strip
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, H-20, W, 20);
  }

  // Game loop
  function loop(ts) {
    if (!running) return;
    if (!lastTime) lastTime = ts;
    dt = ts - lastTime;
    lastTime = ts;
    if (paused) {
      requestAnimationFrame(loop);
      return;
    }

    // update
    update(dt);
    // clear and draw
    ctx.clearRect(0,0,W,H);
    drawBackground(ctx, ts);
    // draw base behind player
    // obstacles
    for (let ob of obstacles) ob.draw(ctx);
    for (let p of powerups) p.draw(ctx);
    player.draw(ctx);
    rocket.draw(ctx);

    // draw particles
    for (let i = particles.length-1; i>=0; i--){
      const p = particles[i];
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i,1);
    }

    // HUD drawn on canvas for effects (score)
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Inter, Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${Math.floor(score)}`, 16, 26);
    ctx.restore();

    requestAnimationFrame(loop);
  }

  function update(dt) {
    // scale difficulty slightly with score
    const difficulty = 1 + Math.min(2.2, score / 800);
    gameSpeed = 4 * difficulty;

    // player update
    player.update(dt);

    // spawn obstacles
    spawnTimer += dt;
    if (spawnTimer > spawnInterval / difficulty) {
      spawnTimer = 0;
      const y = H - 70;
      const ob = new Obstacle(W + 40, y - 12, gameSpeed + 1 + Math.random()*1.6);
      obstacles.push(ob);
      // occasionally spawn a powerup
      if (Math.random() < 0.09) {
        powerups.push(new PowerUp(W+120, H-70 - 22, Math.random() < 0.5 ? 'shield' : 'boost'));
      }
      // decrease interval slowly
      spawnInterval = Math.max(550, 1500 - score/2);
    }

    // update obstacles/powerups and check collisions
    for (let i = obstacles.length-1; i >=0; i--) {
      const ob = obstacles[i];
      ob.update(dt);
      if (ob.x + ob.w < -40) obstacles.splice(i,1);
      else {
        const pbox = player.bounds();
        const obox = ob.bounds();
        if (rectsOverlap(pbox, obox)) {
          // collision => if we have shield powerup you'd handle it
          if (player.shieldActive) {
            // consume shield
            player.shieldActive = false;
            obstacles.splice(i,1);
            spawnExplosion(ob.x + ob.w/2, ob.y + ob.h/2, 18);
            beep(600, 0.08);
            continue;
          }
          // game over unless rocket cinematic triggered (if final crash should still be game over)
          running = false;
          endGame(false);
          return;
        }
        // scoring when obstacle passed
        if (!ob.passed && ob.x + ob.w < player.x) {
          ob.passed = true;
          score += 25;
          distance += 25;
          if (score > highScore) {
            highScore = Math.floor(score);
            localStorage.setItem('hr_high', highScore);
            highLabel.textContent = `High: ${highScore}`;
          }
        }
      }
    }

    for (let i = powerups.length-1; i>=0; i--) {
      const p = powerups[i];
      p.update(dt);
      if (p.x + p.w < -20) powerups.splice(i,1);
      else {
        if (rectsOverlap(player.bounds(), p.bounds())) {
          // collect
          if (p.kind === 'shield') {
            player.shieldActive = true;
            beep(1200, 0.08);
          } else {
            // boost increases speed temporarily (we invert: increases score rate & distance)
            score += 40;
            beep(1000, 0.07);
          }
          powerups.splice(i,1);
        }
      }
    }

    // rocket cinematic trigger: if score passes threshold or distance target and rocket not triggered
    if (Math.floor(score) >= 1000 && !rocketSequenceStarted) {
      rocketSequenceStarted = true;
      // begin rocket launch after short delay to create drama
      setTimeout(() => rocket.launch(), 1300);
    }

    rocket.update(dt);

    // progress scoring while running
    score += 0.02 * gameSpeed * (dt/16);
  }

  function startGame(){
    // reset
    obstacles = [];
    powerups = [];
    particles.length = 0;
    score = 0;
    distance = 0;
    spawnTimer = 0;
    spawnInterval = 1500;
    running = true;
    paused = false;
    rocket.active = false;
    rocketSequenceStarted = false;
    player.y = H - 70;
    player.vy = 0;
    player.shieldActive = false;
    lastTime = 0;
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    overlayContent.style.display = 'none';
    requestAnimationFrame(loop);
  }

  function endGame(won){
    // show overlay (Game Over or Victory)
    const text = won ? 'Victory!' : 'Defeat';
    const sub = won ? 'You launched the rocket — the base is gone!' : 'You were stopped by the barbarians...';
    overlayContent.innerHTML = `<h2>${text}</h2><p>${sub}</p>
      <p class="small">Final Score: ${Math.floor(score)} • High Score: ${highScore}</p>
      <div style="margin-top:12px">
        <button id="restartNow">Play Again</button>
      </div>
      <p class="footer-note">Tip: reach 1000+ score to trigger the rocket ending.</p>`;
    overlayContent.style.display = 'block';
    overlayContent.style.pointerEvents = 'auto';
    document.getElementById('restartNow').addEventListener('click', () => {
      overlayContent.style.display = 'none';
      startGame();
    });
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
  }

  function showEnding(){
    // show cinematic victory overlay and stop obstacles
    running = false;
    endGame(true);
    // additionally we can animate small victory text on canvas for a moment
  }

  // Hook up UI buttons
  startBtn.addEventListener('click', () => {
    startGame();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  });
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  });
  muteBtn.addEventListener('click', () => {
    mute = !mute;
    muteBtn.textContent = mute ? '🔇' : '🔊';
  });

  // initial overlay (instructions)
  overlayContent.innerHTML = `<h2>Hog Rider Runner</h2>
    <p>Run through the war-strewn plain as the Hog Rider. Jump over barbarians, collect power-ups, and survive. Reach <strong>1000</strong> points to trigger the final rocket ending!</p>
    <p class="small">Controls: Space / Up / W = Jump. Down / S = Duck. Tap the canvas to jump on mobile.</p>
    <div style="margin-top:8px"><button id="beginBtn">Begin</button></div>`;
  overlayContent.style.display = 'block';
  overlayContent.querySelector('#beginBtn').addEventListener('click', () => {
    overlayContent.style.display = 'none';
    startGame();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  });

  // auto-update score label DOM element for convenience (not required)
  setInterval(()=>{
    scoreLabel.textContent = `Score: ${Math.floor(score)}`;
  }, 120);

  // Start with a short intro animation loop showing background and player idle
  (function introLoop(t) {
    if (running) return;
    // clear
    ctx.clearRect(0,0,W,H);
    drawBackground(ctx, t);
    // draw player in idle bob
    const bob = Math.sin(t*0.005) * 4;
    ctx.save();
    ctx.translate(0, bob);
    player.draw(ctx);
    ctx.restore();
    // draw base
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '14px Inter, Arial';
    ctx.textAlign = 'right';
    ctx.fillText('Reach 1000 to trigger the rocket!', W-10, 26);
    ctx.restore();

    requestAnimationFrame(introLoop);
  })(0);

})();
