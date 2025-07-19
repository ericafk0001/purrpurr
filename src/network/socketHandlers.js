// Import required variables and functions
import {
  config,
  players,
  myPlayer,
  walls,
  spikes,
  socket,
  setPlayers,
  setMyPlayer,
  setTrees,
  setStones,
  setWalls,
  setSpikes,
} from "../utils/constants.js";
import { clampWithEasing } from "../utils/helpers.js";
import { addFloatingNumber } from "../rendering/effects.js";
import { handleInventorySelection } from "../player/inventory.js";
import {
  setLastServerSync,
  setNeedsPositionReconciliation,
  setCorrectedPosition,
  getMovementHistory,
} from "../player/player.js";
import { wallShakes } from "../rendering/drawWorld.js";
import { playerMessages } from "../ui/chat.js";
import { showDeathScreen, hideDeathScreen } from "../ui/hud.js";
import { updateCamera } from "../core/camera.js";
import { setMovementRestriction } from "../physics/movement.js";
import { startAttackAnimation, resetAttackState } from "../player/attack.js";

/**
 * Sends player movement with sequence number for client-side prediction
 */
export function sendPlayerMovementWithPrediction(movement) {
  if (!myPlayer) return;

  socket.emit("playerMovement", {
    x: myPlayer.x,
    y: myPlayer.y,
    rotation: myPlayer.rotation,
    sequence: movement.sequence,
    timestamp: movement.timestamp
  });
}

