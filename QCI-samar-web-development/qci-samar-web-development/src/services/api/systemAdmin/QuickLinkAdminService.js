import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { clearQuickLinksCache } from '../utils/QuickLinkService';

// Settings → Quick Links (System Admin): the links under the login page picture.
const QuickLinkAdminService = () => {
  const call = async (label, request) => {
    try {
      const response = await request();
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error(`Error in QuickLinkAdminService.${label}:`, error.message);
      throw error;
    }
  };

  const toForm = ({ label, url, file, sortOrder, isActive }) => {
    const form = new FormData();
    form.append('label', label ?? '');
    if (file) {
      form.append('file', file);
    } else if (url !== undefined) {
      form.append('url', url ?? '');
    }
    if (sortOrder !== undefined && sortOrder !== '') {
      form.append('sortOrder', String(sortOrder));
    }
    if (isActive !== undefined) {
      form.append('isActive', isActive ? '1' : '0');
    }
    return form;
  };

  const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

  const list = () => call('list', () => userClient.get('/admin/quick-links'));

  const create = async link => {
    const result = await call('create', () => userClient.post('/admin/quick-links', toForm(link), multipart));
    clearQuickLinksCache();
    return result;
  };

  const update = async (id, link) => {
    const result = await call('update', () => userClient.post(`/admin/quick-links/${id}`, toForm(link), multipart));
    clearQuickLinksCache();
    return result;
  };

  const remove = async id => {
    const result = await call('remove', () => userClient.delete(`/admin/quick-links/${id}`));
    clearQuickLinksCache();
    return result;
  };

  return { list, create, update, remove };
};

export default QuickLinkAdminService;
