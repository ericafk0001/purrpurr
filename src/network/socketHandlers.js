// Import required variables and functions
import {
  config,
  players,
  myPlayer,
  walls,
  socket,
  setPlayers,
  setMyPlayer,
  setTrees,
  setStones,
  setWalls,
} from "../utils/constants.js";
import { clampWithEasing } from "../utils/helpers.js";
import { addFloatingNumber } from "../rendering/effects.js";
import { handleInventorySelection } from "../player/inventory.js";
import { lastServerSync, setNeedsPositionReconciliation, setCorrectedPosition } from "../player/player.js";
import { wallShakes } from "../rendering/drawWorld.js";
import { playerMessages } from "../ui/chat.js";
import { showDeathScreen, hideDeathScreen } from "../ui/hud.js";
import { updateCamera } from "../core/camera.js";

/**
 * Sends the local player's current position and rotation to the server.
 * 
 * Emits a "playerMovement" event with the player's coordinates and rotation for synchronization in the multiplayer game.
 */
export function sendPlayerMovement() {
  if (!myPlayer) return;

  socket.emit("playerMovement", {
    x: myPlayer.x,
    y: myPlayer.y,
    rotation: myPlayer.rotation,
  });
}

// Network event handlers
socket.on("newPlayer", (playerInfo) => {
  players[playerInfo.id] = {
    ...playerInfo,
    inventory: playerInfo.inventory || {
      slots: Array(config.player.inventory.initialSlots).fill(null),
      activeSlot: 0,
    },
  };
});

// Add improved socket handlers for synchronization
socket.on("playerHealthUpdate", (data) => {
  const player = players[data.playerId];
  if (!player) return;

  const oldHealth = player.health || 0;
  const healthDiff = data.health - oldHealth;

  // Update player health with validation
  player.health = Math.max(0, Math.min(data.health, data.maxHealth));
  player.lastHealthUpdate = data.timestamp;

  // Only show healing numbers (when health increases)
  if (healthDiff > 0) {
    addFloatingNumber(player.x, player.y - 40, healthDiff, "heal");
  }

  // Apply velocity if provided
  if (data.velocity) {
    player.velocity = data.velocity;
  }

  // If this is our player, update local state
  if (data.playerId === socket.id && myPlayer) {
    myPlayer.health = player.health;
    if (myPlayer.velocity) {
      myPlayer.velocity = data.velocity;
    }
  }
});

// Update socket handler for player movement
socket.on("playerMoved", (playerInfo) => {
  if (players[playerInfo.id]) {
    // Preserve and update animation state
    const player = players[playerInfo.id];

    // Store current position as previous position for interpolation
    const previousPosition = {
      x: player.x,
      y: player.y,
    };

    // Ensure received position is within bounds
    const clampedX = clampWithEasing(playerInfo.x, 0, config.worldWidth);
    const clampedY = clampWithEasing(playerInfo.y, 0, config.worldHeight);

    players[playerInfo.id] = {
      ...playerInfo,
      x: clampedX,
      y: clampedY,
      inventory: playerInfo.inventory || player.inventory,
      attacking: player.attacking, // Preserve local attack state
      attackProgress: player.attackProgress,
      attackStartTime: player.attackStartTime,
      velocity: player.velocity || { x: 0, y: 0 }, // Preserve velocity
      attackStartRotation: player.attackStartRotation, // Preserve attack rotation
      previousPosition: previousPosition, // Add previous position for interpolation
    };
  }
});

socket.on("playerDisconnected", (playerId) => {
  delete players[playerId];
});

// modify socket handlers to receive initial game state
socket.on("initGame", (gameState) => {
  setPlayers(gameState.players);
  setTrees(gameState.trees || []);
  setStones(gameState.stones || []);
  setWalls(gameState.walls || []); // Add this line
  setMyPlayer(players[socket.id]);
});

// Add new socket handler for wall placement
socket.on("wallPlaced", (wallData) => {
  walls.push(wallData);

  // Switch back to hammer only if this was our wall
  if (wallData.playerId === socket.id) {
    handleInventorySelection(0);
  }
});

socket.on("wallDamaged", (data) => {
  const wall = walls.find((w) => w.x === data.x && w.y === data.y);
  if (wall) {
    wall.health = data.health;
    // Add shake animation data
    wallShakes.set(`${wall.x},${wall.y}`, {
      startTime: performance.now(),
      duration: 200, // Shake duration in ms
      magnitude: 3, // Shake intensity
    });
  }
});

