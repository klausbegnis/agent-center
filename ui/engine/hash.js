// A small, stable string hash (FNV-1a, 32 bits). The engine uses it to give each room and each
// agent a look that stays the same across reloads without storing anything.

export function hash(text) {
  let value = 2166136261
  for (const char of String(text)) {
    value ^= char.charCodeAt(0)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}
