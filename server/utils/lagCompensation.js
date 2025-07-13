/**
 * Lag compensation system for validating attacks by rewinding player positions
 */

// Store position history for all players
const playerPositionHistory = new Map();
const MAX_HISTORY_DURATION = 1000; // Keep 1 second of history
const POSITION_SAMPLE_RATE = 50; // Sample every 50ms

/**
 * Records a player's position in history for lag compensation
 */
export function recordPlayerPosition(playerId, x, y, rotation, timestamp = Date.now()) {
  if (!playerPositionHistory.has(playerId)) {
    playerPositionHistory.set(playerId, []);
  }

  const history = playerPositionHistory.get(playerId);
  
  // Add new position
  history.push({
    x,
    y,
    rotation,
    timestamp
  });

  // Clean old history
  const cutoffTime = timestamp - MAX_HISTORY_DURATION;
  const filteredHistory = history.filter(pos => pos.timestamp > cutoffTime);
  playerPositionHistory.set(playerId, filteredHistory);
}

/**
 * Gets a player's position at a specific time in the past
 */
function getPlayerPositionAtTime(playerId, targetTime) {
  const history = playerPositionHistory.get(playerId);
  if (!history || history.length === 0) {
    return null;
  }

  // Sort history by timestamp
  const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);

  // Find the two positions that bracket our target time
  let before = null;
  let after = null;

  for (let i = 0; i < sortedHistory.length - 1; i++) {
    const current = sortedHistory[i];
    const next = sortedHistory[i + 1];

    if (current.timestamp <= targetTime && next.timestamp >= targetTime) {
      before = current;
      after = next;
      break;
    }
  }

  // If no bracketing positions found, use closest available
  if (!before || !after) {
    if (targetTime <= sortedHistory[0].timestamp) {
      return sortedHistory[0];
    }
    if (targetTime >= sortedHistory[sortedHistory.length - 1].timestamp) {
      return sortedHistory[sortedHistory.length - 1];
    }
    return null;
  }

  // Interpolate between the two positions
  const timeDiff = after.timestamp - before.timestamp;
  const targetDiff = targetTime - before.timestamp;
  const factor = timeDiff > 0 ? targetDiff / timeDiff : 0;

  return {
    x: before.x + (after.x - before.x) * factor,
    y: before.y + (after.y - before.y) * factor,
    rotation: before.rotation + (after.rotation - before.rotation) * factor,
    timestamp: targetTime
  };
}

/**
 * Validates an attack using lag compensation
 */
export function validateAttackWithLagCompensation(
  attackerId,
  targetId,
  attackTime,
  attackerPing,
  players,
  weapon,
  gameConfig
) {
  // Calculate the time to rewind to
  const compensationTime = attackTime - (attackerPing / 2);
  
  // Get attacker's current position (we trust their position at attack time)
  const attacker = players[attackerId];
  if (!attacker) {
    return { valid: false, reason: "Attacker not found" };
  }

  // Get target's position at the compensated time
  const compensatedTargetPos = getPlayerPositionAtTime(targetId, compensationTime);
  if (!compensatedTargetPos) {
    return { valid: false, reason: "No position history for target" };
  }

  // Create a virtual target with compensated position for hit detection
  const virtualTarget = {
    x: compensatedTargetPos.x,
    y: compensatedTargetPos.y,
    rotation: compensatedTargetPos.rotation
  };

  // Validate the attack against the compensated target position
  const isValidHit = validateAttackGeometry(attacker, virtualTarget, weapon, gameConfig);
  
  return {
    valid: isValidHit,
    compensatedPosition: compensatedTargetPos,
    originalPosition: { x: players[targetId]?.x, y: players[targetId]?.y },
    ping: attackerPing,
    compensationTime: attackTime - compensationTime
  };
}

/**
 * Validates attack geometry (same logic as processAttack but for single target)
 */
function validateAttackGeometry(attacker, target, weapon, gameConfig) {
  const attackRange = weapon.range || 120;
  const arcAngle = Math.PI / 1.5; // 120 degrees

  // Calculate attack angle
  const playerAngle = attacker.rotation + Math.PI / 2;

  // Check if target is within range
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const effectiveRange = attackRange + gameConfig.collision.sizes.player;
  if (distance > effectiveRange) {
    return false;
  }

  // Check multiple points around target's collision circle
  const numPoints = 8;
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const pointX = target.x + Math.cos(angle) * gameConfig.collision.sizes.player;
    const pointY = target.y + Math.sin(angle) * gameConfig.collision.sizes.player;

    // Calculate angle to this point
    const pointDx = pointX - attacker.x;
    const pointDy = pointY - attacker.y;
    const angleToPoint = Math.atan2(pointDy, pointDx);

    // Check if point is within arc
    const angleDiff = Math.abs(normalizeAngle(angleToPoint - playerAngle));
    if (angleDiff <= arcAngle / 2) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes an angle to the range [-π, π]
 */
function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Cleans up position history for disconnected players
 */
export function cleanupPlayerHistory(playerId) {
  playerPositionHistory.delete(playerId);
}

/**
 * Gets lag compensation statistics for debugging
 */
export function getLagCompensationStats() {
  const stats = {};
  playerPositionHistory.forEach((history, playerId) => {
    stats[playerId] = {
      historyLength: history.length,
      oldestEntry: history.length > 0 ? Date.now() - history[0].timestamp : 0,
      newestEntry: history.length > 0 ? Date.now() - history[history.length - 1].timestamp : 0
    };
  });
  return stats;
}
