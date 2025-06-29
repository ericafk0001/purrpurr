// World generation functions for trees and stones

export function generateTrees(trees, gameConfig) {
  const cellSize = gameConfig.trees.minDistance;
  const gridWidth = Math.floor(gameConfig.worldWidth / cellSize);
  const gridHeight = Math.floor(gameConfig.worldHeight / cellSize);

  // create grid with proper size checks
  const grid = Array(gridWidth + 1)
    .fill()
    .map(() => Array(gridHeight + 1).fill(0));

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

  function isValidPosition(x, y, cellX, cellY, grid, maxStonePerCell) {
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
        isValidPosition(
          x,
          y,
          cellX,
          cellY,
          grid,
          gameConfig.stones.maxStonePerCell
        )
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
