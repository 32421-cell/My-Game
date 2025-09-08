// --- Canvas setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const overlayStart = document.getElementById('overlayStart');

let isRunning = false;
let score = 0;
let highScore = 0;

// --- Player ---
const player = {
  x: 50,
  y: canvas.height - 60,
  width: 40,
  height: 40,
  color: '#ffcc00',
  dy: 0,
  gravity: 0.7,
  jumpPower: -12,
  grounded: true
};

// --- Enemy ---
const enemies = [];
const enemySpawnRate = 90; // frames
let frameCount = 0;

// --- Event Listeners ---
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.key.toLowerCase() === 'w') {
    jump();
  }
});

canvas.addEventListener('click', jump);

function jump() {
  if (player.grounded) {
    player.dy = player.jumpPower;
    player.grounded = false;
  }
}

// --- Start / Pause ---
startBtn.onclick = startGame;
overlayStart.onclick = () => {
  document.getElementById('overlay').style.display = 'none';
  startGame();
};

pauseBtn.onclick = () => {
  isRunning = !isRunning;
  pauseBtn.innerText = isRunning ? 'Pause' : 'Resume';
  if (isRunning) requestAnimationFrame(gameLoop);
};

// --- Game Loop ---
function startGame() {
  isRunning = true;
  score = 0;
  enemies.length = 0;
  startBtn.style.display = 'none';
  pauseBtn.style.display = 'inline';
  requestAnimationFrame(gameLoop);
}

function gameLoop() {
  if (!isRunning) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // --- Update Player ---
  player.dy += player.gravity;
  player.y += player.dy;

  // Floor collision
  if (player.y + player.height >= canvas.height - 10) {
    player.y = canvas.height - 10 - player.height;
    player.dy = 0;
    player.grounded = true;
  }

  // Draw player
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // --- Spawn enemies ---
  frameCount++;
  if (frameCount % enemySpawnRate === 0) {
    enemies.push({
      x: canvas.width,
      y: canvas.height - 40,
      width: 30,
      height: 30,
      color: '#ff4444',
      speed: 5
    });
  }

  // --- Update enemies ---
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.x -= e.speed;
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x, e.y, e.width, e.height);

    // Collision with player
    if (
      player.x < e.x + e.width &&
      player.x + player.width > e.x &&
      player.y < e.y + e.height &&
      player.y + player.height > e.y
    ) {
      gameOver();
      return;
    }

    // Remove offscreen enemies
    if (e.x + e.width < 0) enemies.splice(i, 1);
  }

  // --- Update Score ---
  score++;
  if (score > highScore) highScore = score;
  document.getElementById('scoreText').innerText = `Score: ${score} • High: ${highScore}`;

  requestAnimationFrame(gameLoop);
}

function gameOver() {
  isRunning = false;
  startBtn.style.display = 'inline';
  pauseBtn.style.display = 'none';
  alert(`Game Over! Your score: ${score}`);
}
