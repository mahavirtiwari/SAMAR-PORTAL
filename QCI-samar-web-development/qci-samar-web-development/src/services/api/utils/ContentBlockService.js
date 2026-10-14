import { Logger } from '../../../utils/logger';
import PublicClient from '../clients/publicClient';

/**
 * Reads the admin-editable instructions, declarations and disclaimers
 * (Settings → Content & Disclaimers). Public endpoint, so the login, register
 * and policy pages can use it before sign-in.
 *
 * Blocks are cached for the session for a few minutes; a failed fetch
 * resolves to {} so callers fall back to their built-in text.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // key -> { block, fetchedAt }

export const clearContentBlockCache = () => cache.clear();

export const getContentBlocks = async keys => {
  const now = Date.now();
  const result = {};
  const missing = [];
  for (const key of keys) {
    const hit = cache.get(key);
    if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
      result[key] = hit.block;
    } else {
      missing.push(key);
    }
  }
  if (missing.length === 0) {
    return result;
  }

  try {
    const response = await PublicClient.get('/content-blocks', { params: { keys: missing.join(',') } });
    const blocks = response?.data?.data ?? [];
    for (const block of blocks) {
      cache.set(block.key, { block, fetchedAt: now });
      result[block.key] = block;
    }
  } catch (error) {
    Logger.warn('Content blocks could not be loaded; using built-in text', error?.message);
  }
  return result;
};
