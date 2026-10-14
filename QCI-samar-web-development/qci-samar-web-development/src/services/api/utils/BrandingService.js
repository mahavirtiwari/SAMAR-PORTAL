import { Logger } from '../../../utils/logger';
import PublicClient from '../clients/publicClient';

/**
 * Replaceable logos and their click-through links (Settings → Branding &
 * Logos). Public endpoint; images arrive as data: URIs (allowed by the CSP).
 * Loaded once per page load and shared by every logo on screen; listeners are
 * told when an admin changes a logo so it updates without a reload.
 */
let cache = null; // Promise<{ [key]: { image, linkUrl, title } }>
const listeners = new Set();

const load = async () => {
  try {
    const response = await PublicClient.get('/branding');
    const list = response?.data?.data ?? [];
    return Object.fromEntries(list.map(item => [item.key, item]));
  } catch (error) {
    Logger.warn('Branding could not be loaded; using built-in logos', error?.message);
    return {};
  }
};

export const getBranding = () => {
  if (!cache) {
    cache = load();
  }
  return cache;
};

export const clearBrandingCache = () => {
  cache = null;
  getBranding().then(branding => {
    for (const listener of listeners) {
      listener(branding);
    }
  });
};

export const subscribeBranding = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
