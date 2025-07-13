/**
 * Validates if a player can place a wall at the specified position
 * @param {Object} player - The player attempting to place the wall
 * @param {Object} position - The position where the wall should be placed
 * @param {Array} walls - Array of existing walls
 * @param {Array} spikes - Array of existing spikes
 * @param {Array} trees - Array of trees
 * @param {Array} stones - Array of stones
 * @param {Object} gameConfig - Game configuration
 * @param {Object} gameItems - Game items configuration
 * @returns {Object} Validation result with success and error message
 */
export function validateWallPlacement(player, position, walls, spikes, trees, stones, gameConfig, gameItems) {
  // Check if player exists and is alive
  if (!player || player.isDead) {
    return { success: false, error: "Player not found or dead" };
  }

  // Validate position coordinates
  if (typeof position.x !== 'number' || typeof position.y !== 'number') {
    return { success: false, error: "Invalid position coordinates" };
  }

  // Check if position is within world bounds
  if (position.x < 0 || position.x > gameConfig.worldWidth || 
      position.y < 0 || position.y > gameConfig.worldHeight) {
    return { success: false, error: "Position outside world bounds" };
  }

  // Check if player has a wall in inventory
  const wallSlot = player.inventory.slots.findIndex(item => item?.id === "wall");
  if (wallSlot === -1) {
    return { success: false, error: "No wall found in inventory" };
  }

  // Check distance from player (prevent remote placement)
  const distanceFromPlayer = Math.sqrt(
    Math.pow(position.x - player.x, 2) + Math.pow(position.y - player.y, 2)
  );
  const maxPlacementDistance = 100; // Maximum placement distance
  if (distanceFromPlayer > maxPlacementDistance) {
    return { success: false, error: "Wall placement too far from player" };
  }

  // Check collision with existing walls
  const wallRadius = gameConfig.collision.sizes.wall;
  const minWallDistance = gameConfig.walls.minDistance;
  
  for (const wall of walls) {
    const distance = Math.sqrt(
      Math.pow(position.x - wall.x, 2) + Math.pow(position.y - wall.y, 2)
    );
    if (distance < minWallDistance) {
      return { success: false, error: "Too close to existing wall" };
    }
  }

  // Check collision with spikes
  for (const spike of spikes) {
    const distance = Math.sqrt(
      Math.pow(position.x - spike.x, 2) + Math.pow(position.y - spike.y, 2)
    );
    const minSpikeDistance = wallRadius + gameConfig.collision.sizes.spike + 10;
    if (distance < minSpikeDistance) {
      return { success: false, error: "Too close to existing spike" };
    }
  }

  // Check collision with trees
  for (const tree of trees) {
    const distance = Math.sqrt(
      Math.pow(position.x - tree.x, 2) + Math.pow(position.y - tree.y, 2)
    );
    const minTreeDistance = wallRadius + gameConfig.collision.sizes.tree + 10;
    if (distance < minTreeDistance) {
      return { success: false, error: "Too close to tree" };
    }
  }

  // Check collision with stones
  for (const stone of stones) {
    const distance = Math.sqrt(
      Math.pow(position.x - stone.x, 2) + Math.pow(position.y - stone.y, 2)
    );
    const minStoneDistance = wallRadius + gameConfig.collision.sizes.stone + 10;
    if (distance < minStoneDistance) {
      return { success: false, error: "Too close to stone" };
    }
  }

  return { success: true };
}

/**
 * Validates if a player can place a spike at the specified position
 * @param {Object} player - The player attempting to place the spike
 * @param {Object} position - The position where the spike should be placed
 * @param {Array} spikes - Array of existing spikes
 * @param {Array} walls - Array of existing walls
 * @param {Array} trees - Array of trees
 * @param {Array} stones - Array of stones
 * @param {Object} gameConfig - Game configuration
 * @param {Object} gameItems - Game items configuration
 * @returns {Object} Validation result with success and error message
 */
export function validateSpikeePlacement(player, position, spikes, walls, trees, stones, gameConfig, gameItems) {
  // Check if player exists and is alive
  if (!player || player.isDead) {
    return { success: false, error: "Player not found or dead" };
  }

  // Validate position coordinates
  if (typeof position.x !== 'number' || typeof position.y !== 'number') {
    return { success: false, error: "Invalid position coordinates" };
  }

  // Check if position is within world bounds
  if (position.x < 0 || position.x > gameConfig.worldWidth || 
      position.y < 0 || position.y > gameConfig.worldHeight) {
    return { success: false, error: "Position outside world bounds" };
  }

  // Check if player has a spike in inventory
  const spikeSlot = player.inventory.slots.findIndex(item => item?.id === "spike");
  if (spikeSlot === -1) {
    return { success: false, error: "No spike found in inventory" };
  }

  // Check distance from player (prevent remote placement)
  const distanceFromPlayer = Math.sqrt(
    Math.pow(position.x - player.x, 2) + Math.pow(position.y - player.y, 2)
  );
  const maxPlacementDistance = 100; // Maximum placement distance
  if (distanceFromPlayer > maxPlacementDistance) {
    return { success: false, error: "Spike placement too far from player" };
  }

  // Check collision with existing spikes
  const spikeRadius = gameConfig.collision.sizes.spike;
  const minSpikeDistance = gameConfig.spikes.minDistance;
  
  for (const spike of spikes) {
    const distance = Math.sqrt(
      Math.pow(position.x - spike.x, 2) + Math.pow(position.y - spike.y, 2)
    );
    if (distance < minSpikeDistance) {
      return { success: false, error: "Too close to existing spike" };
    }
  }

  // Check collision with walls
  for (const wall of walls) {
    const distance = Math.sqrt(
      Math.pow(position.x - wall.x, 2) + Math.pow(position.y - wall.y, 2)
    );
    const minWallDistance = spikeRadius + gameConfig.collision.sizes.wall + 10;
    if (distance < minWallDistance) {
      return { success: false, error: "Too close to existing wall" };
    }
  }

  // Check collision with trees
  for (const tree of trees) {
    const distance = Math.sqrt(
      Math.pow(position.x - tree.x, 2) + Math.pow(position.y - tree.y, 2)
    );
    const minTreeDistance = spikeRadius + gameConfig.collision.sizes.tree + 10;
    if (distance < minTreeDistance) {
      return { success: false, error: "Too close to tree" };
    }
  }

  // Check collision with stones
  for (const stone of stones) {
    const distance = Math.sqrt(
      Math.pow(position.x - stone.x, 2) + Math.pow(position.y - stone.y, 2)
    );
    const minStoneDistance = spikeRadius + gameConfig.collision.sizes.stone + 10;
    if (distance < minStoneDistance) {
      return { success: false, error: "Too close to stone" };
    }
  }

  return { success: true };
}

/**
 * Rate limiting for structure placement to prevent spam
 */
const placementRateLimit = new Map();

export function checkPlacementRateLimit(playerId, structureType = 'structure') {
  const now = Date.now();
  const key = `${playerId}_${structureType}`;
  const lastPlacement = placementRateLimit.get(key) || 0;
  const minInterval = 67; // 500ms minimum between placements

  if (now - lastPlacement < minInterval) {
    return { success: false, error: "Placement rate limit exceeded" };
  }

  placementRateLimit.set(key, now);
  return { success: true };
}
