// remove local config definition and use the global gameconfig
const config = gameConfig;
config.collision.debug = config.collision.debugEnabled; // initialize debug state

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const socket = io(
  location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://purrpurr-server.onrender.com"
);

let players = {};
let myPlayer = null;
let trees = [];
let stones = [];
const keys = { w: false, a: false, s: false, d: false };

const camera = {
  x: 0,
  y: 0,
};

const assets = {};

// enable image smoothing
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";

function loadAssets() {
  Object.keys(config.assets).forEach((key) => {
    const img = new Image();
    img.src = config.assets[key];
    assets[key] = img;
  });
}

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

// modify socket handlers to receive initial game state
socket.on("initGame", (gameState) => {
  players = gameState.players;
  trees = gameState.trees || [];
  stones = gameState.stones || [];
  myPlayer = players[socket.id];
});

// set initial canvas size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// camera functions
function updateCamera() {
  if (!myPlayer) return;

  // center camera on player
  camera.x = myPlayer.x - canvas.width / 2;
  camera.y = myPlayer.y - canvas.height / 2;
}

// add after camera object
const mouse = {
  x: 0,
  y: 0,
};

// add this function after updatecamera
function updateRotation() {
  if (!myPlayer) return;
  const screenMouseX = mouse.x;
  const screenMouseY = mouse.y;
  const worldMouseX = screenMouseX + camera.x;
  const worldMouseY = screenMouseY + camera.y;

  const dx = worldMouseX - myPlayer.x;
  const dy = worldMouseY - myPlayer.y;
  myPlayer.rotation = Math.atan2(dy, dx) - Math.PI / 2; // Changed from + to -

  socket.emit("playerMovement", {
    x: myPlayer.x,
    y: myPlayer.y,
    rotation: myPlayer.rotation,
  });
}

// drawing functions
function drawPlayers() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // combine all objects that need Y-sorting - fix player ID mapping
  const allObjects = [
    ...Object.entries(players).map(([id, player]) => ({
      ...player,
      id: id,
      type: "player",
    })),
    ...trees
      .filter((tree) => isInViewport(tree))
      .map((tree) => ({ ...tree, type: "tree" })),
    ...stones
      .filter((stone) => isInViewport(stone))
      .map((stone) => ({ ...stone, type: "stone" })),
  ];

  // sort by Y position
  allObjects.sort((a, b) => a.y - b.y);

  // draw everything in order
  allObjects.forEach((obj) => {
    switch (obj.type) {
      case "player":
        drawPlayer(obj);
        break;
      case "tree":
        drawTree(obj);
        break;
      case "stone":
        drawStone(obj);
        break;
    }
  });

  drawWorldBorder();
  if (config.collision.debug) {
    drawCollisionCircles();
  }

  drawChatInput();
}

function drawPlayer(player) {
  if (assets.player) {
    ctx.save();
    ctx.translate(player.x - camera.x, player.y - camera.y);
    ctx.rotate(player.rotation || 0);
    ctx.drawImage(
      assets.player,
      -config.playerRadius,
      -config.playerRadius,
      config.playerRadius * 2,
      config.playerRadius * 2
    );
    ctx.restore();

    // draw chat bubble if player has a message
    drawChatBubble(player);
  }
}

function drawTree(tree) {
  if (assets.tree) {
    ctx.save();
    ctx.translate(tree.x - camera.x, tree.y - camera.y);
    ctx.rotate(tree.rotation || 0);
    ctx.drawImage(
      assets.tree,
      -config.trees.radius,
      -config.trees.radius,
      config.trees.radius * 2,
      config.trees.radius * 2
    );
    ctx.restore();
  }
}

function drawStone(stone) {
  if (assets.stone) {
    ctx.save();
    ctx.translate(stone.x - camera.x, stone.y - camera.y);
    ctx.rotate(stone.rotation || 0);
    ctx.drawImage(
      assets.stone,
      -config.stones.radius,
      -config.stones.radius,
      config.stones.radius * 2,
      config.stones.radius * 2
    );
    ctx.restore();
  }
}

function drawWorldBorder() {
  ctx.strokeStyle = config.colors.worldBorder;
  ctx.lineWidth = 4;
  ctx.strokeRect(-camera.x, -camera.y, config.worldWidth, config.worldHeight);
}

function isInViewport(object) {
  return (
    object.x + object.radius > camera.x &&
    object.x - object.radius < camera.x + canvas.width &&
    object.y + object.radius > camera.y &&
    object.y - object.radius < camera.y + canvas.height
  );
}

