import { Logger } from '../../../utils/logger';
import PublicClient from '../clients/publicClient';

/**
 * Quick links shown under the login page picture (Settings → Quick Links).
 * Public endpoint, loaded once per page load. If it cannot be reached the
 * login page falls back to the applicant user manual it always linked to.
 */
export const DEFAULT_QUICK_LINKS = [{ id: 'manual', label: 'Applicant User Manual', href: '/assets/document/applicant-user-manual.pdf', isFile: true }];

let cache = null;

export const getQuickLinks = () => {
  if (!cache) {
    cache = PublicClient.get('/quick-links')
      .then(response => {
        const list = response?.data?.data;
        return Array.isArray(list) ? list : DEFAULT_QUICK_LINKS;
      })
      .catch(error => {
        Logger.warn('Quick links could not be loaded; using the default', error?.message);
        cache = null;
        return DEFAULT_QUICK_LINKS;
      });
  }
  return cache;
};

export const clearQuickLinksCache = () => {
  cache = null;
};
