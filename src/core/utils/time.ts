/** Timestamp ISO 8601 corrente (usato per createdAt/updatedAt). */
export function nowIso(): string {
  return new Date().toISOString();
}
