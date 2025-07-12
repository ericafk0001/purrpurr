// Player management, health, and inventory functions
import { findSafeSpawnPoint } from "../utils/collision.js";
import { gameItems } from "../../src/config/items.js";

/**
 * Broadcasts the specified player's current health and related state to all connected clients.
 *
 * Emits a "playerHealthUpdate" event containing the player's health, maximum health, timestamp, and velocity. No action is taken if the player does not exist.
 */
export function broadcastHealthUpdate(playerId, players, io, gameConfig) {
  const player = players[playerId];
  if (!player) return;

  io.emit("playerHealthUpdate", {
    playerId,
    health: player.health,
    maxHealth: gameConfig.player.health.max,
    timestamp: Date.now(),
    velocity: player.velocity,
    // Don't send knockback direction during healing - preserve existing restrictions
  });
}

/**
 * Broadcasts the specified player's inventory to all connected clients.
 *
 * Emits a "playerInventoryUpdate" event containing the player's ID and current inventory.
 * Does nothing if the player does not exist.
 */
export function broadcastInventoryUpdate(playerId, players, io) {
  const player = players[playerId];
  if (!player) return;

  io.emit("playerInventoryUpdate", {
    id: playerId,
    inventory: player.inventory,
  });
}

/**
 * Damages a player by reducing their health and applies knockback if attacked, broadcasting the updated health to all clients.
 *
 * If the attacker is a spike, uses spike-specific knockback settings; otherwise, uses the attacker's active weapon or default knockback. Triggers the death and respawn process if the player's health drops to zero from a positive value.
 *
 * @param {string} playerId - The ID of the player receiving damage.
 * @param {number} amount - The amount of damage to apply.
 * @param {object|null} attacker - The attacking player object or null if not applicable.
 * @return {boolean} True if damage was applied; false if the player does not exist.
 */
export function damagePlayer(
  playerId,
  amount,
  attacker,
  players,
  io,
  gameConfig,
  trees,
  stones
) {
  const player = players[playerId];
  if (!player) return false;

  // Determine knockback settings based on attacker type
  let weaponKnockback;

  if (attacker && attacker.type === "spike") {
    // If attacker is a spike, use spike knockback settings from items
    weaponKnockback = gameItems.spike.knockback;
  } else {
    // For other attackers, get their active weapon
    const attackerWeapon =
      attacker?.inventory?.slots[attacker.inventory.activeSlot];
    weaponKnockback = attackerWeapon?.knockback || gameConfig.player.knockback;
  }

  const oldHealth = player.health;
  player.health = Math.max(0, player.health - amount);
  player.lastDamageTime = Date.now();

  let knockbackDirection = 0;

  // Apply knockback if attacker position is available
  if (attacker) {
    const dx = player.x - attacker.x;
    const dy = player.y - attacker.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      // Calculate knockback direction for movement restriction
      knockbackDirection = Math.atan2(dy, dx);

      // Clear any existing knockback first
      player.velocity.x = 0;
      player.velocity.y = 0;

      // Apply knockback with original force (remove the scaling that broke it)
      const knockbackForce = weaponKnockback.force;
      const normalizedDx = dx / dist;
      const normalizedDy = dy / dist;
      
      // Apply one-time knockback impulse
      player.velocity.x = normalizedDx * knockbackForce;
      player.velocity.y = normalizedDy * knockbackForce;

      // Set up velocity decay using weapon-specific values
      player.lastKnockbackTime = Date.now();
      player.knockbackDecay = weaponKnockback.decay;
      player.knockbackDuration = weaponKnockback.duration;

      // Set up movement restriction if enabled and from spike damage
      if (gameConfig.player.knockback.movementRestriction.enabled && 
          attacker && attacker.type === "spike") {
        player.movementRestriction = {
          active: true,
          startTime: Date.now(),
          duration: gameConfig.player.knockback.movementRestriction.duration,
          knockbackDirection: knockbackDirection,
          directionPenalty: gameConfig.player.knockback.movementRestriction.directionPenalty,
          sideMovementPenalty: gameConfig.player.knockback.movementRestriction.sideMovementPenalty,
          oppositeMovementBonus: gameConfig.player.knockback.movementRestriction.oppositeMovementBonus,
          fadeOut: gameConfig.player.knockback.movementRestriction.fadeOut
        };
      }
    }
  }

  // Broadcast health update with knockback direction
  io.emit("playerHealthUpdate", {
    playerId,
    health: player.health,
    maxHealth: gameConfig.player.health.max,
    timestamp: Date.now(),
    velocity: player.velocity,
    knockbackDirection: knockbackDirection,
  });

  if (player.health <= 0 && oldHealth > 0) {
    handlePlayerDeath(playerId, players, io, gameConfig, trees, stones);
  }

  return true;
}

