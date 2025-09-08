const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 300;

let gameRunning = false;
let gameOver = false;
let score = 0;
let highScore = 0;
let gravity = 0.6;
let gameSpeed = 5;
let obstacles = [];
let rocketEvent = false;

// Player (Hog Rider placeholder)
const player = {
  x: 50, y: 200, w: 40, h: 40,
  dy: 0, jumping: false, ducking: false
};

// Key controls
document.addEventListener("keydown", (e) => {
  if ((e.code === "Space" || e.code === "ArrowUp") && !player.jumping) jump();
  if (e.code === "ArrowDown") player.ducking = true;
});
document.addEventListener("keyup", (e) => {
  if (e.code === "ArrowDown") player.ducking = false;
});

// Mobile tap jump
canvas.addEventListener("touchstart", jump);

function jump() {
  if (!player.jumping) {
    player.dy = -12;
    player.jumping = true;
  }
}

// Enemy spawn
class Obstacle {
  constructor() {
    this.x = canvas.width;
    this.y = 230;
    this.w = 30;
    this.h = 40;
  }
  update() {
    this.x -= gameSpeed;
    this.draw();
  }
  draw() {
    ctx.fillStyle = "orange"; // Barbarian placeholder
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}

// Game loop
function update() {
  if (!gameRunning || gameOver) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw player
  ctx.fillStyle = "brown"; // Hog Rider placeholder
  ctx.fillRect(player.x, player.y, player.w, player.h);

  // Physics
  player.y += player.dy;
  if (player.jumping) player.dy += gravity;
  if (player.y >= 200) {
    player.y = 200;
    player.dy = 0;
    player.jumping = false;
  }

  // Obstacles
  if (Math.random() < 0.02) obstacles.push(new Obstacle());
  obstacles.forEach((obs, i) => {
    obs.update();
    if (obs.x + obs.w < 0) obstacles.splice(i, 1);

    // Collision
    if (
      player.x < obs.x + obs.w &&
      player.x + player.w > obs.x &&
      player.y < obs.y + obs.h &&
      player.y + player.h > obs.y
    ) {
      endGame();
    }
  });

  // Score
  score++;
  document.getElementById("score").innerText = `Score: ${score} • High: ${highScore}`;

  // Trigger rocket event at 2000 points
  if (score > 2000 && !rocketEvent) {
    rocketEvent = true;
    triggerRocketCrash();
  }

  requestAnimationFrame(update);
}

// End game
function endGame() {
  gameOver = true;
  gameRunning = false;
  if (score > highScore) highScore = score;
  document.getElementById("score").innerText = `Score: ${score} • High: ${highScore}`;
  document.getElementById("ending").style.display = "block";
}

// Rocket ending cutscene
function triggerRocketCrash() {
  ctx.fillStyle = "red";
  ctx.fillRect(canvas.width / 2 - 20, 0, 40, 80); // simple rocket

  setTimeout(() => {
    endGame();
  }, 2000);
}

// Start button
document.getElementById("startBtn").addEventListener("click", () => {
  gameRunning = true;
  gameOver = false;
  score = 0;
  obstacles = [];
  rocketEvent = false;
  document.getElementById("ending").style.display = "none";
  update();
});
