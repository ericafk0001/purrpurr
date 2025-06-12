const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const config = require("./config.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// serve static files
app.use(express.static(path.join(__dirname)));

// use shared config
config.trees.count = Math.floor(
  config.worldWidth * config.worldHeight * config.trees.density
);

const players = {};
const trees = [];
const stones = [];

function generateTrees() {
  const cellSize = config.trees.minDistance;
  const gridWidth = Math.floor(config.worldWidth / cellSize);
  const gridHeight = Math.floor(config.worldHeight / cellSize);

  // create grid with proper size checks
  const grid = Array(gridWidth + 1)
    .fill()
    .map(() => Array(gridHeight + 1).fill(0));

  function isValidPosition(x, y) {
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);

    // ensure we're within grid bounds
    if (cellX >= gridWidth || cellY >= gridHeight || cellX < 0 || cellY < 0) {
      return false;
    }

    let nearbyCount = 0;

    // check surrounding cells with boundary validation
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = cellX + dx;
        const ny = cellY + dy;
        if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
          nearbyCount += grid[nx][ny];
        }
      }
    }

    return nearbyCount < config.trees.maxTreesPerCell;
  }

  for (let i = 0; i < config.trees.count; i++) {
    let attempts = 0;
    let placed = false;

    while (!placed && attempts < 10) {
      const x = Math.random() * config.worldWidth;
      const y = Math.random() * config.worldHeight;

      if (isValidPosition(x, y)) {
        trees.push({
          x,
          y,
          radius: config.trees.radius,
          rotation: Math.random() * Math.PI * 2, // random rotation in radians
        });
        const cellX = Math.floor(x / cellSize);
        const cellY = Math.floor(y / cellSize);
        grid[cellX][cellY]++;
        placed = true;
      }

      attempts++;
    }
  }
}

function generateStones() {
  const cellSize = config.stones.minDistance;
  const gridWidth = Math.floor(config.worldWidth / cellSize) + 1;
  const gridHeight = Math.floor(config.worldHeight / cellSize) + 1;
  const grid = Array(gridWidth)
    .fill()
    .map(() => Array(gridHeight).fill(0));

  config.stones.count = Math.floor(
    config.worldWidth * config.worldHeight * config.stones.density
  );

  function isValidPosition(x, y, cellX, cellY, grid, maxStonePerCell) {
    // ensure we're within grid bounds
    if (
      cellX >= grid.length ||
      cellY >= grid[0].length ||
      cellX < 0 ||
      cellY < 0
    ) {
      return false;
    }

    let nearbyCount = 0;

    // check surrounding cells with boundary validation
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = cellX + dx;
        const ny = cellY + dy;
        if (nx >= 0 && nx < grid.length && ny >= 0 && ny < grid[0].length) {
          nearbyCount += grid[nx][ny];
        }
      }
    }

    return nearbyCount < maxStonePerCell;
  }

  for (let i = 0; i < config.stones.count; i++) {
    let attempts = 0;
    let placed = false;

    while (!placed && attempts < 10) {
      const x = Math.random() * config.worldWidth;
      const y = Math.random() * config.worldHeight;
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);

      if (
        isValidPosition(x, y, cellX, cellY, grid, config.stones.maxStonePerCell)
      ) {
        stones.push({
          x,
          y,
          radius: config.stones.radius,
          rotation: Math.random() * Math.PI * 2,
        });
        grid[cellX][cellY]++;
        placed = true;
      }
      attempts++;
    }
  }
}

function checkCollision(circle1, circle2) {
  const dx = circle1.x - circle2.x;
  const dy = circle1.y - circle2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < circle1.radius + circle2.radius;
}

function findSafeSpawnPoint() {
  const margin = 200;
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    // generate random position
    const x = margin + Math.random() * (config.worldWidth - 2 * margin);
    const y = margin + Math.random() * (config.worldHeight - 2 * margin);

    // check if position is safe
    if (isPositionSafe(x, y)) {
      return { x, y };
    }
    attempts++;
  }

  // fallback to center if no safe position found
  return { x: config.worldWidth / 2, y: config.worldHeight / 2 };
}

function isPositionSafe(x, y) {
  const playerCircle = {
    x: x,
    y: y,
    radius: config.collision.sizes.player,
  };

  // add buffer to collision sizes for spawn safety
  const safetyBuffer = 20;

  // check collisions with trees
  for (const tree of trees) {
    if (
      checkCollision(playerCircle, {
        x: tree.x,
        y: tree.y,
        radius: config.collision.sizes.tree + safetyBuffer,
      })
    ) {
      return false;
    }
  }

  // check collisions with stones
  for (const stone of stones) {
    if (
      checkCollision(playerCircle, {
        x: stone.x,
        y: stone.y,
        radius: config.collision.sizes.stone + safetyBuffer,
      })
    ) {
      return false;
    }
  }

  return true;
}

generateTrees();
generateStones();

io.on("connection", (socket) => {
  console.log("A player connected:", socket.id);
  const spawnPoint = findSafeSpawnPoint();
  players[socket.id] = { x: spawnPoint.x, y: spawnPoint.y, rotation: 0 };

  // send both players and trees data to new player
  socket.emit("initGame", { players, trees, stones });

  socket.broadcast.emit("newPlayer", { id: socket.id, x: 100, y: 100 });

  socket.on("playerMovement", (movement) => {
    const player = players[socket.id];
    if (player) {
      // validate movement isn't too extreme
      const maxSpeed = config.moveSpeed * 1.5;
      const dx = movement.x - player.x;
      const dy = movement.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= maxSpeed) {
        player.x = movement.x;
        player.y = movement.y;
        player.rotation = movement.rotation;

        socket.broadcast.emit("playerMoved", {
          id: socket.id,
          x: player.x,
          y: player.y,
          rotation: player.rotation,
        });
      }
    }
  });

  socket.on("chatMessage", (data) => {
    if (data.message && data.message.length > 0) {
      // broadcast message to all players
      io.emit("playerMessage", {
        playerId: socket.id,
        message: data.message,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Listening on port 3000");
});
