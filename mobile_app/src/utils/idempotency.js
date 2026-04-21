export function createIdempotencyKey(prefix = "dist") {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}