// add after isinviewport function
function checkCollision(circle1, circle2) {
  const dx = circle1.x - circle2.x;
  const dy = circle1.y - circle2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < circle1.radius + circle2.radius;
}

// add these helper functions near the top
function normalize(vector) {
  const mag = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  return mag === 0 ? vector : { x: vector.x / mag, y: vector.y / mag };
}

function dot(v1, v2) {
  return v1.x * v2.x + v1.y * v2.y;
}

// replace handlecollisions function
function handleCollisions(dx, dy) {
  if (!myPlayer) return { dx, dy };

  const newX = myPlayer.x + dx;
  const newY = myPlayer.y + dy;

  const playerCircle = {
    x: newX,
    y: newY,
    radius: config.collision.sizes.player,
  };

  const staticObstacles = [
    ...trees.map((tree) => ({
      x: tree.x,
      y: tree.y,
      radius: config.collision.sizes.tree,
    })),
    ...stones.map((stone) => ({
      x: stone.x,
      y: stone.y,
      radius: config.collision.sizes.stone,
    })),
  ];

  let finalDx = dx;
  let finalDy = dy;

  for (const obstacle of staticObstacles) {
    const collisionNormal = {
      x: playerCircle.x - obstacle.x,
      y: playerCircle.y - obstacle.y,
    };
    const distance = Math.sqrt(
      collisionNormal.x * collisionNormal.x +
        collisionNormal.y * collisionNormal.y
    );

    if (distance < playerCircle.radius + obstacle.radius) {
      const normal = normalize(collisionNormal);
      const movement = { x: dx, y: dy };
      const dotProduct = dot(movement, normal);

      finalDx = dx - normal.x * dotProduct;
      finalDy = dy - normal.y * dotProduct;
    }
  }

  return { dx: finalDx, dy: finalDy };
}

function resolvePlayerCollisions() {
  if (!myPlayer) return;

  for (const id in players) {
    if (id === socket.id) continue;

    const otherPlayer = players[id];
    const dx = myPlayer.x - otherPlayer.x;
    const dy = myPlayer.y - otherPlayer.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDist = config.collision.sizes.player * 2;

    if (distance < minDist && distance > 0) {
      // calculate collision force
      const overlap = minDist - distance;
      const force = overlap * 0.5; // adjust force strength

      // normalize direction and apply force
      const pushX = (dx / distance) * force;
      const pushY = (dy / distance) * force;

      // apply force to my player
      myPlayer.x += pushX * 0.6;
      myPlayer.y += pushY * 0.6;

      // apply counter force to other player (local prediction)
      otherPlayer.x -= pushX * 0.4; // They get pushed less
      otherPlayer.y -= pushY * 0.4;

      // keep within bounds
      myPlayer.x = Math.max(
        config.collision.sizes.player,
        Math.min(config.worldWidth - config.collision.sizes.player, myPlayer.x)
      );
      myPlayer.y = Math.max(
        config.collision.sizes.player,
        Math.min(config.worldHeight - config.collision.sizes.player, myPlayer.y)
      );
    }
  }
}

// update updatePosition function
function updatePosition() {
  if (!myPlayer) return;

  let dx = 0;
  let dy = 0;

  if (keys.w && myPlayer.y > 0) dy -= 1;
  if (keys.s && myPlayer.y < config.worldHeight) dy += 1;
  if (keys.a && myPlayer.x > 0) dx -= 1;
  if (keys.d && myPlayer.x < config.worldWidth) dx += 1;

  // normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    const normalizer = 1 / Math.sqrt(2);
    dx *= normalizer;
    dy *= normalizer;
  }

  dx *= config.moveSpeed;
  dy *= config.moveSpeed;

  const { dx: slidingDx, dy: slidingDy } = handleCollisions(dx, dy);

  const newX = myPlayer.x + slidingDx;
  const newY = myPlayer.y + slidingDy;

  if (newX > 0 && newX < config.worldWidth) myPlayer.x = newX;
  if (newY > 0 && newY < config.worldHeight) myPlayer.y = newY;

  resolvePlayerCollisions();
  resolveCollisionPenetration();

  socket.emit("playerMovement", {
    x: myPlayer.x,
    y: myPlayer.y,
    rotation: myPlayer.rotation,
  });
}

