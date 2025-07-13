/**
 * Executes a melee attack for a player using a hammer, applying damage to walls, spikes, and other players within a specified arc and range.
 *
 * Validates the attacker and weapon before processing. Damages and potentially destroys walls and spikes within the attack arc, emitting corresponding events. Damages other players if any part of their collision area is within the arc, emitting a hit event for each affected player.
 */

export function processAttack(
  attackerId,
  players,
  walls,
  spikes,
  gameConfig,
  io,
  damagePlayer
) {
  const attacker = players[attackerId];
  if (!attacker) return;

  const activeSlot = attacker.inventory.activeSlot;
  const weapon = attacker.inventory.slots[activeSlot];

  if (!weapon || weapon.id !== "hammer") return;

  const attackRange = weapon.range || 120;
  const arcAngle = Math.PI / 1.5; // 120 degrees

  // Calculate attack angle
  const playerAngle = attacker.rotation + Math.PI / 2;
  const startAngle = playerAngle - arcAngle / 2;
  const endAngle = playerAngle + arcAngle / 2;

  Object.entries(players).forEach(([targetId, target]) => {
    if (targetId === attackerId) return;

    // Get closest point on target's circle to attacker
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Account for player radius in range check
    const effectiveRange = attackRange + gameConfig.collision.sizes.player;

    if (distance <= effectiveRange) {
      // Check multiple points around target's collision circle
      const numPoints = 8; // Check 8 points around the circle
      let inArc = false;

      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const pointX =
          target.x + Math.cos(angle) * gameConfig.collision.sizes.player;
        const pointY =
          target.y + Math.sin(angle) * gameConfig.collision.sizes.player;

        // Calculate angle to this point
        const pointDx = pointX - attacker.x;
        const pointDy = pointY - attacker.y;
        const angleToPoint = Math.atan2(pointDy, pointDx);

        // Use consistent angle normalization
        const normalizedPointAngle = normalizeAngle(angleToPoint);
        const normalizedStartAngle = normalizeAngle(startAngle);
        const normalizedEndAngle = normalizeAngle(endAngle);

        // Check if point is within arc
        const angleDiff = Math.abs(
          normalizeAngle(normalizedPointAngle - playerAngle)
        );
        if (angleDiff <= arcAngle / 2) {
          inArc = true;
          break;
        }
      }

      if (inArc) {
        // Pass the entire attacker object so we can access their weapon
        damagePlayer(targetId, weapon.damage || 15, attacker);
        io.emit("playerHit", {
          attackerId: attackerId,
          targetId: targetId,
          damage: weapon.damage || 15,
        });
      }
    }
  });
}

/**
 * Process damage to static objects (walls, spikes) - no lag compensation needed
 */
export function processStaticObjectDamage(attackerId, weapon, walls, spikes, gameConfig, io) {
  const attacker = players[attackerId];
  if (!attacker) return;

  const attackRange = weapon.range || 120;
  const arcAngle = Math.PI / 1.5; // 120 degrees
  const playerAngle = attacker.rotation + Math.PI / 2;

  // Process damage to walls
  processDamageToEntity(
    walls,
    "wall",
    attacker,
    attackRange,
    arcAngle,
    playerAngle,
    weapon,
    gameConfig,
    io
  );

  // Process damage to spikes
  processDamageToEntity(
    spikes,
    "spike",
    attacker,
    attackRange,
    arcAngle,
    playerAngle,
    weapon,
    gameConfig,
    io
  );
}

/**
 * Normalizes an angle to the range [-π, π].
 * @param {number} angle - The angle in radians to normalize.
 * @return {number} The normalized angle within [-π, π].
 */
export function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Extracts shared damage processing logic for entities like walls and spikes.
 */
function processDamageToEntity(
  entities,
  entityType,
  attacker,
  attackRange,
  arcAngle,
  playerAngle,
  weapon,
  gameConfig,
  io
) {
  for (let index = entities.length - 1; index >= 0; index--) {
    const entity = entities[index];
    const dx = entity.x - attacker.x;
    const dy = entity.y - attacker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= attackRange + gameConfig.collision.sizes[entityType]) {
      const angleToEntity = Math.atan2(dy, dx);
      const angleDiff = Math.abs(normalizeAngle(angleToEntity - playerAngle));

      if (angleDiff <= arcAngle / 2) {
        entity.health -= weapon.damage || 15;

        if (entity.health <= 0) {
          entities.splice(index, 1);
          io.emit(`${entityType}Destroyed`, { x: entity.x, y: entity.y });
        } else {
          io.emit(`${entityType}Damaged`, {
            x: entity.x,
            y: entity.y,
            health: entity.health,
          });
        }
      }
    }
  }
}
