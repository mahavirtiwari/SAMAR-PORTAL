import PropTypes from 'prop-types';
import { useCallback, useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';

// Helper function to get progress text styling
const getProgressText = (type) => {
  switch (type) {
    case 'completed':
      return { ...commonStyles.bodySmall600, color: COLORS.status.success100 };
    case 'progress':
      return { ...commonStyles.bodySmall600, color: COLORS.text.primary };
    default:
      return { ...commonStyles.bodySmall600 };
  }
};

// Helper function to get button styling
const getButtonStyle = (type) => {
  switch (type) {
    case 'start':
      return {
        buttonStyle: { color: COLORS.text.primary }
      };
    case 'view':
      return {
        buttonStyle: { color: COLORS.background.primary }
      };
    default:
      return {
        buttonStyle: { color: COLORS.background.primary }
      };
  }
};

// Get progress display configuration based on percentage and status
const getProgress = (percent, status) => {
  switch (Number(percent)) {
    case 0:
      return {
        text: `${percent}%`,
        style: getProgressText('progress', 0),
        buttonText: 'Start',
        buttonTextstyle: getButtonStyle('start').buttonStyle
      };
    case 100:
      return {
        text: 'Completed',
        style: getProgressText('completed'),
        buttonText: 'View Assessment',
        buttonStyle:
          status === 'reopened' || status === 'error'
            ? getButtonStyle('start').buttonStyle
            : getButtonStyle('view').buttonStyle,
        buttonTextstyle:
          status === 'reopened' || status === 'error'
            ? getButtonStyle('start').buttonStyle
            : getButtonStyle('view').buttonStyle
      };
    default:
      return {
        text: `${percent}%`,
        style: getProgressText('progress', percent),
        buttonText: 'Resume',
        buttonStyle: getButtonStyle('start').buttonStyle
      };
  }
};

function AssessmentListItem({ item, onPress }) {
  const progressConfig = useMemo(
    () => getProgress(item.progress, item.status),
    [item.progress, item.status]
  );

  const handleItemPress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  return (
    <View style={styles.listItemContainer}>
      <View style={styles.headerRow}>
        <Text style={[commonStyles.bodyLarge600, { color: COLORS.text.primary }]}>
          {item.applicationNumber?.length > 20
            ? item.applicationNumber.slice(0, 10) + '...'
            : item.applicationNumber}
        </Text>
        <View style={styles.dateContainer}>
          <Image source={Icons.calender} style={commonStyles.iconSize14} />
          <Text style={commonStyles.bodySmall600}>{item.date}</Text>
        </View>
      </View>
      {progressConfig.text !== '0%' && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={progressConfig.style}>{progressConfig.text}</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${item.progress}%` }]} />
          </View>
        </View>
      )}

      <View style={styles.bottomRow}>
        <View style={styles.commentContainer}>
          <Image source={Icons.message} style={commonStyles.iconSize14} />
          <Text style={styles.commentText}>{item.comments}</Text>
        </View>
        <TouchableOpacity
          onPress={handleItemPress}
          style={[styles.startButton, progressConfig.buttonStyle]}>
          <Text style={[styles.startButtonText, progressConfig.buttonTextstyle]}>
            {progressConfig.buttonText}
          </Text>
          <Image source={Icons.arrowRight} style={commonStyles.iconSize12} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

AssessmentListItem.propTypes = {
  item: PropTypes.shape({
    applicationNumber: PropTypes.string,
    assessmentUUID: PropTypes.string.isRequired,
    assessmentId: PropTypes.string,
    date: PropTypes.string,
    progress: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    comments: PropTypes.number,
    status: PropTypes.string,
    backendStatus: PropTypes.string
  }).isRequired,
  onPress: PropTypes.func.isRequired
};

const styles = StyleSheet.create({
  listItemContainer: {
    backgroundColor: COLORS.background.primary,
    borderRadius: BORDER_RADIUS.br12,
    padding: 15
  },
  headerRow: {
    ...commonStyles.rowSpaceBetween
  },
  dateContainer: {
    ...commonStyles.row,
    gap: 5
  },
  progressContainer: {
    paddingTop: Responsive.height(14)
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5
  },
  progressLabel: {
    ...commonStyles.bodySmall500,
    color: COLORS.text.secondary400
  },
  progressBarBackground: {
    height: 7,
    backgroundColor: COLORS.border.borderLight,
    borderRadius: BORDER_RADIUS.br8
  },
  progressBarFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.br8,
    backgroundColor: COLORS.status.success100
  },
  bottomRow: {
    ...commonStyles.rowSpaceBetween,
    marginTop: 20,
    alignItems: 'center'
  },
  commentContainer: {
    borderRadius: BORDER_RADIUS.br30,
    borderColor: COLORS.border.borderRegular,
    borderWidth: 1,
    paddingVertical: 6,
    ...commonStyles.row,
    alignItems: 'center',
    justifyContent: 'center',
    width: Responsive.width(62),
    gap: 5
  },
  commentText: {
    ...commonStyles.bodySmall600,
    color: COLORS.text.secondary200
  },
  startButton: {
    paddingVertical: 8,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  startButtonText: {
    ...commonStyles.bodySmall600,
    color: COLORS.text.primary
  }
});

export default AssessmentListItem;