/**
 * Heals a player by a specified amount, up to the maximum health defined in the game configuration.
 * @param {string} playerId - The ID of the player to heal.
 * @param {number} amount - The amount of health to restore.
 * @returns {boolean} True if healing was applied; false if the player does not exist or is already at full health.
 */
export function healPlayer(playerId, amount, players, io, gameConfig) {
  const player = players[playerId];
  if (!player) return false;

  // Check if player is already at full health
  if (player.health >= gameConfig.player.health.max) return false;

  // Apply healing with max health cap
  const oldHealth = player.health;
  player.health = Math.min(
    gameConfig.player.health.max,
    player.health + amount
  );

  // Check if player is currently experiencing knockback
  const hasActiveKnockback = player.lastKnockbackTime && 
    (Date.now() - player.lastKnockbackTime < player.knockbackDuration);

  // Only broadcast health update if no active knockback to prevent interference
  if (!hasActiveKnockback) {
    broadcastHealthUpdate(playerId, players, io, gameConfig);
  } else {
    // If there's active knockback, send a minimal health update without velocity
    io.emit("playerHealthUpdate", {
      playerId,
      health: player.health,
      maxHealth: gameConfig.player.health.max,
      timestamp: Date.now(),
      // Don't send velocity during active knockback to preserve it
      preserveVelocity: true,
    });
  }

  return player.health > oldHealth; // Return true if any healing was applied
}

/**
 * Handles player death by marking the player as dead, emitting a death event, and scheduling a respawn after a delay.
 *
 * Marks the player as dead, sets health to zero, and emits a "playerDied" event to all clients. After a 3-second delay, respawns the player at a safe location with full health and emits a "playerRespawned" event containing the updated player state.
 */
export function handlePlayerDeath(
  playerId,
  players,
  io,
  gameConfig,
  trees,
  stones
) {
  const player = players[playerId];
  if (!player) return;

  // Set player state to dead
  player.isDead = true;
  player.health = 0;
  player.isRespawning = true;

  // Emit death event with complete player state
  io.emit("playerDied", {
    playerId,
    position: { x: player.x, y: player.y },
    health: 0,
  });

  // Respawn player with full health after delay
  const respawnTimeout = setTimeout(() => {
    const player = players[playerId];
    if (player && player.isRespawning) {
      const spawnPoint = findSafeSpawnPoint(gameConfig, trees, stones);
      player.x = spawnPoint.x;
      player.y = spawnPoint.y;
      player.health = gameConfig.player.health.max;
      player.lastDamageTime = null;
      player.isDead = false;
      player.isRespawning = false;

      // Notify all clients about respawn with complete state
      io.emit("playerRespawned", {
        playerId,
        x: player.x,
        y: player.y,
        health: player.health,
        maxHealth: gameConfig.player.health.max,
        inventory: player.inventory,
      });
    }
  }, gameConfig.player.respawnDelay || 3000);

  // Store timeout ID for potential cleanup
  if (player) {
    player.respawnTimeoutId = respawnTimeout;
  }
}

/**
 * Calculates movement speed multiplier based on player's movement direction relative to knockback direction.
 * Returns reduced speed when moving in the knockback direction, normal speed otherwise.
 */
export function getMovementSpeedMultiplier(player, movementDirection) {
  if (!player.movementRestriction || !player.movementRestriction.active) {
    return 1.0; // No restriction active
  }

  const currentTime = Date.now();
  const elapsed = currentTime - player.movementRestriction.startTime;
  
  // Check if restriction has expired
  if (elapsed >= player.movementRestriction.duration) {
    player.movementRestriction.active = false;
    return 1.0;
  }

  // Calculate angle difference between movement and knockback direction
  const knockbackDir = player.movementRestriction.knockbackDirection;
  let angleDiff = Math.abs(movementDirection - knockbackDir);
  
  // Normalize angle difference to 0-π range
  if (angleDiff > Math.PI) {
    angleDiff = 2 * Math.PI - angleDiff;
  }

  // If moving in knockback direction (within 45 degrees), apply penalty
  if (angleDiff < Math.PI / 4) {
    let multiplier = player.movementRestriction.directionPenalty;
    
    // Apply fade out effect if enabled
    if (player.movementRestriction.fadeOut) {
      const fadeProgress = elapsed / player.movementRestriction.duration;
      multiplier = player.movementRestriction.directionPenalty + 
                   (1.0 - player.movementRestriction.directionPenalty) * fadeProgress;
    }
    
    return multiplier;
  }

  return 1.0; // Normal speed for other directions
}
