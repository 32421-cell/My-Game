// --- Basic setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let score = 0;
let highScore = 0;
let isRunning = false;

// Buttons
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const overlayStart = document.getElementById('overlayStart');

startBtn.onclick = startGame;
overlayStart.onclick = () => {
  document.getElementById('overlay').style.display = 'none';
  startGame();
};

// --- Game loop ---
function startGame() {
  isRunning = true;
  startBtn.style.display = 'none';
  pauseBtn.style.display = 'inline';
  requestAnimationFrame(gameLoop);
}

function gameLoop() {
  if (!isRunning) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw simple player box
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(50, canvas.height - 60, 40, 40);

  // Update score
  score++;
  if (score > highScore) highScore = score;
  document.getElementById('scoreText').innerText = `Score: ${score} • High: ${highScore}`;

  requestAnimationFrame(gameLoop);
}

// Pause button
pauseBtn.onclick = () => { isRunning = !isRunning; };
