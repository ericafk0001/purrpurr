import cors from "cors";
import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { gameConfig } from "./src/config/config.js";
import { gameItems } from "./src/config/items.js";
import { fileURLToPath } from "url";

// Import modular functions
import {
  broadcastInventoryUpdate,
  damagePlayer,
  healPlayer,
} from "./server/controllers/player.js";
import { generateTrees, generateStones } from "./server/controllers/world.js";
import {
  findValidSpawnPosition,
  isValidWallPlacement,
} from "./server/utils/collision.js";
import { processAttack } from "./server/controllers/combat.js";
import { setupSocketHandlers } from "./server/handlers/socketHandlers.js";
import { setupLiveReload } from "./server/utils/devUtils.js";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// serve static files
app.use(express.static(path.join(__dirname)));

// use shared config
gameConfig.trees.count = Math.floor(
  gameConfig.worldWidth * gameConfig.worldHeight * gameConfig.trees.density
);

// Game state
const players = {};
const trees = [];
const stones = [];
const walls = [];

// Setup development utilities
setupLiveReload(app, __dirname);

// Generate world
generateTrees(trees, gameConfig);
generateStones(stones, gameConfig);

// Create a functions object to pass to socket handlers
const gameFunctions = {
  broadcastInventoryUpdate: (playerId) =>
    broadcastInventoryUpdate(playerId, players, io),
  healPlayer: (playerId, amount) =>
    healPlayer(playerId, amount, players, io, gameConfig),
  damagePlayer: (playerId, amount, attacker) =>
    damagePlayer(
      playerId,
      amount,
      attacker,
      players,
      io,
      gameConfig,
      trees,
      stones
    ),
  processAttack: (attackerId) =>
    processAttack(
      attackerId,
      players,
      walls,
      gameConfig,
      io,
      (playerId, amount, attacker) =>
        damagePlayer(
          playerId,
          amount,
          attacker,
          players,
          io,
          gameConfig,
          trees,
          stones
        )
    ),
  isValidWallPlacement: (x, y) =>
    isValidWallPlacement(x, y, walls, trees, stones, gameConfig),
  findValidSpawnPosition: () => findValidSpawnPosition(gameConfig, walls),
};

// Setup socket handlers
setupSocketHandlers(
  io,
  players,
  trees,
  stones,
  walls,
  gameConfig,
  gameItems,
  gameFunctions
);

server.listen(3000, () => {
  console.log("Listening on port 3000");
});