/**
 * Emits the local player's position and rotation to the server for multiplayer synchronization.
 *
 * If the local player is undefined, no event is emitted.
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

  // Apply velocity if provided and not preserving existing velocity
  if (data.velocity && !data.preserveVelocity) {
    player.velocity = data.velocity;
  }

  // If this is our player, update local state and set up movement restriction
  if (data.playerId === socket.id && myPlayer) {
    myPlayer.health = player.health;
    
    // Only update velocity if not preserving it
    if (data.velocity && !data.preserveVelocity) {
      myPlayer.velocity = data.velocity;
    }
    
    // Set up movement restriction if knockback direction is provided and system is enabled
    if (data.knockbackDirection !== undefined && 
        config.player.knockback.movementRestriction.enabled) {
      setMovementRestriction(
        data.knockbackDirection, 
        config.player.knockback.movementRestriction.duration
      );
    }
  }
});

// Add interpolation constants
const INTERPOLATION_DELAY = 100; // 100ms behind real-time
const MAX_POSITION_HISTORY = 10; // Keep last 10 positions

// Update socket handler for player movement
socket.on("playerMoved", (playerInfo) => {
  if (players[playerInfo.id]) {
    const player = players[playerInfo.id];
    const timestamp = Date.now();

    // Initialize position history if it doesn't exist
    if (!player.positionHistory) {
      player.positionHistory = [];
    }

    // Enhanced position change detection with better thresholds
    const lastPos = player.positionHistory[player.positionHistory.length - 1];
    const isNewPosition = !lastPos || 
      Math.abs(lastPos.x - playerInfo.x) > 0.01 ||
      Math.abs(lastPos.y - playerInfo.y) > 0.01 ||
      Math.abs(lastPos.rotation - playerInfo.rotation) > 0.001 ||
      timestamp - lastPos.timestamp > 40; // Force update every 40ms for smoother interpolation

    if (isNewPosition) {
      // Calculate velocity for better extrapolation
      let velocityX = 0, velocityY = 0;
      if (lastPos && timestamp - lastPos.timestamp > 0) {
        const timeDelta = timestamp - lastPos.timestamp;
        velocityX = (playerInfo.x - lastPos.x) / timeDelta * 1000; // pixels per second
        velocityY = (playerInfo.y - lastPos.y) / timeDelta * 1000;
      }

      // Add high-precision position with velocity data
      player.positionHistory.push({
        x: playerInfo.x,
        y: playerInfo.y,
        rotation: playerInfo.rotation,
        timestamp: playerInfo.timestamp || timestamp,
        serverTime: playerInfo.timestamp,
        localTime: timestamp,
        velocity: { x: velocityX, y: velocityY },
        // Add movement smoothness indicators
        speed: Math.sqrt(velocityX * velocityX + velocityY * velocityY),
        deltaTime: lastPos ? timestamp - lastPos.timestamp : 0
      });

      // Keep optimal history length for interpolation quality
      if (player.positionHistory.length > 30) {
        player.positionHistory.shift();
      }
    }

    // Smooth position updates instead of snapping
    const oldX = player.x;
    const oldY = player.y;
    const newX = clampWithEasing(playerInfo.x, 0, config.worldWidth);
    const newY = clampWithEasing(playerInfo.y, 0, config.worldHeight);
    
    // Apply position with micro-smoothing for ultra-smooth appearance
    if (!player._smoothTransition) {
      player._smoothTransition = { 
        startX: oldX, startY: oldY, 
        targetX: newX, targetY: newY, 
        startTime: timestamp,
        duration: 50 // 50ms smooth transition
      };
    } else {
      // Update target if significantly different
      const distance = Math.sqrt(Math.pow(newX - player._smoothTransition.targetX, 2) + Math.pow(newY - player._smoothTransition.targetY, 2));
      if (distance > 1) {
        player._smoothTransition = { 
          startX: player.x, startY: player.y, 
          targetX: newX, targetY: newY, 
          startTime: timestamp,
          duration: 30
        };
      }
    }
    
    player.x = newX;
    player.y = newY;
    player.rotation = playerInfo.rotation;

    // Update other properties
    players[playerInfo.id] = {
      ...players[playerInfo.id],
      ...playerInfo,
      x: newX,
      y: newY,
      positionHistory: player.positionHistory,
      _predictedVelocity: player._predictedVelocity,
      _smoothTransition: player._smoothTransition
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
  setSpikes(gameState.spikes || []); // Add spikes to initial game state
  setMyPlayer(players[socket.id]);
  
  // Reset attack state for new player
  resetAttackState();
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
    
    // Store weapon info from server for consistent animation timing
    players[data.id].attackWeaponId = data.weaponId || "hammer";
    players[data.id].attackUseTime = data.useTime || 250;

    // Use the rotation from the server for consistent animation direction
    players[data.id].attackStartRotation =
      data.rotation !== undefined ? data.rotation : players[data.id].rotation;
  }
  
  // If this is our own player's attack, start the animation
  if (data.id === socket.id) {
    startAttackAnimation(data);
  }
});

socket.on("playerAttackEnd", (data) => {
  if (players[data.id]) {
    players[data.id].attacking = false;
    players[data.id].attackProgress = 0;
    players[data.id].attackStartTime = null;
    players[data.id].attackStartRotation = null;
    players[data.id].attackWeaponId = null;
    players[data.id].attackUseTime = null;
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
    setCorrectedPosition(correctPos);
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
  setLastServerSync(Date.now());
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

// Add spike socket handlers
socket.on("spikePlaced", (spikeData) => {
  spikes.push(spikeData);

  // Switch back to hammer only if this was our spike
  if (spikeData.playerId === socket.id) {
    handleInventorySelection(0);
  }
});

socket.on("spikeDamaged", (data) => {
  const spike = spikes.find((s) => s.x === data.x && s.y === data.y);
  if (spike) {
    spike.health = data.health;
    // Add shake animation data (reusing wallShakes for spikes too)
    wallShakes.set(`spike_${spike.x},${spike.y}`, {
      startTime: performance.now(),
      duration: 200, // Shake duration in ms
      magnitude: 3, // Shake intensity
    });
  }
});

socket.on("spikeDestroyed", (data) => {
  const spikeIndex = spikes.findIndex((s) => s.x === data.x && s.y === data.y);
  if (spikeIndex !== -1) {
    spikes.splice(spikeIndex, 1);
  }
});

// Add handler for server movement confirmation
socket.on("movementConfirmed", (data) => {
  if (data.playerId === socket.id && myPlayer) {
    // Check if our predicted position differs significantly from server
    const positionError = Math.sqrt(
      Math.pow(data.x - myPlayer.x, 2) + Math.pow(data.y - myPlayer.y, 2)
    );
    
    // If error is too large, trigger reconciliation
    const ERROR_THRESHOLD = 5; // pixels
    if (positionError > ERROR_THRESHOLD) {
      setNeedsPositionReconciliation(true);
      setCorrectedPosition({
        x: data.x,
        y: data.y,
        rotation: data.rotation,
        sequence: data.sequence
      });
    }
    
    // Clean up old movement history
    if (data.sequence !== undefined) {
      // Remove confirmed movements from history
      const movementHistory = getMovementHistory();
      const confirmedIndex = movementHistory.findIndex(m => m.sequence <= data.sequence);
      if (confirmedIndex >= 0) {
        movementHistory.splice(0, confirmedIndex + 1);
      }
    }
  }
});

// Add handler for placement errors
socket.on("placementError", (data) => {
  if (data.error) {
    // Show error message to player in console
    console.warn("Structure placement failed:", data.error);
    
    // Don't use floating numbers for text messages - they expect numeric values
    // Instead, you could implement a proper text notification system here
    // For now, just log the error without visual feedback
  }
});

// Add ping handling
socket.on("ping", (timestamp) => {
  socket.emit("pong", timestamp);
});
socket.on("ping", (timestamp) => {
  socket.emit("pong", timestamp);
});


