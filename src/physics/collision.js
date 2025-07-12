// Import required variables and functions
import {
  myPlayer,
  config,
  players,
  trees,
  stones,
  walls,
  spikes,
  socket,
} from "../utils/constants.js";
import { normalize, dot, clampWithEasing } from "../utils/helpers.js";

// Collision functions

/**
 * Determines whether two circles overlap based on their positions and radii.
 * @param {Object} circle1 - The first circle, with properties `x`, `y`, and `radius`.
 * @param {Object} circle2 - The second circle, with properties `x`, `y`, and `radius`.
 * @return {boolean} True if the circles overlap; otherwise, false.
 */
export function checkCollision(circle1, circle2) {
  const dx = circle1.x - circle2.x;
  const dy = circle1.y - circle2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < circle1.radius + circle2.radius;
}
/**
 * Modifies the player's movement vector to prevent overlapping with static obstacles such as trees, stones, walls, and spikes.
 *
 * Checks the proposed movement and adjusts it so the player slides along obstacles rather than moving through them.
 * @param {number} dx - Proposed movement along the x-axis.
 * @param {number} dy - Proposed movement along the y-axis.
 * @return {{dx: number, dy: number}} The adjusted movement vector that avoids static obstacle penetration.
 */
export function handleCollisions(dx, dy) {
  if (!myPlayer) return { dx, dy };

  const newX = myPlayer.x + dx;
  const newY = myPlayer.y + dy;

  const playerCircle = {
    x: newX,
    y: newY,
    radius: config.collision.sizes.player,
  };

  const staticObstacles = [
    ...trees.map((tree) => ({
      x: tree.x,
      y: tree.y,
      radius: config.collision.sizes.tree,
    })),
    ...stones.map((stone) => ({
      x: stone.x,
      y: stone.y,
      radius: config.collision.sizes.stone,
    })),
    ...walls.map((wall) => ({
      x: wall.x,
      y: wall.y,
      radius: config.collision.sizes.wall,
    })),
    ...spikes.map((spike) => ({
      x: spike.x,
      y: spike.y,
      radius: config.collision.sizes.spike,
    })),
  ];

  let finalDx = dx;
  let finalDy = dy;

  for (const obstacle of staticObstacles) {
    const collisionNormal = {
      x: playerCircle.x - obstacle.x,
      y: playerCircle.y - obstacle.y,
    };
    const distance = Math.sqrt(
      collisionNormal.x * collisionNormal.x +
        collisionNormal.y * collisionNormal.y
    );

    if (distance < playerCircle.radius + obstacle.radius) {
      const normal = normalize(collisionNormal);
      const movement = { x: dx, y: dy };
      const dotProduct = dot(movement, normal);

      finalDx = dx - normal.x * dotProduct;
      finalDy = dy - normal.y * dotProduct;
    }
  }

  return { dx: finalDx, dy: finalDy };
}

/**
 * Resolves collisions between the local player and other players by applying separation forces to prevent overlap.
 *
 * If the local player overlaps with another player, applies a damped push to both players to separate them, distributing the displacement unevenly. Adds random jitter if deeply overlapping to help prevent players from getting stuck, and clamps the local player's position within world bounds.
 */
export function resolvePlayerCollisions() {
  if (!myPlayer) return;

  for (const id in players) {
    if (id === socket.id) continue;

    const otherPlayer = players[id];
    // Use current positions, not render positions
    const dx = myPlayer.x - otherPlayer.x;
    const dy = myPlayer.y - otherPlayer.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDist = config.collision.sizes.player * 2;

    if (distance < minDist && distance > 0) {
      // Calculate separation force with improved damping
      const overlap = minDist - distance;
      const separationForce = Math.min(overlap * 0.5, config.moveSpeed); // Limit maximum force
      const dampingFactor = 0.8; // Add damping to reduce oscillation

      // Normalize direction and apply damped force
      const pushX = (dx / distance) * separationForce * dampingFactor;
      const pushY = (dy / distance) * separationForce * dampingFactor;

      // Apply force to my player with improved distribution
      myPlayer.x += pushX * 0.7;
      myPlayer.y += pushY * 0.7;

      // Apply counter force to other player
      otherPlayer.x -= pushX * 0.3;
      otherPlayer.y -= pushY * 0.3;

      // Add small random jitter to help unstuck players
      if (distance < minDist * 0.5) {
        const jitter = 0.5;
        myPlayer.x += (Math.random() - 0.5) * jitter;
        myPlayer.y += (Math.random() - 0.5) * jitter;
      }

      // Keep within bounds with smooth clamping
      myPlayer.x = clampWithEasing(
        myPlayer.x,
        config.collision.sizes.player,
        config.worldWidth - config.collision.sizes.player
      );
      myPlayer.y = clampWithEasing(
        myPlayer.y,
        config.collision.sizes.player,
        config.worldHeight - config.collision.sizes.player
      );
    }
  }
}
/**
 * Resolves and corrects any penetration of the local player into static obstacles such as trees and stones.
 *
 * If the player is found overlapping with any static obstacle, calculates the average push vector needed to move the player out of all penetrations, applies a damped correction, and clamps the player's position within world bounds.
 */
