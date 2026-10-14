import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { clearBrandingCache } from '../utils/BrandingService';

// Settings → Branding & Logos (System Admin).
const BrandingAdminService = () => {
  const call = async (label, request) => {
    try {
      const response = await request();
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error(`Error in BrandingAdminService.${label}:`, error.message);
      throw error;
    }
  };

  const list = () => call('list', () => userClient.get('/admin/branding'));

  // image: File | null; linkUrl: string ('' removes the link)
  const update = async (key, { image, linkUrl }) => {
    const form = new FormData();
    if (image) {
      form.append('image', image);
    }
    if (linkUrl !== undefined) {
      form.append('linkUrl', linkUrl ?? '');
    }
    const result = await call('update', () => userClient.post(`/admin/branding/${key}`, form, { headers: { 'Content-Type': 'multipart/form-data' } }));
    clearBrandingCache();
    return result;
  };

  const reset = async key => {
    const result = await call('reset', () => userClient.post(`/admin/branding/${key}/reset`));
    clearBrandingCache();
    return result;
  };

  return { list, update, reset };
};

export default BrandingAdminService;
