// Import core variables
import {
  ctx,
  config,
  myPlayer,
  players,
  walls,
  socket,
  trees,
  stones,
  camera,
  items,
} from "../utils/constants.js";
import { currentFps } from "../core/gameLoop.js";
import { getChatMode } from "./chat.js";
import { autoAttackEnabled } from "../player/attack.js";

// Debug variables
export let debugPanelVisible = false;

/**
 * Sets the visibility state of the debug panel.
 * @param {boolean} value - Whether the debug panel should be visible.
 */
export function setDebugPanelVisible(value) {
  debugPanelVisible = value;
}

/**
 * Toggles the visibility of the debug panel.
 */
export function toggleDebugPanel() {
  debugPanelVisible = !debugPanelVisible;
}

/**
 * Handles keyboard input for debug features, including toggling the debug panel, collision debug, weapon debug, and sending teleport requests.
 * @param {KeyboardEvent} e - The keyboard event to process.
 * @return {boolean} True if a debug-related key was handled; otherwise, false.
 */
export function handleDebugKeydown(e) {
  // Toggle debug panel
  if (e.key === ";") {
    toggleDebugPanel();
    return true; // Event handled
  }

  // Toggle debug collision display
  if (e.key === "p" && debugPanelVisible) {
    config.collision.debug = !config.collision.debug;
    return true; // Event handled
  }

  // Toggle weapon debug - only works when debug panel is open
  if (e.key.toLowerCase() === "o" && debugPanelVisible) {
    config.collision.weaponDebug = !config.collision.weaponDebug;
    return true; // Event handled
  }

  // Add teleport key (T) - only works when debug panel is open
  if (e.key.toLowerCase() === "t" && !getChatMode() && debugPanelVisible) {
    socket.emit("teleportRequest");
    return true; // Event handled
  }

  return false; // Event not handled
}

/**
 * Renders the debug panel overlay on the game canvas, displaying real-time debug information such as FPS, player stats, object counts, and debug mode statuses.
 * 
 * The panel is only drawn if it is visible and the player exists. It includes a semi-transparent background and displays information in a monospace font for clarity.
 */
export function drawDebugPanel() {
  if (!debugPanelVisible || !myPlayer) return;

  const padding = 10;
  const lineHeight = 20;
  let y = padding;

  // Draw semi-transparent background
  ctx.fillStyle = "rgba(0, 0, 0, 0.4  )";
  ctx.fillRect(padding, padding, 200, 210);

  // Draw debug info
  ctx.fillStyle = "white";
  ctx.font = "12px monospace";
  ctx.textAlign = "left";

  // Calculate physics update rate
  const physicsUpdateRate = 60; // Our fixed physics update rate is 60 FPS

  const debugInfo = [
    `Render FPS: ${currentFps}`,
    `Physics FPS: ${physicsUpdateRate}`,
    `Position: ${Math.round(myPlayer.x)}, ${Math.round(myPlayer.y)}`,
    `Health: ${myPlayer.health}/${config.player.health.max}`,
    `Players: ${Object.keys(players).length}`,
    `Walls: ${walls.length}`,
    `Auto-attack: ${autoAttackEnabled ? "ON" : "OFF"}`,
    `Weapon Debug: ${config.collision.weaponDebug ? "ON" : "OFF"}`,
    `Collision Debug: ${config.collision.debug ? "ON" : "OFF"}`,
    `Press T to teleport`,
  ];

  debugInfo.forEach((text) => {
    ctx.fillText(text, padding * 2, (y += lineHeight));
  });
}
