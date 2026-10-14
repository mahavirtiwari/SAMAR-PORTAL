import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { clearContentBlockCache } from '../utils/ContentBlockService';

// Settings → Content & Disclaimers (System Admin).
const ContentBlockAdminService = () => {
  const call = async (label, request) => {
    try {
      const response = await request();
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error(`Error in ContentBlockAdminService.${label}:`, error.message);
      throw error;
    }
  };

  const list = () => call('list', () => userClient.get('/admin/content-blocks'));

  const update = async (key, data) => {
    const result = await call('update', () => userClient.put(`/admin/content-blocks/${key}`, data));
    clearContentBlockCache();
    return result;
  };

  const reset = async key => {
    const result = await call('reset', () => userClient.post(`/admin/content-blocks/${key}/reset`));
    clearContentBlockCache();
    return result;
  };

  return { list, update, reset };
};

export default ContentBlockAdminService;
