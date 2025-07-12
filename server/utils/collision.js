/**
 * Determines whether two circles overlap based on their positions and radii.
 * @param {{x: number, y: number, radius: number}} circle1 - The first circle.
 * @param {{x: number, y: number, radius: number}} circle2 - The second circle.
 * @return {boolean} True if the circles collide; otherwise, false.
 */

export function checkCollision(circle1, circle2) {
  const dx = circle1.x - circle2.x;
  const dy = circle1.y - circle2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < circle1.radius + circle2.radius;
}

/**
 * Finds a random spawn position within the game world that does not collide with trees or stones.
 * Attempts up to 100 times to locate a safe position within a margin from the world boundaries; if unsuccessful, returns the center of the world.
 * @return {{x: number, y: number}} The coordinates of a safe spawn point.
 */
export function findSafeSpawnPoint(gameConfig, trees, stones) {
  const margin = 200;
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    // generate random position
    const x = margin + Math.random() * (gameConfig.worldWidth - 2 * margin);
    const y = margin + Math.random() * (gameConfig.worldHeight - 2 * margin);

    // check if position is safe
    if (isPositionSafe(x, y, gameConfig, trees, stones)) {
      return { x, y };
    }
    attempts++;
  }

  // fallback to center if no safe position found
  return { x: gameConfig.worldWidth / 2, y: gameConfig.worldHeight / 2 };
}

/**
 * Determines if a given position is safe for spawning a player, ensuring no collisions with trees or stones (with a safety buffer).
 * @param {number} x - The x-coordinate of the position to check.
 * @param {number} y - The y-coordinate of the position to check.
 * @param {Object} gameConfig - The game configuration object containing collision sizes.
 * @param {Array} trees - Array of tree objects with position data.
 * @param {Array} stones - Array of stone objects with position data.
 * @return {boolean} True if the position is safe for spawning, false otherwise.
 */
