// Define items globally so they can be accessed in the browser
const gameItems = {
  hammer: {
    id: "hammer",
    name: "Hammer",
    type: "weapon",
    damage: 10,
    range: 120,
    cooldown: 400, // ms
    useTime: 400, // ms for swing animation
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
};

// Make items available globally in browser
if (typeof window !== "undefined") {
  window.gameItems = gameItems;
}

// Also support Node.js for server-side
if (typeof module !== "undefined" && module.exports) {
  module.exports = gameItems;
}
