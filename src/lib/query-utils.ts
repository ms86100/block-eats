/**
 * Escapes special characters in user input before using in ILIKE queries.
 * Prevents pattern injection via % and _ characters.
 */
export function escapeIlike(input: string): string {
  return input.replace(/%/g, '\\%').replace(/_/g, '\\_');
}
