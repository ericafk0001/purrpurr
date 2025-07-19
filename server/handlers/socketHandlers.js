import { validateWallPlacement, validateSpikeePlacement, checkPlacementRateLimit } from "../utils/validation.js";
import { recordPlayerPosition, validateAttackWithLagCompensation, cleanupPlayerHistory } from "../utils/lagCompensation.js";

/**
 * Registers socket.io event handlers to manage multiplayer game state, player actions, and world object interactions.
 *
 * Sets up listeners for player connection, movement, chat, healing, inventory management, attacking, item usage, wall and spike placement, teleportation, and disconnection. Synchronizes game state across all clients, enforces game rules such as cooldowns and world boundaries, and manages player interactions with world objects including spikes and walls.
 */

export function setupSocketHandlers(
  io,
  players,
  trees,
  stones,
  walls,
  spikes,
  gameConfig,
  gameItems,
  gameFunctions
) {
  // Import the necessary functions from gameFunctions
  const {
    broadcastInventoryUpdate,
    healPlayer,
    processAttack,
    isValidWallPlacement,
    isValidSpikePosition,
    findValidSpawnPosition,
  } = gameFunctions;

  io.on("connection", (socket) => {
    const spawnPos = findValidSpawnPosition();

    // Initialize player with health, inventory, velocity and ping tracking
    players[socket.id] = {
      x: spawnPos.x,
      y: spawnPos.y,
      rotation: 0,
      health: gameConfig.player.health.max,
      lastDamageTime: null,
      lastAttackTime: null,
      inventory: {
        slots: Array(gameConfig.player.inventory.initialSlots).fill(null),
        activeSlot: 0,
      },
      attacking: false,
      velocity: { x: 0, y: 0 }, // Add velocity
      ping: 0, // Track player ping
      lastPingTime: Date.now()
    };

    // Give starting items
    const startingItems = [
      { ...gameItems.hammer, slot: 0 },
      { ...gameItems.apple, slot: 1 },
      { ...gameItems.wall, slot: 2 }, // Add wall to starting inventory
      { ...gameItems.spike, slot: 3 }, // Add spikes to starting inventory
    ];

    startingItems.forEach((item) => {
      players[socket.id].inventory.slots[item.slot] = item;
    });

    // Set initial active item
    players[socket.id].inventory.selectedItem =
      players[socket.id].inventory.slots[0];

    // Send both players and trees data to new player
    socket.emit("initGame", {
      players: Object.entries(players).reduce((acc, [id, player]) => {
        acc[id] = {
          ...player,
          health: player.health,
          maxHealth: gameConfig.player.health.max,
        };
        return acc;
      }, {}),
      trees,
      stones,
      walls,
      spikes, // Add spikes to initial game state
    });

    // Notify other players about new player with health info
    socket.broadcast.emit("newPlayer", {
      id: socket.id,
      x: spawnPos.x,
      y: spawnPos.y,
      health: gameConfig.player.health.max,
      maxHealth: gameConfig.player.health.max,
      inventory: players[socket.id].inventory,
    });

    // Ping measurement
    const pingInterval = setInterval(() => {
      const pingStart = Date.now();
      socket.emit("ping", pingStart);
    }, 2000); // Ping every 2 seconds

    socket.on("pong", (pingStart) => {
      const player = players[socket.id];
      if (player) {
        player.ping = Date.now() - pingStart;
        player.lastPingTime = Date.now();
      }
    });

    socket.on("playerMovement", (movement) => {
      const player = players[socket.id];
      if (player && !player.isDead) {
        // Store previous position for validation
        const previousX = player.x;
        const previousY = player.y;
        
        // Apply velocity decay with weapon-specific knockback configuration
        if (player.lastKnockbackTime) {
          const elapsed = Date.now() - player.lastKnockbackTime;
          if (elapsed < player.knockbackDuration) {
            player.velocity.x *= player.knockbackDecay;
            player.velocity.y *= player.knockbackDecay;
            
            if (Math.abs(player.velocity.x) < 0.1) player.velocity.x = 0;
            if (Math.abs(player.velocity.y) < 0.1) player.velocity.y = 0;
          } else {
            player.velocity.x = 0;
            player.velocity.y = 0;
            player.lastKnockbackTime = null;
          }
        }

        // Apply velocity to position with reasonable limits
        if (player.velocity) {
          const maxVelocity = 10;
          player.velocity.x = Math.max(-maxVelocity, Math.min(maxVelocity, player.velocity.x));
          player.velocity.y = Math.max(-maxVelocity, Math.min(maxVelocity, player.velocity.y));
          
          player.x += player.velocity.x;
          player.y += player.velocity.y;

          // Apply world bounds after velocity movement
          player.x = Math.max(0, Math.min(gameConfig.worldWidth, player.x));
          player.y = Math.max(0, Math.min(gameConfig.worldHeight, player.y));
        }

        // Calculate movement distance for validation
        const dx = movement.x - previousX;
        const dy = movement.y - previousY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Validate movement distance (anti-cheat)
        const maxMovementDistance = gameConfig.moveSpeed * 0.1; // Reasonable movement per frame
        
        if (distance <= maxMovementDistance || !movement.sequence) {
          // Accept the movement
          player.x = movement.x;
          player.y = movement.y;
          player.rotation = movement.rotation;

          // Validate position is within world bounds
          player.x = Math.max(0, Math.min(gameConfig.worldWidth, player.x));
          player.y = Math.max(0, Math.min(gameConfig.worldHeight, player.y));

          // Record position for lag compensation
          recordPlayerPosition(socket.id, player.x, player.y, player.rotation, movement.timestamp || Date.now());

          // Send confirmation back to client if this was a predicted movement
          if (movement.sequence !== undefined) {
            socket.emit("movementConfirmed", {
              playerId: socket.id,
              x: player.x,
              y: player.y,
              rotation: player.rotation,
              sequence: movement.sequence,
              timestamp: Date.now()
            });
          }
        } else {
          // Movement too large - reject and send correction
          socket.emit("positionCorrection", {
            x: player.x,
            y: player.y,
            rotation: player.rotation,
            sequence: movement.sequence
          });
          return; // Don't process spike damage or broadcast invalid position
        }

        // Apply movement restriction if active
        if (player.movementRestriction && player.movementRestriction.active) {
          const currentTime = Date.now();
          const elapsed = currentTime - player.movementRestriction.startTime;
          
          if (elapsed >= player.movementRestriction.duration) {
            player.movementRestriction.active = false;
          }
        }

        // Check for spike damage after position update
        const now = Date.now();
        spikes.forEach((spike) => {
          if (spike.playerId === socket.id) return;

          const dx = player.x - spike.x;
          const dy = player.y - spike.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const damageDistance =
            gameConfig.collision.sizes.player +
            gameConfig.collision.sizes.spike +
            gameConfig.spikes.damageRadius;

          if (distance < damageDistance) {
            if (!player.spikeDamageTimes) {
              player.spikeDamageTimes = {};
            }
            
            if (
              !player.spikeDamageTimes[spike.id] ||
              now - player.spikeDamageTimes[spike.id] >=
                gameConfig.spikes.damageInterval
            ) {
              player.spikeDamageTimes[spike.id] = now;

              gameFunctions.damagePlayer(
                socket.id,
                gameItems.spike.damage,
                spike
              );

              io.emit("playerHit", {
                attackerId: "spike",
                targetId: socket.id,
                damage: gameItems.spike.damage,
                x: spike.x,
                y: spike.y,
              });
            }
          }
        });

        // Broadcast position update with health info and velocity
        socket.broadcast.emit("playerMoved", {
          id: socket.id,
          x: player.x,
          y: player.y,
          rotation: player.rotation,
          inventory: player.inventory,
          attacking: player.attacking,
          attackProgress: player.attackProgress,
          attackStartTime: player.attackStartTime,
          health: player.health,
          maxHealth: gameConfig.player.health.max,
          velocity: player.velocity,
        });
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


    // Handle inventory selection syncing
    socket.on("inventorySelect", (data) => {
      const player = players[socket.id];
      if (player && typeof data.slot === "number") {
        // Deselect currently selected item if any
        player.inventory.slots.forEach((item) => {
          if (item) item.selected = false;
        });

        // Select new item if slot has one
        const selectedItem = player.inventory.slots[data.slot];
        if (selectedItem) {
          selectedItem.selected = true;
          player.inventory.selectedItem = selectedItem;
        } else {
          player.inventory.selectedItem = null;
        }

        player.inventory.activeSlot = data.slot;

        // Broadcast inventory update to all clients
        broadcastInventoryUpdate(socket.id);
      }
    });

    // Handle inventory expansion
    socket.on("inventoryExpand", () => {
      if (
        players[socket.id] &&
        players[socket.id].inventory.slots.length <
          gameConfig.player.inventory.maxSlots
      ) {
        players[socket.id].inventory.slots.push(null);
        io.emit("playerInventoryExpand", {
          id: socket.id,
          newSize: players[socket.id].inventory.slots.length,
        });
      }
    });

    // Update attack handler
    socket.on("attackStart", (attackData = {}) => {
      const player = players[socket.id];
      if (!player || player.isDead) return;

      const now = Date.now();
      const attackTime = attackData.timestamp || now;

      if (
        player.lastAttackTime &&
        now - player.lastAttackTime < gameItems.hammer.cooldown
      ) {
        return;
      }

      player.attacking = true;
      player.attackStartTime = now;
      player.lastAttackTime = now;
      player.attackProgress = 0;

      // Get weapon info for consistent timing
      const activeItem = player.inventory.slots[player.inventory.activeSlot];
      const weaponUseTime = activeItem ? gameItems[activeItem.id]?.useTime || 250 : 250;

      // Broadcast attack start with timing info, rotation, and weapon info
      io.emit("playerAttackStart", {
        id: socket.id,
        startTime: now,
        rotation: player.rotation,
        weaponId: activeItem?.id || "hammer",
        useTime: weaponUseTime,
      });

      // Process attack with lag compensation for players
      processAttackWithLagCompensation(socket.id, attackTime, players, walls, spikes, gameConfig, gameItems, io, gameFunctions);

      // End attack state after animation using correct weapon timing
      setTimeout(() => {
        if (player.attacking) {
          player.attacking = false;
          io.emit("playerAttackEnd", { id: socket.id });
        }
      }, weaponUseTime);
    });

    socket.on("disconnect", () => {
      clearInterval(pingInterval);
      cleanupPlayerHistory(socket.id);
      console.log("Player disconnected:", socket.id);
      delete players[socket.id];
      io.emit("playerDisconnected", socket.id);
    });

    // Add new socket handler for item use
    socket.on("useItem", (data) => {
      const player = players[socket.id];
      if (!player || player.isDead) return;

      const item = player.inventory.slots[data.slot];
      if (!item) return;

      // Handle consumable items
      if (item.type === "consumable") {
        switch (item.id) {
          case "apple": {
            const didHeal = healPlayer(socket.id, item.healAmount);

            // Send appropriate response based on whether healing occurred
            io.emit("itemUsed", {
              id: socket.id,
              slot: data.slot,
              itemId: item.id,
              success: didHeal,
            });
            break;
          }
        }
      }
    });

    // Update the placeWall handler with validation
    socket.on("placeWall", (position) => {
      const player = players[socket.id];
      if (!player || player.isDead) return;

      // Rate limiting check
      const rateLimitResult = checkPlacementRateLimit(socket.id, 'wall');
      if (!rateLimitResult.success) {
        socket.emit("placementError", { error: rateLimitResult.error });
        return;
      }

      // Comprehensive server-side validation
      const validation = validateWallPlacement(
        player, 
        position, 
        walls, 
        spikes, 
        trees, 
        stones, 
        gameConfig, 
        gameItems
      );

      if (!validation.success) {
        socket.emit("placementError", { error: validation.error });
        return;
      }

      // Find wall in inventory (double-check after validation)
      const wallSlot = player.inventory.slots.findIndex(
        (item) => item?.id === "wall"
      );
      if (wallSlot === -1) {
        socket.emit("placementError", { error: "No wall found in inventory" });
        return;
      }

      // Create wall with validated position
      const wall = {
        x: Math.round(position.x), // Round to prevent floating point exploits
        y: Math.round(position.y),
        radius: gameConfig.collision.sizes.wall,
        rotation: position.rotation || 0,
        playerId: socket.id,
        health: gameItems.wall.maxHealth,
        timestamp: Date.now(), // Add timestamp for tracking
      };

      walls.push(wall);

      // Broadcast wall placement with health
      io.emit("wallPlaced", wall);

      // Switch back to hammer
      player.inventory.activeSlot = 0;
      player.inventory.selectedItem = player.inventory.slots[0];

      // Broadcast inventory update
      broadcastInventoryUpdate(socket.id);
    });

    // Update spike placement handler with validation
    socket.on("placeSpike", (position) => {
      const player = players[socket.id];
      if (!player || player.isDead) return;

      // Rate limiting check
      const rateLimitResult = checkPlacementRateLimit(socket.id, 'spike');
      if (!rateLimitResult.success) {
        socket.emit("placementError", { error: rateLimitResult.error });
        return;
      }

      // Comprehensive server-side validation
      const validation = validateSpikeePlacement(
        player, 
        position, 
        spikes, 
        walls, 
        trees, 
        stones, 
        gameConfig, 
        gameItems
      );

      if (!validation.success) {
        socket.emit("placementError", { error: validation.error });
        return;
      }

      // Find spike in inventory (double-check after validation)
      const spikeSlot = player.inventory.slots.findIndex(
        (item) => item?.id === "spike"
      );
      if (spikeSlot === -1) {
        socket.emit("placementError", { error: "No spike found in inventory" });
        return;
      }

      // Create spike with validated position
      const spike = {
        id: `spike-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "spike",
        x: Math.round(position.x), // Round to prevent floating point exploits
        y: Math.round(position.y),
        radius: gameConfig.collision.sizes.spike,
        rotation: position.rotation || 0,
        playerId: socket.id,
        health: gameItems.spike.maxHealth,
        damage: gameItems.spike.damage,
        lastDamageTime: 0,
        timestamp: Date.now(), // Add timestamp for tracking
      };

      spikes.push(spike);

      // Broadcast spike placement with health
      io.emit("spikePlaced", spike);

      // Switch back to hammer
      player.inventory.activeSlot = 0;
      player.inventory.selectedItem = player.inventory.slots[0];

      // Broadcast inventory update
      broadcastInventoryUpdate(socket.id);
    });

    // Add after other socket handlers in io.on("connection")
    socket.on("teleportRequest", () => {
      const player = players[socket.id];
      if (!player || player.isDead) return;

      let nearestPlayer = null;
      let shortestDistance = Infinity;
      const minSafeDistance = gameConfig.collision.sizes.player * 2.5; // Minimum safe distance

      Object.entries(players).forEach(([id, target]) => {
        if (id !== socket.id && !target.isDead) {
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestPlayer = target;
          }
        }
      });

      if (nearestPlayer) {
        // Calculate safe position slightly offset from target player
        const angle = Math.random() * Math.PI * 2; // Random angle
        const teleportX = nearestPlayer.x + Math.cos(angle) * minSafeDistance;
        const teleportY = nearestPlayer.y + Math.sin(angle) * minSafeDistance;

        // Update player position
        player.x = teleportX;
        player.y = teleportY;

        // Notify all clients about teleport
        io.emit("playerTeleported", {
          playerId: socket.id,
          x: player.x,
          y: player.y,
        });
      }
    });

    socket.on("attackAnimationUpdate", (data) => {
      if (players[socket.id]) {
        players[socket.id].attacking = data.attacking;
        players[socket.id].attackProgress = data.progress;
        players[socket.id].attackStartTime = data.startTime;
        players[socket.id].rotation = data.rotation;

        // Broadcast animation update to other players
        socket.broadcast.emit("attackAnimationUpdate", {
          id: socket.id,
          ...data,
        });
      }
    });
  });
}

/**
 * Process attack with lag compensation for players and immediate damage for static objects
 */
function processAttackWithLagCompensation(attackerId, attackTime, players, walls, spikes, gameConfig, gameItems, io, gameFunctions) {
  const attacker = players[attackerId];
  if (!attacker) return;

  const activeSlot = attacker.inventory.activeSlot;
  const weapon = attacker.inventory.slots[activeSlot];

  if (!weapon || weapon.id !== "hammer") return;

  // Process hits on other players with lag compensation
  Object.entries(players).forEach(([targetId, target]) => {
    if (targetId === attackerId || !target || target.isDead) return;

    // Validate attack with lag compensation
    const validation = validateAttackWithLagCompensation(
      attackerId,
      targetId,
      attackTime,
      attacker.ping || 0,
      players,
      weapon,
      gameConfig
    );

    if (validation.valid) {
      // Apply damage using the compensated hit
      gameFunctions.damagePlayer(targetId, weapon.damage || 15, attacker);
      
      io.emit("playerHit", {
        attackerId: attackerId,
        targetId: targetId,
        damage: weapon.damage || 15,
        lagCompensated: true,
        compensationMs: validation.compensationTime
      });

      // Optional: Send debug info about lag compensation
      if (process.env.NODE_ENV === 'development') {
        console.log(`Lag compensated hit: ${attackerId} -> ${targetId}, ping: ${attacker.ping}ms, compensation: ${validation.compensationTime}ms`);
      }
    }
  });

  // Process damage to walls and spikes immediately (no lag compensation needed for static objects)
  processStaticObjectDamage(attacker, weapon, walls, spikes, gameConfig, io);
}

/**
 * Process damage to static objects (walls, spikes) without lag compensation
 */
function processStaticObjectDamage(attacker, weapon, walls, spikes, gameConfig, io) {
  const attackRange = weapon.range || 120;
  const arcAngle = Math.PI / 1.5; // 120 degrees
  const playerAngle = attacker.rotation + Math.PI / 2;

  // Process damage to walls
  processDamageToEntity(
    walls,
    "wall",
    attacker,
    attackRange,
    arcAngle,
    playerAngle,
    weapon,
    gameConfig,
    io
  );

  // Process damage to spikes
  processDamageToEntity(
    spikes,
    "spike",
    attacker,
    attackRange,
    arcAngle,
    playerAngle,
    weapon,
    gameConfig,
    io
  );
}

/**
 * Shared damage processing logic for static entities like walls and spikes
 */
function processDamageToEntity(
  entities,
  entityType,
  attacker,
  attackRange,
  arcAngle,
  playerAngle,
  weapon,
  gameConfig,
  io
) {
  for (let index = entities.length - 1; index >= 0; index--) {
    const entity = entities[index];
    const dx = entity.x - attacker.x;
    const dy = entity.y - attacker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= attackRange + gameConfig.collision.sizes[entityType]) {
      const angleToEntity = Math.atan2(dy, dx);
      let angleDiff = angleToEntity - playerAngle;
      
      // Normalize angle difference
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      const absAngleDiff = Math.abs(angleDiff);

      if (absAngleDiff <= arcAngle / 2) {
        entity.health -= weapon.damage || 15;

        if (entity.health <= 0) {
          entities.splice(index, 1);
          io.emit(`${entityType}Destroyed`, { x: entity.x, y: entity.y });
        } else {
          io.emit(`${entityType}Damaged`, {
            x: entity.x,
            y: entity.y,
            health: entity.health,
          });
        }
      }
    }
  }
}
