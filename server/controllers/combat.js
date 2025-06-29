// Combat and attack system functions

export function processAttack(
  attackerId,
  players,
  walls,
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

  // Process wall damage
  walls.forEach((wall, index) => {
    const dx = wall.x - attacker.x;
    const dy = wall.y - attacker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= attackRange + gameConfig.collision.sizes.wall) {
      const angleToWall = Math.atan2(dy, dx);
      const angleDiff = Math.abs(normalizeAngle(angleToWall - playerAngle));

      if (angleDiff <= arcAngle / 2) {
        wall.health -= weapon.damage || 15;

        if (wall.health <= 0) {
          walls.splice(index, 1);
          io.emit("wallDestroyed", { x: wall.x, y: wall.y });
        } else {
          io.emit("wallDamaged", {
            x: wall.x,
            y: wall.y,
            health: wall.health,
          });
        }
      }
    }
  });

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

        // Normalize angles
        const normalizedPointAngle =
          (angleToPoint + Math.PI * 2) % (Math.PI * 2);
        const normalizedStartAngle = (startAngle + Math.PI * 2) % (Math.PI * 2);
        const normalizedEndAngle = (endAngle + Math.PI * 2) % (Math.PI * 2);

        // Check if point is within arc
        if (normalizedStartAngle <= normalizedEndAngle) {
          if (
            normalizedPointAngle >= normalizedStartAngle &&
            normalizedPointAngle <= normalizedEndAngle
          ) {
            inArc = true;
            break;
          }
        } else {
          if (
            normalizedPointAngle >= normalizedStartAngle ||
            normalizedPointAngle <= normalizedEndAngle
          ) {
            inArc = true;
            break;
          }
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

export function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}
