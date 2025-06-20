// Define items globally so they can be accessed in the browser
const gameItems = {
  hammer: {
    id: "hammer",
    name: "Hammer",
    type: "weapon",
    damage: 25,
    range: 90,
    cooldown: 400, // ms between attacks
    useTime: 250, // Reduced animation time for faster feedback
    asset: "./assets/hammer.png",
    slot: 0, // default first slot
    renderOptions: {
      scale: 2.3, // Scale multiplier relative to player size
      offsetX: -0.65, // Offset multiplier from player center
      offsetY: -0.37, // Vertical offset adjustment
      rotationOffset: Math.PI / 2, // Rotation offset in radians
    },
    equipEffect: {
      moveSpeedMultiplier: 1.0, // Player move speed multiplier when equipped
    },
  },
  apple: {
    id: "apple",
    name: "Apple",
    type: "consumable",
    healAmount: 20,
    asset: "./assets/apple.png",
    slot: 1, // default second slot
    renderOptions: {
      scale: 0.7, // Scale multiplier relative to player size
      offsetX: 0.3,
      offsetY: -0.5,
      rotationOffset: 0,
    },
    useEffect: {
      cooldown: 100,
    },
  },
  wall: {
    id: "wall",
    name: "Wooden Wall",
    type: "placeable",
    maxHealth: 240, // Add max health for walls
    asset: "./assets/wall.png",
    slot: 2, // default third slot
    renderOptions: {
      scale: 1.6,
      offsetX: 0.32,
      offsetY: -0.44,
      rotationOffset: 0,
      width: 480, // Original image width
      height: 417, // Original image height
      preserveRatio: true, // This will maintain aspect ratio when rendering
    },
  },
};

// Make items available globally in browser
if (typeof window !== "undefined") {
  window.gameItems = gameItems;
}

// Also support Node.js for server-side
if (typeof module !== "undefined" && module.exports) {
  module.exports = gameItems;
}
