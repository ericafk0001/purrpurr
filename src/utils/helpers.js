// Mathematical helper functions
export function normalize(vector) {
  const mag = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  return mag === 0 ? vector : { x: vector.x / mag, y: vector.y / mag };
}

export function dot(v1, v2) {
  return v1.x * v2.x + v1.y * v2.y;
}

export function clampWithEasing(value, min, max) {
  if (value < min) {
    const delta = min - value;
    return min - delta * 0.8; // Smooth bounce from boundaries
  }
  if (value > max) {
    const delta = value - max;
    return max + delta * 0.8;
  }
  return value;
}
