/**
 * Role utility helpers for component-level authorization checks.
 * These are a secondary defense layer — the backend always enforces permissions.
 */

/**
 * Returns true if the user has the given role slug.
 * @param {object} user - Redux account user object
 * @param {string} role - Role slug to check (e.g. 'operations_manager')
 */
export const hasRole = (user, role) => user?.roles?.some(r => r.slug === role);

/**
 * Returns true if the user has at least one of the given role slugs.
 * @param {object} user - Redux account user object
 * @param {string[]} roles - Array of role slugs to check
 */
export const hasAnyRole = (user, roles) => roles.some(r => hasRole(user, r));
