/**
 * Tiny collision-resistant id generator used as the primary key for
 * locally-captured rows. Format: base36 timestamp + 8 random base36 chars.
 *
 * Not RFC 4122 UUID — we don't need cryptographic randomness here,
 * just enough entropy that two assessors on two devices don't collide.
 * Swap for `uuid` package if/when we need a stricter guarantee.
 */
export const newId = () => {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);
  return `${ts}-${rand}`;
};

/**
 * Deterministic local id derived from a server id. Lets us upsert
 * server-sourced rows into a TEXT PK without ever colliding with
 * client-generated ids (which always contain a hyphen).
 */
export const idFromServer = (serverId) => `srv-${serverId}`;
