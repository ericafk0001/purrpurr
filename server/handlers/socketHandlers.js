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
    console.log("A player connected:", socket.id);

    // Initialize player with health, inventory and velocity
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
      walls, // Add this line
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

    socket.on("playerMovement", (movement) => {
      const player = players[socket.id];
      if (player && !player.isDead) {
        // Apply velocity decay with weapon-specific knockback configuration
        if (player.lastKnockbackTime) {
          const elapsed = Date.now() - player.lastKnockbackTime;
          if (elapsed < player.knockbackDuration) {
            player.velocity.x *= player.knockbackDecay;
            player.velocity.y *= player.knockbackDecay;
            
            // Stop very small velocities to prevent jitter
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
          const maxVelocity = 10; // Prevent excessive velocity
          player.velocity.x = Math.max(-maxVelocity, Math.min(maxVelocity, player.velocity.x));
          player.velocity.y = Math.max(-maxVelocity, Math.min(maxVelocity, player.velocity.y));
          
          player.x += player.velocity.x;
          player.y += player.velocity.y;
        }

        // Calculate movement with potential speed restrictions
        let maxSpeed = gameConfig.moveSpeed * 1.5;
        const dx = movement.x - player.x;
        const dy = movement.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Apply movement restriction if active
        if (player.movementRestriction && player.movementRestriction.active) {
          const currentTime = Date.now();
          const elapsed = currentTime - player.movementRestriction.startTime;
          
          // Check if restriction has expired
          if (elapsed >= player.movementRestriction.duration) {
            player.movementRestriction.active = false;
          } else if (distance > 0) {
            // Calculate the direction the player is trying to move
            const movementDirection = Math.atan2(dy, dx);
            const knockbackDir = player.movementRestriction.knockbackDirection;
            
            // Calculate angle difference (normalize to -π to π)
            let angleDiff = movementDirection - knockbackDir;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            const absAngleDiff = Math.abs(angleDiff);

            // Determine movement type and apply appropriate modifier
            if (absAngleDiff < Math.PI / 3) { // Within 60 degrees of knockback direction
              const multiplier = gameConfig.player.knockback.movementRestriction.directionPenalty;
              maxSpeed *= multiplier;
            } else if (absAngleDiff > Math.PI * 2/3) { // Within 60 degrees of opposite direction
              const multiplier = gameConfig.player.knockback.movementRestriction.oppositeMovementBonus;
              maxSpeed *= multiplier;
            } else { // Side movement
              const multiplier = gameConfig.player.knockback.movementRestriction.sideMovementPenalty;
              maxSpeed *= multiplier;
            }
          }
        }

        if (distance <= maxSpeed) {
          player.x = movement.x;
          player.y = movement.y;
          player.rotation = movement.rotation;

          // Validate position is within world bounds
          player.x = Math.max(0, Math.min(gameConfig.worldWidth, player.x));
          player.y = Math.max(0, Math.min(gameConfig.worldHeight, player.y));

          // Check for spike damage after position update
          const now = Date.now();
          spikes.forEach((spike) => {
            // Skip damage if player is the spike owner
            if (spike.playerId === socket.id) return;

            const dx = player.x - spike.x;
            const dy = player.y - spike.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            // Add extra damage radius beyond collision circle
            const damageDistance =
              gameConfig.collision.sizes.player +
              gameConfig.collision.sizes.spike +
              gameConfig.spikes.damageRadius;

            // Check if player is within damage area of the spike
            if (distance < damageDistance) {
              // Only damage if enough time has passed since last spike damage for this player
              // Initialize spike damage tracking if needed
              if (!player.spikeDamageTimes) {
                player.spikeDamageTimes = {};
              }
              
              if (
                !player.spikeDamageTimes[spike.id] ||
                now - player.spikeDamageTimes[spike.id] >=
                  gameConfig.spikes.damageInterval
              ) {
                player.spikeDamageTimes[spike.id] = now;

                // Damage the player
                gameFunctions.damagePlayer(
                  socket.id,
                  gameItems.spike.damage,
                  spike // Pass the spike object as attacker for proper knockback
                );

                // Emit playerHit event to trigger floating damage numbers
                io.emit("playerHit", {
                  attackerId: "spike", // Indicate spike as attacker
                  targetId: socket.id,
                  damage: gameItems.spike.damage,
                  x: spike.x, // Include spike position for effect positioning
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
        } else {
          // Position appears invalid - force sync correct position to client
          socket.emit("positionCorrection", {
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
    socket.on("attackStart", () => {
      const player = players[socket.id];
      if (!player || player.isDead) return;

      const now = Date.now();
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

      // Broadcast attack start with timing info and rotation
      io.emit("playerAttackStart", {
        id: socket.id,
        startTime: now,
        rotation: player.rotation, // Include rotation for consistent animation direction
      });

      // Process attack immediately instead of waiting
      processAttack(socket.id, players, walls, spikes, gameConfig);

      // End attack state after animation
      setTimeout(() => {
        if (player.attacking) {
          player.attacking = false;
          io.emit("playerAttackEnd", { id: socket.id });
        }
      }, gameItems.hammer.useTime);
    });

    socket.on("disconnect", () => {
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

    // Update the placeWall handler
    socket.on("placeWall", (position) => {
      const player = players[socket.id];
      if (!player || player.isDead) return;

      // Validate position is within world bounds
      if (
        position.x < 0 ||
        position.x > gameConfig.worldWidth ||
        position.y < 0 ||
        position.y > gameConfig.worldHeight
      )
        return;

      // Check if position is valid
      if (!isValidWallPlacement(position.x, position.y)) return;

      // Find wall in inventory
      const wallSlot = player.inventory.slots.findIndex(
        (item) => item?.id === "wall"
      );
      if (wallSlot === -1) return;

      // Add wall to world with health
      const wall = {
        x: position.x,
        y: position.y,
        radius: gameConfig.collision.sizes.wall,
        rotation: position.rotation || 0,
        playerId: socket.id,
        health: gameItems.wall.maxHealth, // Add initial health
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

    // Add spike placement handler
    socket.on("placeSpike", (position) => {
      const player = players[socket.id];
      if (!player || player.isDead) return;

      // Validate position is within world bounds
      if (
        position.x < 0 ||
        position.x > gameConfig.worldWidth ||
        position.y < 0 ||
        position.y > gameConfig.worldHeight
      )
        return;

      // Check if position is valid
      if (!isValidSpikePosition(position.x, position.y)) return;

      // Find spike in inventory
      const spikeSlot = player.inventory.slots.findIndex(
        (item) => item?.id === "spike"
      );
      if (spikeSlot === -1) return;

      // Add spike to world with health
      const spike = {
        id: `spike-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "spike",
        x: position.x,
        y: position.y,
        radius: gameConfig.collision.sizes.spike,
        rotation: position.rotation || 0,
        playerId: socket.id,
        health: gameItems.spike.maxHealth, // Add initial health
        damage: gameItems.spike.damage, // Add damage property
        lastDamageTime: 0, // Track when spike last damaged a player
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