export function isPositionSafe(x, y, gameConfig, trees, stones) {
  const playerCircle = {
    x: x,
    y: y,
    radius: gameConfig.collision.sizes.player,
  };

  // add buffer to collision sizes for spawn safety
  const safetyBuffer = 20;

  // check collisions with trees
  for (const tree of trees) {
    if (
      checkCollision(playerCircle, {
        x: tree.x,
        y: tree.y,
        radius: gameConfig.collision.sizes.tree + safetyBuffer,
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
        radius: gameConfig.collision.sizes.stone + safetyBuffer,
      })
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Attempts to find a valid spawn position within the game world that is not too close to any wall.
 * @param {Object} gameConfig - The game configuration object containing world dimensions and spawn settings.
 * @param {Array<Object>} walls - Array of wall objects with position properties.
 * @return {Object} The coordinates of a valid spawn position, or the world center if none is found after the maximum number of attempts.
 */
export function findValidSpawnPosition(gameConfig, walls) {
  let attempts = 0;
  const maxAttempts = gameConfig.player.spawnConfig.maxSpawnAttempts;
  const minDistFromWalls = gameConfig.player.spawnConfig.minDistanceFromWalls;

  while (attempts < maxAttempts) {
    const x = Math.random() * (gameConfig.worldWidth - 200) + 100;
    const y = Math.random() * (gameConfig.worldHeight - 200) + 100;

    // Check distance from walls
    let tooCloseToWall = false;
    for (const wall of walls) {
      const dx = x - wall.x;
      const dy = y - wall.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minDistFromWalls) {
        tooCloseToWall = true;
        break;
      }
    }

    if (!tooCloseToWall) {
      return { x, y };
    }

    attempts++;
  }

  // If no valid position found after max attempts, return a fallback position
  return {
    x: gameConfig.worldWidth / 2,
    y: gameConfig.worldHeight / 2,
  };
}

/**
 * Checks if a wall can be placed at the given coordinates without being too close to existing walls, trees, or stones.
 *
 * Ensures the proposed wall position meets minimum distance requirements from other walls and does not overlap with trees or stones, factoring in collision sizes and a placement buffer.
 *
 * @param {number} x - The x-coordinate for the proposed wall.
 * @param {number} y - The y-coordinate for the proposed wall.
 * @param {Array} walls - Existing wall objects with position data.
 * @param {Array} trees - Tree objects with position data.
 * @param {Array} stones - Stone objects with position data.
 * @param {Array} spikes - Array of existing spikes.
 * @param {Object} gameConfig - Game configuration with collision sizes and placement rules.
 * @return {boolean} True if the wall placement is valid; otherwise, false.
 */
export function isValidWallPlacement(x, y, walls, trees, stones, spikes, gameConfig) {
  const wallRadius = gameConfig.collision.sizes.wall;
  const minDistance = gameConfig.walls.minDistance;

  // Check distance from other walls
  for (const wall of walls) {
    const dx = x - wall.x;
    const dy = y - wall.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < minDistance) {
      return false;
    }
  }

  // Check distance from spikes
  for (const spike of spikes) {
    const dx = x - spike.x;
    const dy = y - spike.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minSpikeDistance = wallRadius + gameConfig.collision.sizes.spike + 10; // 10px buffer
    if (distance < minSpikeDistance) {
      return false;
    }
  }

  // Check distance from trees
  for (const tree of trees) {
    const dx = x - tree.x;
    const dy = y - tree.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minTreeDistance = wallRadius + gameConfig.collision.sizes.tree + 10;
    if (distance < minTreeDistance) {
      return false;
    }
  }

  // Check distance from stones
  for (const stone of stones) {
    const dx = x - stone.x;
    const dy = y - stone.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minStoneDistance = wallRadius + gameConfig.collision.sizes.stone + 10;
    if (distance < minStoneDistance) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if a spike can be placed at the given coordinates without being too close to existing spikes, walls, trees, or stones.
 *
 * Ensures the proposed spike position meets minimum distance requirements from other spikes and walls, and does not overlap with trees or stones, factoring in collision radii and a placement buffer.
 *
 * @param {number} x - The x-coordinate for the spike placement.
 * @param {number} y - The y-coordinate for the spike placement.
 * @param {Array} spikes - Existing spikes with position data.
 * @param {Array} walls - Existing walls with position data.
 * @param {Array} trees - Existing trees with position data.
 * @param {Array} stones - Existing stones with position data.
 * @param {Object} gameConfig - Game configuration with collision sizes and placement rules.
 * @return {boolean} True if the spike placement is valid; otherwise, false.
 */
export function isValidSpikePosition(
  x,
  y,
  spikes,
  walls,
  trees,
  stones,
  gameConfig
) {
  const spikeRadius = gameConfig.collision.sizes.spike;
  const minDistanceFromSpikes = gameConfig.spikes.minDistance;
  const minDistanceFromWalls = gameConfig.walls.minDistance; // Reuse wall distance for spike-wall separation

  // Check distance from other spikes
  for (const spike of spikes) {
    const dx = x - spike.x;
    const dy = y - spike.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < minDistanceFromSpikes) return false;
  }

  // Check distance from walls
  for (const wall of walls) {
    const dx = x - wall.x;
    const dy = y - wall.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < minDistanceFromWalls) return false;
  }

  // Check distance from trees and stones with exact collision sizes
  const obstacles = [
    ...trees.map((tree) => ({
      ...tree,
      radius: gameConfig.collision.sizes.tree,
    })),
    ...stones.map((stone) => ({
      ...stone,
      radius: gameConfig.collision.sizes.stone,
    })),
  ];

  // Check each obstacle
  for (const obstacle of obstacles) {
    const dx = x - obstacle.x;
    const dy = y - obstacle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minAllowedDistance =
      spikeRadius + obstacle.radius + gameConfig.spikes.placementBuffer;

    if (distance < minAllowedDistance) {
      return false;
    }
  }

  return true;
}
