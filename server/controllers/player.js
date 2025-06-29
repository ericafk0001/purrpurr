// Player management, health, and inventory functions
import { findSafeSpawnPoint } from "../utils/collision.js";

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
 * Applies damage to a player, updates their health, and applies knockback if attacked by another player.
 *
 * Reduces the specified player's health by the given amount, applies knockback based on the attacker's weapon if present, and broadcasts the updated health to all clients. If the player's health drops to zero from a positive value, triggers the death and respawn process.
 *
 * @param {string} playerId - The ID of the player receiving damage.
 * @param {number} amount - The amount of damage to apply.
 * @param {object} attacker - The attacking player object, or null if not applicable.
 * @return {boolean} Returns true if damage was applied; false if the player does not exist.
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

  // Get attacker's active weapon
  const attackerWeapon =
    attacker?.inventory?.slots[attacker.inventory.activeSlot];
  const weaponKnockback =
    attackerWeapon?.knockback || gameConfig.player.knockback;

  const oldHealth = player.health;
  player.health = Math.max(0, player.health - amount);
  player.lastDamageTime = Date.now();

  // Apply knockback if attacker position is available
  if (attacker) {
    const dx = player.x - attacker.x;
    const dy = player.y - attacker.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      // Use weapon-specific knockback settings
      player.velocity.x = (dx / dist) * weaponKnockback.force;
      player.velocity.y = (dy / dist) * weaponKnockback.force;

      // Set up velocity decay using weapon values
      player.lastKnockbackTime = Date.now();
      player.knockbackDecay = weaponKnockback.decay;
      player.knockbackDuration = weaponKnockback.duration;
    }
  }

  // Broadcast health update
  broadcastHealthUpdate(playerId, players, io, gameConfig);

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

  // Broadcast health update
  broadcastHealthUpdate(playerId, players, io, gameConfig);

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
  setTimeout(() => {
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
  }, 3000); // 3 second respawn delay
}
