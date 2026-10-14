import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

// Settings → Email Templates (System Admin).
const EmailTemplateService = () => {
  const call = async (label, request) => {
    try {
      const response = await request();
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error(`Error in EmailTemplateService.${label}:`, error.message);
      throw error;
    }
  };

  const list = () => call('list', () => userClient.get('/admin/email-templates'));
  const get = id => call('get', () => userClient.get(`/admin/email-templates/${id}`));
  const update = (id, data) => call('update', () => userClient.put(`/admin/email-templates/${id}`, data));
  const preview = (id, data) => call('preview', () => userClient.post(`/admin/email-templates/${id}/preview`, data));
  const sendTest = (id, data) => call('sendTest', () => userClient.post(`/admin/email-templates/${id}/test`, data));
  const reset = id => call('reset', () => userClient.post(`/admin/email-templates/${id}/reset`));

  return { list, get, update, preview, sendTest, reset };
};

export default EmailTemplateService;