socket.on("wallDestroyed", (data) => {
  const wallIndex = walls.findIndex((w) => w.x === data.x && w.y === data.y);
  if (wallIndex !== -1) {
    walls.splice(wallIndex, 1);
  }
});

// Add near other socket handlers
socket.on("playerTeleported", (data) => {
  if (players[data.playerId]) {
    players[data.playerId].x = data.x;
    players[data.playerId].y = data.y;

    // If this was our player, update camera immediately
    if (data.playerId === socket.id && myPlayer) {
      myPlayer.x = data.x;
      myPlayer.y = data.y;
      updateCamera(1 / 60); // Use default timestep for teleport updates
    }
  }
});
// chat message handling
socket.on("playerMessage", (messageData) => {
  playerMessages[messageData.playerId] = {
    text: messageData.message,
    timestamp: Date.now(),
  };
});

// Add item use event handler after other socket handlers
socket.on("itemUsed", (data) => {
  if (data.id === socket.id && data.itemId === "apple" && data.success) {
    // Only switch back to hammer if healing was successful
    handleInventorySelection(0);
  }
});
// Add socket listeners for attack events
socket.on("playerAttackStart", (data) => {
  if (players[data.id]) {
    // Always use server timestamp for consistency
    const startTime = data.startTime || Date.now();
    players[data.id].attacking = true;
    players[data.id].attackStartTime = startTime;
    players[data.id].attackProgress = 0;

    // Use the rotation from the server for consistent animation direction
    players[data.id].attackStartRotation =
      data.rotation !== undefined ? data.rotation : players[data.id].rotation;
  }
});

socket.on("playerAttackEnd", (data) => {
  if (players[data.id]) {
    players[data.id].attacking = false;
    players[data.id].attackProgress = 0;
    players[data.id].attackStartTime = null;
    players[data.id].attackStartRotation = null;
  }
});

// Add handler for death events
socket.on("playerDied", (data) => {
  if (players[data.playerId]) {
    players[data.playerId].health = 0;
    players[data.playerId].isDead = true;

    // If local player died, show death screen
    if (data.playerId === socket.id && myPlayer) {
      myPlayer.health = 0;
      myPlayer.isDead = true;
      showDeathScreen();
    }
  }
});

// Add handler for respawn events
socket.on("playerRespawned", (data) => {
  if (players[data.playerId]) {
    players[data.playerId].x = data.x;
    players[data.playerId].y = data.y;
    players[data.playerId].health = data.health;
    players[data.playerId].isDead = false;

    // If local player respawned, update local state
    if (data.playerId === socket.id) {
      myPlayer.x = data.x;
      myPlayer.y = data.y;
      myPlayer.health = data.health;
      myPlayer.isDead = false;
      hideDeathScreen();
    }
  }
});

// Add handler for position correction from server
socket.on("positionCorrection", (correctPos) => {
  if (myPlayer) {
    // Set flag to reconcile position on next frame
    setNeedsPositionReconciliation(true);
    setCorrectedPosition(correctPos)
  }
});

// Add handler for full state sync
socket.on("fullStateSync", (data) => {
  // Update all player data, preserving local animations
  Object.entries(data.players).forEach(([id, serverPlayer]) => {
    if (players[id]) {
      // Keep local animation state
      const attackState = players[id].attacking;
      const attackProgress = players[id].attackProgress;
      const attackStartTime = players[id].attackStartTime;
      const attackStartRotation = players[id].attackStartRotation;

      // Update with server data
      players[id] = {
        ...serverPlayer,
        // Preserve animation state
        attacking: attackState,
        attackProgress: attackProgress,
        attackStartTime: attackStartTime,
        attackStartRotation: attackStartRotation,
      };
    } else {
      // New player
      players[id] = serverPlayer;
    }
  });

  // Update our reference to myPlayer
  setMyPlayer(players[socket.id]);
  lastServerSync = Date.now();
});

// Update socket handler for damage
socket.on("playerHit", (data) => {
  if (players[data.targetId]) {
    // Create floating damage number
    addFloatingNumber(
      players[data.targetId].x,
      players[data.targetId].y - 40,
      data.damage
    );
  }
});
