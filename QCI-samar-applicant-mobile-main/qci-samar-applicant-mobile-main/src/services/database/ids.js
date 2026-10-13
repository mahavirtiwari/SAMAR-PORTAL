/**
 * Tiny collision-resistant id generator used as the client_uuid (idempotency
 * key) for locally-captured rows. Format: base36 timestamp + 8 random base36
 * chars. Enough entropy that two unit/enterprise admins on two devices don't
 * collide; not a cryptographic guarantee.
 */
export const newId = () => {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);
  return `${ts}-${rand}`;
};

/**
 * Deterministic local id derived from a server id — lets server-sourced rows
 * upsert into a TEXT PK without colliding with client-generated ids (which
 * always contain a hyphen).
 */
export const idFromServer = serverId => `srv-${serverId}`;
