import { COLORS } from '../assets/theme/Theme';

/**
 * Badge styling (label + colors) per backend assessment status.
 * Unmapped statuses fall back via getStatusConfig().
 */
export const STATUS_CONFIG = {
  in_progress: {
    label: 'IN PROGRESS',
    color: COLORS.warning.primary,
    background: COLORS.warning.light,
    border: COLORS.warning.clarity,
    action: 'View Details',
  },
  completed: {
    label: 'COMPLETED',
    color: COLORS.success.primary,
    background: COLORS.success.light,
    border: COLORS.success.clarity,
    action: 'View Details',
  },
  mobile_complete: {
    label: 'COMPLETED',
    color: COLORS.success.primary,
    background: COLORS.success.light,
    border: COLORS.success.clarity,
    action: 'View Details',
  },
  scheduled: {
    label: 'SCHEDULED',
    color: COLORS.info.primary,
    background: COLORS.info.light,
    border: COLORS.info.clarity,
    action: 'View Details',
  },
};

const DEFAULT_STATUS = {
  color: COLORS.warning.primary,
  background: COLORS.warning.light,
  border: COLORS.warning.clarity,
  action: 'View Details',
};

/** Safe lookup — never returns undefined (avoids crash on unmapped statuses). */
export function getStatusConfig(statusKey, statusLabel) {
  const key = (statusKey || '')
    .toString()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (STATUS_CONFIG[key]) {
    return STATUS_CONFIG[key];
  }
  const label = (statusLabel || statusKey || 'PENDING').toString().toUpperCase();
  return { ...DEFAULT_STATUS, label };
}
