import { useEffect } from 'react';
import useBranding from '../../hooks/useBranding';

/**
 * Applies the favicon uploaded in Settings → Branding & Logos, if any;
 * otherwise the bundled /favicon.ico stays. Renders nothing.
 */
const BrandFavicon = () => {
  const image = useBranding().favicon?.image;

  useEffect(() => {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (!link.dataset.defaultHref) {
      link.dataset.defaultHref = link.getAttribute('href') || '/favicon.ico';
    }
    link.href = image || link.dataset.defaultHref;
  }, [image]);

  return null;
};

export default BrandFavicon;
