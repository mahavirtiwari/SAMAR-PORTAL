import { Logger } from '../../../utils/logger';
import { buildPaginationParams } from '../utils/pagination';

const AuditLogService = userClient => {
  /**
   * Get authentication audit logs (System Admin only)
   * @param {Object} filters - Query filters
   * @param {number} [filters.page] - Page number
   * @param {number} [filters.perPage] - Items per page
   * @param {string} [filters.search] - Match against user name or email
   * @param {string} [filters.event] - login | password_change | password_reset
   * @param {string} [filters.dateFrom] - Start date (YYYY-MM-DD, IST day)
   * @param {string} [filters.dateTo] - End date (YYYY-MM-DD, IST day)
   * @returns {Promise<Object>} Paginated audit log list
   */
  const getAuditLogs = async filters => {
    try {
      const queryString = buildPaginationParams(filters);
      const url = `/admin/audit-logs${queryString}`;

      Logger.info('AuditLogService.getAuditLogs:', url);
      const response = await userClient.get(url);
      return response.data;
    } catch (error) {
      Logger.error('Error in AuditLogService.getAuditLogs:', error.message);
      throw error;
    }
  };

  /**
   * Get the full audit/activity trail (System Admin only) — data changes,
   * authentication, and security events.
   * @param {Object} filters - Query filters
   * @param {number} [filters.page]
   * @param {number} [filters.perPage]
   * @param {string} [filters.search] - Match against user name or email
   * @param {string} [filters.category] - all | data | security | authentication
   * @param {string} [filters.entityType] - Model short name, e.g. User, Application
   * @param {string} [filters.dateFrom] - Start date (YYYY-MM-DD, IST day)
   * @param {string} [filters.dateTo] - End date (YYYY-MM-DD, IST day)
   * @returns {Promise<Object>} Paginated activity log list
   */
  const getActivityLogs = async filters => {
    try {
      const queryString = buildPaginationParams(filters);
      const url = `/admin/activity-logs${queryString}`;

      Logger.info('AuditLogService.getActivityLogs:', url);
      const response = await userClient.get(url);
      return response.data;
    } catch (error) {
      Logger.error('Error in AuditLogService.getActivityLogs:', error.message);
      throw error;
    }
  };

  return {
    getAuditLogs,
    getActivityLogs,
  };
};

export default AuditLogService;
