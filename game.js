// Game configuration
const config = {
  playerRadius: 25, // player radius
  moveSpeed: 4,
  colors: {
    player: "red",
    tree: "green",
  },
  trees: {
    count: 10,
    radius: 20,
  },
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const socket = io();

let players = {};
let myPlayer = null;
// Remove local tree generation
let trees = [];
const keys = { w: false, a: false, s: false, d: false };

// Socket event handlers
socket.on("currentPlayers", (serverPlayers) => {
  players = serverPlayers;
  myPlayer = players[socket.id];
});

socket.on("newPlayer", (player) => {
  players[player.id] = player;
});

socket.on("playerMoved", (playerInfo) => {
  players[playerInfo.id] = playerInfo;
});

socket.on("playerDisconnected", (playerId) => {
  delete players[playerId];
});

// Modify socket handlers to receive initial game state
socket.on("initGame", (gameState) => {
  console.log("Received game state:", gameState); // Debug log
  players = gameState.players;
  trees = gameState.trees || []; // Ensure trees is initialized
  myPlayer = players[socket.id];
});

// Drawing functions
function drawPlayers() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTrees(); // Draw trees first (behind players)
  Object.values(players).forEach((player) => {
    ctx.beginPath();
    ctx.arc(player.x, player.y, config.playerRadius, 0, Math.PI * 2);
    ctx.fillStyle = config.colors.player;
    ctx.fill();
    ctx.closePath();
  });
}

function drawTrees() {
  if (!trees || trees.length === 0) return; // Guard clause
  trees.forEach((tree) => {
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, config.trees.radius, 0, Math.PI * 2);
    ctx.fillStyle = config.colors.tree;
    ctx.fill();
    ctx.closePath();
  });
}

// Movement functions
function updatePosition() {
  if (!myPlayer) return;

  let dx = 0;
  let dy = 0;

  if (keys.w) dy -= 1;
  if (keys.s) dy += 1;
  if (keys.a) dx -= 1;
  if (keys.d) dx += 1;

  // Normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    const normalizer = 1 / Math.sqrt(2);
    dx *= normalizer;
    dy *= normalizer;
  }

  // Apply movement speed
  dx *= config.moveSpeed;
  dy *= config.moveSpeed;

  // Update position with bounds checking
  const newX = myPlayer.x + dx;
  const newY = myPlayer.y + dy;

  if (newX > 0 && newX < canvas.width) myPlayer.x = newX;
  if (newY > 0 && newY < canvas.height) myPlayer.y = newY;

  socket.emit("playerMovement", { x: myPlayer.x, y: myPlayer.y });
}

// Event listeners
window.addEventListener("keydown", (e) => {
  if (keys.hasOwnProperty(e.key.toLowerCase())) {
    keys[e.key.toLowerCase()] = true;
  }
});

window.addEventListener("keyup", (e) => {
  if (keys.hasOwnProperty(e.key.toLowerCase())) {
    keys[e.key.toLowerCase()] = false;
  }
});

// Game loop
function gameLoop() {
  updatePosition();
  drawPlayers();
  requestAnimationFrame(gameLoop);
}

// Initialize trees
// Removed generateTrees() function and its call

gameLoop();