export function resolveCollisionPenetration() {
  if (!myPlayer) return;

  const playerCircle = {
    x: myPlayer.x,
    y: myPlayer.y,
    radius: config.collision.sizes.player,
  };

  // Trees and stones are static obstacles
  const staticObstacles = [
    ...trees.map((tree) => ({
      x: tree.x,
      y: tree.y,
      radius: config.collision.sizes.tree,
      type: "tree",
    })),
    ...stones.map((stone) => ({
      x: stone.x,
      y: stone.y,
      radius: config.collision.sizes.stone,
      type: "stone",
    })),
  ];

  let totalPushX = 0;
  let totalPushY = 0;
  let pushCount = 0;

  for (const obstacle of staticObstacles) {
    const dx = playerCircle.x - obstacle.x;
    const dy = playerCircle.y - obstacle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDist = playerCircle.radius + obstacle.radius;

    if (distance < minDist && distance > 0) {
      const penetrationDepth = minDist - distance;
      const pushX = (dx / distance) * penetrationDepth;
      const pushY = (dy / distance) * penetrationDepth;

      totalPushX += pushX;
      totalPushY += pushY;
      pushCount++;
    }
  }

  // Apply average push with damping
  if (pushCount > 0) {
    const dampingFactor = 0.8;
    myPlayer.x += (totalPushX / pushCount) * dampingFactor;
    myPlayer.y += (totalPushY / pushCount) * dampingFactor;

    // Ensure we stay within bounds with smooth clamping
    myPlayer.x = clampWithEasing(
      myPlayer.x,
      config.collision.sizes.player,
      config.worldWidth - config.collision.sizes.player
    );
    myPlayer.y = clampWithEasing(
      myPlayer.y,
      config.collision.sizes.player,
      config.worldHeight - config.collision.sizes.player
    );
  }
}

function resolveEntityCollisions(entities, entityType, collisionSize) {
  if (!myPlayer) return;

  const playerCircle = {
    x: myPlayer.x,
    y: myPlayer.y,
    radius: config.collision.sizes.player,
  };

  entities.forEach((entity) => {
    const dx = playerCircle.x - entity.x;
    const dy = playerCircle.y - entity.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDist = playerCircle.radius + collisionSize;

    if (distance < minDist && distance > 0) {
      // Calculate overlap and create a push force
      const overlap = minDist - distance;
      const pushForce = Math.min(overlap * 0.5, config.moveSpeed);
      const dampingFactor = 0.8;

      // Normalize direction and apply push force
      const pushX = (dx / distance) * pushForce * dampingFactor;
      const pushY = (dy / distance) * pushForce * dampingFactor;

      // Apply the push to move player out of spike
      myPlayer.x += pushX;
      myPlayer.y += pushY;

      // Add small random jitter to help unstuck
      if (distance < minDist * 0.5) {
        const jitter = 0.5;
        myPlayer.x += (Math.random() - 0.5) * jitter;
        myPlayer.y += (Math.random() - 0.5) * jitter;
      }
    }
  });
}

export function resolveWallCollisions() {
  resolveEntityCollisions(walls, "wall", config.collision.sizes.wall);
}

export function resolveSpikeCollisions() {
  resolveEntityCollisions(spikes, "spike", config.collision.sizes.spike);
}
