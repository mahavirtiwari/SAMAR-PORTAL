import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

// Settings → Email Server (System Admin).
const MailSettingsService = () => {
  const call = async (label, request) => {
    try {
      const response = await request();
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error(`Error in MailSettingsService.${label}:`, error.message);
      throw error;
    }
  };

  const get = () => call('get', () => userClient.get('/admin/mail-settings'));
  const update = data => call('update', () => userClient.put('/admin/mail-settings', data));
  const sendTest = data => call('sendTest', () => userClient.post('/admin/mail-settings/test', data));

  return { get, update, sendTest };
};

export default MailSettingsService;