function resolveCollisionPenetration() {
  if (!myPlayer) return;

  const playerCircle = {
    x: myPlayer.x,
    y: myPlayer.y,
    radius: config.collision.sizes.player,
  };

  // only check static obstacles for penetration resolution
  const staticObstacles = [
    ...trees.map((tree) => ({
      x: tree.x,
      y: tree.y,
      radius: config.collision.sizes.tree,
    })),
    ...stones.map((stone) => ({
      x: stone.x,
      y: stone.y,
      radius: config.collision.sizes.stone,
    })),
  ];

  for (const obstacle of staticObstacles) {
    const dx = playerCircle.x - obstacle.x;
    const dy = playerCircle.y - obstacle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDist = playerCircle.radius + obstacle.radius;

    if (distance < minDist && distance > 0) {
      // calculate penetration depth
      const penetrationDepth = minDist - distance;
      // push player out
      const pushX = (dx / distance) * penetrationDepth;
      const pushY = (dy / distance) * penetrationDepth;

      myPlayer.x += pushX;
      myPlayer.y += pushY;

      // ensure we stay within world bounds
      myPlayer.x = Math.max(
        config.collision.sizes.player,
        Math.min(config.worldWidth - config.collision.sizes.player, myPlayer.x)
      );
      myPlayer.y = Math.max(
        config.collision.sizes.player,
        Math.min(config.worldHeight - config.collision.sizes.player, myPlayer.y)
      );
    }
  }
}

function drawCollisionCircles() {
  ctx.strokeStyle = config.collision.debugColor;
  ctx.lineWidth = 2;

  // player collision circles
  Object.values(players).forEach((player) => {
    ctx.beginPath();
    ctx.arc(
      player.x - camera.x,
      player.y - camera.y,
      config.collision.sizes.player,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  });

  // tree collision circles
  trees.forEach((tree) => {
    if (isInViewport(tree)) {
      ctx.beginPath();
      ctx.arc(
        tree.x - camera.x,
        tree.y - camera.y,
        config.collision.sizes.tree,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  });

  // stone collision circles
  stones.forEach((stone) => {
    if (isInViewport(stone)) {
      ctx.beginPath();
      ctx.arc(
        stone.x - camera.x,
        stone.y - camera.y,
        config.collision.sizes.stone,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  });
}

let chatMode = false;
let chatInput = "";
let playerMessages = {}; // store messages for each player

// chat message handling
socket.on("playerMessage", (messageData) => {
  playerMessages[messageData.playerId] = {
    text: messageData.message,
    timestamp: Date.now(),
  };
});

function drawChatBubble(player) {
  const message = playerMessages[player.id];
  if (!message) return;

  // check if message is still valid (not expired)
  if (Date.now() - message.timestamp > config.chat.bubbleDisplayTime) {
    delete playerMessages[player.id];
    return;
  }

  const bubbleX = player.x - camera.x;
  const bubbleY = player.y - camera.y - config.playerRadius - 30;
  const bubbleWidth = Math.max(60, message.text.length * 8);
  const bubbleHeight = 25;

  // draw bubble background
  ctx.fillStyle = config.chat.bubbleColor;
  ctx.fillRect(bubbleX - bubbleWidth / 2, bubbleY, bubbleWidth, bubbleHeight);

  // draw text
  ctx.fillStyle = config.chat.textColor;
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(message.text, bubbleX, bubbleY + 16);
}

function drawChatInput() {
  if (!chatMode) return;

  // draw chat input box at bottom of screen
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(10, canvas.height - 40, canvas.width - 20, 30);

  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Chat: " + chatInput + "|", 15, canvas.height - 20);
}

// event listeners
window.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (!chatMode) {
      // enter chat mode
      chatMode = true;
      chatInput = "";
    } else {
      // send message and exit chat mode
      if (chatInput.trim().length > 0) {
        const message = chatInput
          .trim()
          .substring(0, config.chat.maxMessageLength);

        // show own message immediately
        playerMessages[socket.id] = {
          text: message,
          timestamp: Date.now(),
        };

        socket.emit("chatMessage", {
          message: message,
        });
      }
      chatMode = false;
      chatInput = "";
    }
    return;
  }

  if (chatMode) {
    if (e.key === "Backspace") {
      chatInput = chatInput.slice(0, -1);
    } else if (e.key.length === 1) {
      chatInput += e.key;
    }
    return; // don't process movement keys while chatting
  }

  // existing movement key handling
  if (keys.hasOwnProperty(e.key.toLowerCase())) {
    keys[e.key.toLowerCase()] = true;
  }

  // add debug toggle
  if (e.key === "p") {
    config.collision.debug = !config.collision.debug;
  }
});

window.addEventListener("keyup", (e) => {
  if (keys.hasOwnProperty(e.key.toLowerCase())) {
    keys[e.key.toLowerCase()] = false;
  }
});

window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

function gameLoop() {
  updatePosition();
  updateRotation();
  updateCamera();
  drawPlayers();
  requestAnimationFrame(gameLoop);
}

loadAssets();

gameLoop();
