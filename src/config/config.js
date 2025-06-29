// Game configuration settings using ES modules
export const gameConfig = {
  worldWidth: 5000,
  worldHeight: 5000,
  playerRadius: 60,
  moveSpeed: 285,
  camera: {
    smoothing: 0.07, // Lower values = smoother camera (range: 0.01-0.2)
  },
  colors: {
    player: "red",
    tree: "green",
    worldBorder: "#333333",
    stone: "#787878",
    background: "#6b8356", // Sage green background matching the image
    grid: {
      enabled: true,
      lineColor: "rgba(0, 0, 0, 0.04)", // Grid line color
      size: 50, // Reduced grid size from 100 to 50
      lineWidth: 3,
    },
    healthBar: {
      background: "rgba(0, 0, 0, 0.4)",
      fill: "#00FF00",
      border: "#000000",
      borderWidth: 2, // Add border width configuration
    },
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
    player: "./assets/player.png",
    tree: "./assets/tree.png",
    stone: "./assets/stone.png",
  },
  player: {
    health: {
      max: 100,
      current: 100,
      regenRate: 1, // health points per second when regenerating
      regenDelay: 5000, // milliseconds before health starts regenerating after taking damage
      barOffset: 60, // Changed to position below player
      barWidth: 70, // Wider bar to match screenshot
      barHeight: 10, // Slightly taller
    },
    knockback: {
      force: 6, // Base knockback force
      duration: 200, // How long knockback effect lasts in ms
      decay: 0.9, // How quickly knockback velocity decays
    },
    attack: {
      damage: 10,
      range: 50,
      cooldown: 1000, // milliseconds
    },
    inventory: {
      enabled: true, // Enable the inventory system
      initialSlots: 5, // Start with 5 slots as shown in image
      maxSlots: 10, // Maximum slots player can have after upgrades
      currentSlots: 5, // Current number of slots (can increase with upgrades)
      activeSlot: 0, // Currently selected slot index
      slotContents: [], // Will hold the items
      displayUI: {
        position: { x: 0, y: 10 }, // Position relative to bottom of screen
        slotSize: 60, // Size of each slot square
        padding: 10, // Padding between slots
        backgroundColor: "rgba(70, 70, 70, 0.7)", // Grey with opacity
        borderColor: "rgba(120, 120, 120, 0.8)", // Lighter grey border with opacity
        borderWidth: 2, // Thicker border like in the image
        selectedBorderColor: "rgba(198, 198, 198, 0.8)", // White highlight for selected slot
        bottomOffset: 20, // Distance from bottom of screen
        centerAligned: true, // Center the inventory bar
        cornerRadius: 10, // Rounded corners for slots
        shrinkSelected: true, // Enable shrink effect for selected slot
        shrinkAmount: 0.85, // Shrink to 90% of original size when selected
        hoverColor: "rgba(100, 100, 100, 0.3)", // Color when hovering over slot
        selectedTextColor: "#ffffff", // Text color for selected slot
        textColor: "#999999", // Default text color for slot items
      },
    },
    spawnConfig: {
      minDistanceFromWalls: 100, // Minimum distance from walls when spawning
      maxSpawnAttempts: 10, // Maximum attempts to find valid spawn position
    },
  },
  collision: {
    enabled: true,
    debugEnabled: true, // startup debug state
    debug: false,
    sliding: true,
    margin: 5,
    debugColor: "rgba(255, 0, 0, 0.6)",
    weaponDebug: true, // Whether to show weapon collision boxes
    weaponDebugColor: "rgba(255, 255, 0, 0.4)", // Yellow semi-transparent
    sizes: {
      player: 35,
      tree: 70,
      stone: 65,
      wall: 35, // Add wall collision size
    },
  },
  chat: {
    enabled: true,
    bubbleDisplayTime: 3000, // 3 seconds
    maxMessageLength: 50,
    bubbleColor: "rgba(255, 255, 255, 0.9)",
    textColor: "#000000",
  },
  walls: {
    minDistance: 70, // Minimum distance between walls
    maxWallsPerCell: 3, // Max walls in a grid cell
    placementBuffer: 0, // Extra space needed around walls
  },
};
