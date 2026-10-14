import { useEffect, useState } from 'react';
import { getBranding, subscribeBranding } from '../services/api/utils/BrandingService';

/**
 * Logos and links from Settings → Branding & Logos, keyed by logo key
 * (samar_logo, sidebar_logo, drdo_logo, qci_logo, favicon). Empty until
 * loaded; callers fall back to the bundled images.
 */
const useBranding = () => {
  const [branding, setBranding] = useState({});

  useEffect(() => {
    let active = true;
    getBranding().then(result => {
      if (active) {
        setBranding(result);
      }
    });
    const unsubscribe = subscribeBranding(result => active && setBranding(result));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return branding;
};

export default useBranding;
