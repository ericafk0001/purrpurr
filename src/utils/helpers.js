/**
 * Returns a unit vector in the same direction as the input 2D vector.
 * If the input vector has zero magnitude, returns the original vector unchanged.
 * @param {{x: number, y: number}} vector - The 2D vector to normalize.
 * @return {{x: number, y: number}} The normalized vector.
 */
export function normalize(vector) {
  const mag = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  return mag === 0 ? vector : { x: vector.x / mag, y: vector.y / mag };
}

/**
 * Calculates the dot product of two 2D vectors.
 * @param {{x: number, y: number}} v1 - The first vector.
 * @param {{x: number, y: number}} v2 - The second vector.
 * @return {number} The dot product of the vectors.
 */
export function dot(v1, v2) {
  return v1.x * v2.x + v1.y * v2.y;
}

/**
 * Clamps a numeric value within a range, applying an easing effect when the value exceeds the boundaries.
 *
 * If the value is less than `min` or greater than `max`, the result is extended beyond the boundary by 80% of the overshoot, creating a smooth bounce effect. If the value is within the range, it is returned unchanged.
 *
 * @param {number} value - The value to clamp.
 * @param {number} min - The minimum allowed value.
 * @param {number} max - The maximum allowed value.
 * @return {number} The clamped or eased value.
 */
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
