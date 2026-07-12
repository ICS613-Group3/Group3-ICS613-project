/**
 * formatRating
 *
 * Rounds an average rating to 2 decimal places for display.
 *
 * Example:
 * 4.666666 -> 4.67
 * 4.7 -> 4.7
 */
export function formatRating(rating: number): number {
  return Math.round(rating * 100) / 100;
}
