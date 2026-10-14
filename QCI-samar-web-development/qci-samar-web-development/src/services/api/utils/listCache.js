// In-memory cache for master-data lookups fetched with `all=true` (states, districts,
// vendor categories, disciplines, fee configurations...). Those complete lists back the
// dropdowns of many screens and modals and were re-downloaded on every mount, although
// they only change when a System Admin edits them.

const DEFAULT_TTL_MS = 10 * 60 * 1000;

// Every cache created here, so logout can drop them all.
const registry = new Set();

const isAllListRequest = (url, config) => /[?&]all=(true|1)(&|$)/.test(String(url)) || config?.params?.all === true || config?.params?.all === 'true';

/**
 * Wrap an axios client for one service module: GET requests for a complete list
 * (`all=true`) are served from memory for `ttlMs`, keyed by URL + params; any POST, PUT,
 * PATCH or DELETE made through the wrapper (create, update, activate, delete...) clears
 * the whole cache, before the request and again once it settles, so the next lookup
 * reflects the change. Every other request passes straight through.
 *
 * Callers get a deep copy of the cached body, so a consumer that sorts or mutates the
 * list (or Redux freezing it) cannot affect what the next caller receives.
 *
 * @param {import('axios').AxiosInstance} client
 * @param {{ ttlMs?: number }} [options]
 */
export const withAllListCache = (client, { ttlMs = DEFAULT_TTL_MS } = {}) => {
  const cache = new Map(); // key -> { expiresAt, promise }
  const clear = () => cache.clear();
  registry.add(clear);

  const get = (url, config) => {
    if (!isAllListRequest(url, config)) {
      return client.get(url, config);
    }
    const key = `${url}|${JSON.stringify(config?.params ?? null)}`;
    let entry = cache.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      entry = { expiresAt: Date.now() + ttlMs, promise: client.get(url, config) };
      cache.set(key, entry);
      const stored = entry;
      // Failures are not cached; the next caller tries again.
      stored.promise.catch(() => {
        if (cache.get(key) === stored) {
          cache.delete(key);
        }
      });
    }
    return entry.promise.then(response => ({ ...response, data: structuredClone(response.data) }));
  };

  const write =
    method =>
    (...args) => {
      clear();
      return client[method](...args).finally(clear);
    };

  return {
    get,
    post: write('post'),
    put: write('put'),
    patch: write('patch'),
    delete: write('delete'),
    clear,
  };
};

/** Drop every master-data list cache (on logout). */
export const clearAllListCaches = () => {
  for (const clear of registry) {
    clear();
  }
};
