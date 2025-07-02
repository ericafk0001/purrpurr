/**
 * Fills the given array with tree objects distributed throughout the game world according to spatial and density constraints.
 *
 * Each tree is assigned a random position, fixed radius, and random rotation, with placement restricted to ensure minimum distances and a maximum number of trees per grid cell and its neighbors.
 */

export function generateTrees(trees, gameConfig) {
  const cellSize = gameConfig.trees.minDistance;
  const gridWidth = Math.floor(gameConfig.worldWidth / cellSize) + 1;
  const gridHeight = Math.floor(gameConfig.worldHeight / cellSize) + 1;
  const grid = Array(gridWidth)
    .fill()
    .map(() => Array(gridHeight).fill(0));

  /**
   * Determines if a given (x, y) position is valid for placing a tree based on grid boundaries and local density constraints.
   *
   * The position is considered valid if it falls within the grid and the total number of trees in the surrounding 3x3 grid cells is less than the maximum allowed per cell as specified in the configuration.
   *
   * @param {number} x - The x-coordinate of the candidate position.
   * @param {number} y - The y-coordinate of the candidate position.
   * @return {boolean} True if the position is valid for tree placement; otherwise, false.
   */
  function isValidPosition(x, y) {
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);

    // ensure we're within grid bounds
    if (cellX >= gridWidth || cellY >= gridHeight || cellX < 0 || cellY < 0) {
      return false;
    }

    let nearbyCount = 0;

    // check surrounding cells with boundary validation
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = cellX + dx;
        const ny = cellY + dy;
        if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
          nearbyCount += grid[nx][ny];
        }
      }
    }

    return nearbyCount < gameConfig.trees.maxTreesPerCell;
  }

  for (let i = 0; i < gameConfig.trees.count; i++) {
    let attempts = 0;
    let placed = false;

    while (!placed && attempts < 10) {
      const x = Math.random() * gameConfig.worldWidth;
      const y = Math.random() * gameConfig.worldHeight;

      if (isValidPosition(x, y)) {
        trees.push({
          x,
          y,
          radius: gameConfig.trees.radius,
          rotation: Math.random() * Math.PI * 2, // random rotation in radians
        });
        const cellX = Math.floor(x / cellSize);
        const cellY = Math.floor(y / cellSize);
        grid[cellX][cellY]++;
        placed = true;
      }

      attempts++;
    }
  }
}

/**
 * Fills the given array with stone objects randomly distributed across the game world, enforcing minimum spacing and density constraints.
 *
 * Stones are placed at random positions, ensuring that no grid cell and its immediate neighbors exceed the configured maximum number of stones. The total number of stones is calculated based on the world area and stone density settings.
 */
export function generateStones(stones, gameConfig) {
  const cellSize = gameConfig.stones.minDistance;
  const gridWidth = Math.floor(gameConfig.worldWidth / cellSize) + 1;
  const gridHeight = Math.floor(gameConfig.worldHeight / cellSize) + 1;
  const grid = Array(gridWidth)
    .fill()
    .map(() => Array(gridHeight).fill(0));

  gameConfig.stones.count = Math.floor(
    gameConfig.worldWidth * gameConfig.worldHeight * gameConfig.stones.density
  );

  function isValidPosition(cellX, cellY, grid, maxStonePerCell) {
    // ensure we're within grid bounds
    if (
      cellX >= grid.length ||
      cellY >= grid[0].length ||
      cellX < 0 ||
      cellY < 0
    ) {
      return false;
    }

    let nearbyCount = 0;

    // check surrounding cells with boundary validation
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = cellX + dx;
        const ny = cellY + dy;
        if (nx >= 0 && nx < grid.length && ny >= 0 && ny < grid[0].length) {
          nearbyCount += grid[nx][ny];
        }
      }
    }

    return nearbyCount < maxStonePerCell;
  }

  for (let i = 0; i < gameConfig.stones.count; i++) {
    let attempts = 0;
    let placed = false;

    while (!placed && attempts < 10) {
      const x = Math.random() * gameConfig.worldWidth;
      const y = Math.random() * gameConfig.worldHeight;
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);

      if (
        isValidPosition(cellX, cellY, grid, gameConfig.stones.maxStonePerCell)
      ) {
        stones.push({
          x,
          y,
          radius: gameConfig.stones.radius,
          rotation: Math.random() * Math.PI * 2,
        });
        grid[cellX][cellY]++;
        placed = true;
      }
      attempts++;
    }
  }
}
