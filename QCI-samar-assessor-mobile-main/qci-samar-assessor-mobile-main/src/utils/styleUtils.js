/**
 * Style utility functions for components
 *
 * These functions contain domain-specific style logic that is used by components.
 * They should not be placed in the project-agnostic utils directory.
 */

import { Responsive } from '../assets/theme/Layout';
import { COLORS } from '../assets/theme/Theme';

/**
 * Returns style objects for project status based on status and selection state
 * @param {string} status - The status value ('Hot', 'Warm', or 'Cold')
 * @param {boolean} isSelected - Whether the status is selected
 * @returns {Object} - The style object with backgroundColor, textColor, borderColor, and tintColor
 */
export const getProjectStatusStyles = (status, isSelected) => {
  const styles = {
    Hot: {
      backgroundColor: COLORS.lead.lostBg,
      textColor: COLORS.lead.lost,
      borderColor: COLORS.lead.lostBorder,
      tintColor: COLORS.lead.lost
    },
    Warm: {
      backgroundColor: COLORS.lead.openBg,
      textColor: COLORS.lead.open,
      borderColor: COLORS.lead.openBorder,
      tintColor: COLORS.lead.open
    },
    Cold: {
      backgroundColor: COLORS.lead.newBg,
      textColor: COLORS.lead.new,
      borderColor: COLORS.lead.newBorder,
      tintColor: COLORS.lead.new
    }
  };

  if (isSelected) {
    return styles[status];
  }

  return {
    backgroundColor: 'transparent',
    textColor: styles[status]?.textColor || '#EBEDF3',
    borderColor: '#EBEDF3',
    tintColor: '#EBEDF3'
  };
};

/**
 * Returns the text and background colors for lead status
 * @param {string} status - The lead status ('New', 'Open', 'Won', or 'Lost')
 * @param {Object} colors - The COLORS object containing lead status colors
 * @returns {Object} - The object with textColor and backgroundColor
 */
export const getLeadStatusColors = (status, colors) => {
  let textColor, backgroundColor;

  switch (status) {
    case 'New':
      textColor = colors.lead.new;
      backgroundColor = colors.lead.newBg;
      break;
    case 'Open':
      textColor = colors.lead.open;
      backgroundColor = colors.lead.openBg;
      break;
    case 'Won':
      textColor = colors.lead.won;
      backgroundColor = colors.lead.wonBg;
      break;
    case 'Lost':
      textColor = colors.lead.lost;
      backgroundColor = colors.lead.lostBg;
      break;
    default:
      textColor = colors.lead.new;
      backgroundColor = colors.lead.newBg;
  }

  return { textColor, backgroundColor };
};

/**
 * Returns the styles for a separator line
 * @param {number} width - The width of the separator line
 * @param {string} color - The color of the separator line (default: borderColor)
 * @returns {Object} - The style object for the separator line
 */
export const getSeparatorStyle = (width, color = null) => {
  return {
    backgroundColor: color || '#EBEDF3', // Default borderColor if not provided
    height: 1,
    width,
    alignSelf: 'flex-end',
    marginVertical: Responsive.height(5)
  };
};
