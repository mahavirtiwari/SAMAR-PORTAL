import { Logger } from '../../../utils/logger';

const IntegrationFailureService = userClient => {
  /**
   * Get the read-only integration & system-job failure feed (System Admin only).
   * @param {Object} filters - Query filters
   * @param {number} [filters.page] - Page number
   * @param {number} [filters.perPage] - Items per page
   * @param {string} [filters.category] - payment | erp | email | system_job
   * @returns {Promise<Object>} Paginated integration-failure list
   */
  const getIntegrationFailures = async filters => {
    try {
      const params = [];
      if (filters?.category) {
        params.push(`category=${encodeURIComponent(filters.category)}`);
      }
      if (filters?.perPage) {
        params.push(`perPage=${filters.perPage}`);
      }
      if (filters?.page) {
        params.push(`page=${filters.page}`);
      }
      const url = `/admin/integration-failures${params.length ? `?${params.join('&')}` : ''}`;

      Logger.info('IntegrationFailureService.getIntegrationFailures:', url);
      const response = await userClient.get(url);
      return response.data;
    } catch (error) {
      Logger.error('Error in IntegrationFailureService.getIntegrationFailures:', error.message);
      throw error;
    }
  };

  /**
   * Get the category filter options (friendly labels) for the monitor dropdown.
   * @returns {Promise<Object>} { data: [{ key, label }] }
   */
  const getCategories = async () => {
    try {
      const url = '/admin/integration-failures/categories';

      Logger.info('IntegrationFailureService.getCategories:', url);
      const response = await userClient.get(url);
      return response.data;
    } catch (error) {
      Logger.error('Error in IntegrationFailureService.getCategories:', error.message);
      throw error;
    }
  };

  return {
    getIntegrationFailures,
    getCategories,
  };
};

export default IntegrationFailureService;
