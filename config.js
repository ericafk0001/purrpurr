const gameConfig = {
  worldWidth: 5000,
  worldHeight: 5000,
  playerRadius: 70,
  moveSpeed: 14,
  colors: {
    player: "red",
    tree: "green",
    worldBorder: "#333333",
    stone: "#787878",
  },
  trees: {
    density: 0.000003,
    radius: 130,
    minDistance: 220,
    maxTreesPerCell: 2,
  },
  stones: {
    density: 0.0000007,
    radius: 80,
    minDistance: 180,
    maxStonePerCell: 2,
  },
  assets: {
    player: "/assets/player.png",
    tree: "/assets/tree.png",
    stone: "/assets/stone.png",
  },
  collision: {
    enabled: true,
    debugEnabled: true, // startup debug state
    debug: false,
    sliding: true,
    margin: 5,
    debugColor: "rgba(255, 0, 0, 0.6)",
    sizes: {
      player: 35,
      tree: 75,
      stone: 65,
    },
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = gameConfig;
}
