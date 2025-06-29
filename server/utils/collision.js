// Collision detection and physics utilities

export function checkCollision(circle1, circle2) {
  const dx = circle1.x - circle2.x;
  const dy = circle1.y - circle2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < circle1.radius + circle2.radius;
}

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

export function isValidWallPlacement(x, y, walls, trees, stones, gameConfig) {
  const wallRadius = gameConfig.collision.sizes.wall;
  const minDistance = gameConfig.walls.minDistance;

  // Check distance from other walls
  for (const wall of walls) {
    const dx = x - wall.x;
    const dy = y - wall.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < minDistance) return false;
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
      wallRadius + obstacle.radius + gameConfig.walls.placementBuffer;

    if (distance < minAllowedDistance) {
      return false;
    }
  }

  return true;
}
