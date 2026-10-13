import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';

const DatePickerModal = ({ visible, onClose, onSelect, selectedDate, minDate, maxDate }) => {
  const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate || '');
  const [currentDate, setCurrentDate] = useState(
    selectedDate ? new Date(selectedDate) : new Date()
  );
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  useEffect(() => {
    if (selectedDate) {
      setTempSelectedDate(selectedDate);
      setCurrentDate(new Date(selectedDate));
    }
  }, [selectedDate]);

  // Modal animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(modalAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 8,
          useNativeDriver: true
        })
      ]).start();
    } else {
      modalAnim.setValue(0);
      scaleAnim.setValue(0.8);
      setShowMonthPicker(false);
      setShowYearPicker(false);
    }
  }, [visible, modalAnim, scaleAnim]);

  const formatDateToString = useCallback((dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const isToday = useCallback((dateString) => {
    const today = new Date();
    const compareDate = new Date(dateString);
    return (
      today.getDate() === compareDate.getDate() &&
      today.getMonth() === compareDate.getMonth() &&
      today.getFullYear() === compareDate.getFullYear()
    );
  }, []);

  const isFutureDate = useCallback((dateString) => {
    const today = new Date();
    const compareDate = new Date(dateString);
    today.setHours(0, 0, 0, 0);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate > today;
  }, []);

  const isBeforeMinDate = useCallback(
    (dateString) => {
      if (!minDate) {
        return false;
      }
      const min = new Date(minDate);
      const compareDate = new Date(dateString);
      min.setHours(0, 0, 0, 0);
      compareDate.setHours(0, 0, 0, 0);
      return compareDate < min;
    },
    [minDate]
  );

  const isAfterMaxDate = useCallback(
    (dateString) => {
      if (!maxDate) {
        return false;
      }
      const max = new Date(maxDate);
      const compareDate = new Date(dateString);
      max.setHours(0, 0, 0, 0);
      compareDate.setHours(0, 0, 0, 0);
      return compareDate > max;
    },
    [maxDate]
  );

  const getDaysInMonth = useCallback(
    (date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const days = [];

      for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(year, month, day);
        days.push(formatDateToString(dayDate));
      }

      return days;
    },
    [formatDateToString]
  );

  const animateMonthTransition = useCallback(
    (direction, newDate) => {
      setIsTransitioning(true);
      // Keep the slide small so neither the month-year header nor the date grid
      // travels far enough to touch the modal's edge during the transition.
      const slideDirection = direction === 'next' ? -24 : 24;

      Animated.sequence([
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: slideDirection,
            duration: 150,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 150,
            useNativeDriver: true
          })
        ]),
        Animated.timing(slideAnim, {
          toValue: -slideDirection,
          duration: 0,
          useNativeDriver: true
        }),
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true
          })
        ])
      ]).start(() => {
        setIsTransitioning(false);
      });

      setTimeout(() => {
        setCurrentDate(newDate);
      }, 150);
    },
    [slideAnim, fadeAnim]
  );

  const handlePreviousMonth = useCallback(() => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    animateMonthTransition('prev', newDate);
  }, [currentDate, animateMonthTransition]);

  const handleNextMonth = useCallback(() => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    animateMonthTransition('next', newDate);
  }, [currentDate, animateMonthTransition]);

  const handleDateSelect = (dayString) => {
    if (!dayString) {
      return;
    }

    const isDisabled =
      isFutureDate(dayString) || isBeforeMinDate(dayString) || isAfterMaxDate(dayString);

    if (isDisabled) {
      return;
    }

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();

    setTempSelectedDate(dayString);
  };

  const handleYearSelect = useCallback(
    (year) => {
      setCurrentDate(new Date(year, currentDate.getMonth(), 1));
      setShowYearPicker(false);
    },
    [currentDate]
  );

  const handleMonthSelect = useCallback(
    (monthIndex) => {
      setCurrentDate(new Date(currentDate.getFullYear(), monthIndex, 1));
      setShowMonthPicker(false);
    },
    [currentDate]
  );

  const handleSave = () => {
    onSelect(tempSelectedDate);
    onClose();
  };

  const handleCancel = () => {
    setTempSelectedDate(selectedDate || '');
    setCurrentDate(selectedDate ? new Date(selectedDate) : new Date());
    setShowYearPicker(false);
    setShowMonthPicker(false);
    onClose();
  };

  const _formatDateForDisplay = (dateString) => {
    if (!dateString) {
      return '';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderYearPicker = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 1930; i <= currentYear; i++) {
      years.push(i);
    }
    years.reverse();

    const yearRows = [];
    for (let i = 0; i < years.length; i += 4) {
      yearRows.push(years.slice(i, i + 4));
    }

    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.yearPickerGrid}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.yearPickerContent}>
        {yearRows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.yearPickerRow}>
            {row.map((year) => (
              <TouchableOpacity
                activeOpacity={0.7}
                key={year}
                style={[
                  styles.yearPickerCell,
                  year === currentDate.getFullYear() && styles.selectedYearCell
                ]}
                onPress={() => handleYearSelect(year)}>
                <Text
                  style={[
                    styles.yearPickerText,
                    year === currentDate.getFullYear() && styles.selectedYearText
                  ]}>
                  {year}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderMonthPicker = () => {
    return (
      <View style={styles.monthPickerContent}>
        {months.map((month, index) => (
          <TouchableOpacity
            activeOpacity={0.7}
            key={month}
            style={[
              styles.quickPickerItem,
              index === currentDate.getMonth() && styles.selectedQuickPickerItem
            ]}
            onPress={() => handleMonthSelect(index)}>
            <Text
              numberOfLines={1}
              style={[
                styles.quickPickerText,
                index === currentDate.getMonth() && styles.selectedQuickPickerText
              ]}>
              {month}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Shared slide/fade so the month-year header moves in lockstep with the
  // date grid during a month transition.
  const monthTransitionStyle = { opacity: fadeAnim, transform: [{ translateX: slideAnim }] };

  // Future months can't hold a selectable date, so block forward navigation
  // once the displayed month reaches the latest allowed month (maxDate or today).
  const isNextMonthDisabled = () => {
    const lastAllowed = maxDate ? new Date(maxDate) : new Date();
    return (
      currentDate.getFullYear() > lastAllowed.getFullYear() ||
      (currentDate.getFullYear() === lastAllowed.getFullYear() &&
        currentDate.getMonth() >= lastAllowed.getMonth())
    );
  };

  const renderCalendarHeader = () => {
    const nextDisabled = isNextMonthDisabled();
    return (
      <View style={styles.header}>
        <Animated.View style={[monthTransitionStyle]}>
          <View style={styles.monthYearContainer}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setShowMonthPicker(!showMonthPicker);
                setShowYearPicker(false);
              }}>
              <Text style={styles.monthYearText}>{months[currentDate.getMonth()]},</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setShowYearPicker(!showYearPicker);
                setShowMonthPicker(false);
              }}>
              <Text style={styles.monthYearText}>{currentDate.getFullYear()}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        <View style={styles.navButtonsWrapper}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.navButton, isTransitioning && styles.disabledNavButton]}
            onPress={handlePreviousMonth}
            disabled={isTransitioning}>
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.navButton,
              (isTransitioning || nextDisabled) && styles.disabledNavButton
            ]}
            onPress={handleNextMonth}
            disabled={isTransitioning || nextDisabled}>
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderWeekDays = () => (
    <View style={styles.weekDaysContainer}>
      {weekDays.map((day, index) => (
        <View key={`${day}-${index}`} style={styles.weekDayCell}>
          <Text style={styles.weekDayText}>{day}</Text>
        </View>
      ))}
    </View>
  );

  const renderCalendarDays = () => {
    const days = getDaysInMonth(currentDate);
    const rows = [];

    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7);
      while (week.length < 7) {
        week.push(null);
      }

      rows.push(
        <Animated.View key={i} style={[styles.weekRow, monthTransitionStyle]}>
          {week.map((day, index) => {
            if (!day) {
              return <View key={`empty-${i}-${index}`} style={styles.dayCell} />;
            }

            const isSelected = day === tempSelectedDate;
            const isTodayDate = isToday(day);
            const isFuture = isFutureDate(day);
            const isBeforeMin = isBeforeMinDate(day);
            const isAfterMax = isAfterMaxDate(day);
            const isDisabled = isFuture || isBeforeMin || isAfterMax;

            const dayNumber = new Date(day).getDate();

            return (
              <TouchableOpacity
                activeOpacity={0.7}
                key={day}
                style={[
                  styles.dayCell,
                  isSelected && styles.selectedDayCell,
                  isTodayDate && !isSelected && styles.todayDayCell,
                  isDisabled && styles.disabledDayCell
                ]}
                onPress={() => handleDateSelect(day)}
                disabled={isDisabled}>
                <Animated.Text
                  style={[
                    styles.dayText,
                    isSelected && styles.selectedDayText,
                    isTodayDate && !isSelected && styles.todayDayText,
                    isDisabled && styles.disabledDayText,
                    isSelected && { transform: [{ scale: scaleAnim }] }
                  ]}>
                  {dayNumber}
                </Animated.Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      );
    }

    return <View style={styles.calendarGrid}>{rows}</View>;
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: modalAnim }]}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [
                { scale: scaleAnim },
                {
                  translateY: modalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0]
                  })
                }
              ]
            }
          ]}>
          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Select Date</Text>
          </View>
          {/* Calendar Header with Month/Year Navigation */}
          {renderCalendarHeader()}
          {/* Year Picker */}
          {showYearPicker && <View style={styles.quickPickerContainer}>{renderYearPicker()}</View>}
          {/* Month Picker */}
          {showMonthPicker && (
            <View style={styles.quickPickerContainer}>{renderMonthPicker()}</View>
          )}
          {/* Calendar Grid */}
          {!showYearPicker && !showMonthPicker && (
            <>
              {renderWeekDays()}
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.scrollContainer}
                keyboardShouldPersistTaps="handled">
                {renderCalendarDays()}
              </ScrollView>
            </>
          )}
          {/* Footer Buttons */}
          <View style={styles.footer}>
            <View style={[commonStyles.fill]}>
              <AppButton size="medium" variant="soft" title="Cancel" onPress={handleCancel} />
            </View>
            <View style={[commonStyles.fill]}>
              <AppButton
                size="medium"
                variant="primary"
                title="Select"
                onPress={handleSave}
                disabled={!tempSelectedDate}
              />
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Responsive.width(20)
  },
  container: {
    backgroundColor: COLORS.background.primary,
    borderRadius: Responsive.width(20),
    padding: Responsive.height(20),
    width: '100%',
    maxWidth: Responsive.width(380),
    maxHeight: '85%'
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: Responsive.height(16)
  },
  headerTitle: {
    fontSize: FONT_SIZE.fs18,
    fontWeight: '600',
    color: COLORS.text.primary,
    ...commonStyles.FontFamily_SemiBold600
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Responsive.height(20),
    paddingBottom: Responsive.height(12),
    // Keep the same left/right inset the date numbers have so the month-year
    // text stays padded (doesn't run to the modal edge) while it slides.
    paddingHorizontal: Responsive.width(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light
  },
  monthYearContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Responsive.width(6)
  },
  monthYearText: {
    fontSize: FONT_SIZE.fs16,
    color: COLORS.primary.main,
    ...commonStyles.FontFamily_SemiBold600
  },
  navButtonsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Responsive.width(8)
  },
  navButton: {
    width: Responsive.width(32),
    height: Responsive.height(32),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Responsive.width(8),
    backgroundColor: COLORS.background.secondary
  },
  disabledNavButton: {
    opacity: 0.5
  },
  navButtonText: {
    fontSize: 24,
    color: COLORS.primary.main,
    lineHeight: 28,
    ...commonStyles.FontFamily_SemiBold600
  },
  quickPickerContainer: {
    marginBottom: Responsive.height(20),
    borderRadius: Responsive.width(16),
    backgroundColor: COLORS.background.primary,
    maxHeight: Responsive.height(280)
  },
  yearPickerGrid: {
    borderTopColor: COLORS.border.light,
    borderTopWidth: 1,
    paddingTop: Responsive.height(10),
    paddingBottom: Responsive.height(10),
    maxHeight: Responsive.height(300)
  },
  yearPickerContent: {
    paddingBottom: Responsive.height(10)
  },
  yearPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Responsive.height(8),
    paddingHorizontal: Responsive.width(4)
  },
  yearPickerCell: {
    flex: 1,
    height: Responsive.height(42),
    marginHorizontal: Responsive.width(3),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Responsive.width(10),
    backgroundColor: COLORS.background.secondary
  },
  selectedYearCell: {
    backgroundColor: COLORS.primary.main
  },
  yearPickerText: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    ...commonStyles.FontFamily_Medium500
  },
  selectedYearText: {
    color: COLORS.background.primary,
    ...commonStyles.FontFamily_SemiBold600
  },
  monthPickerContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopColor: COLORS.border.light,
    borderTopWidth: 1,
    paddingTop: Responsive.height(10)
  },
  quickPickerItem: {
    paddingVertical: Responsive.height(10),
    paddingHorizontal: Responsive.width(4),
    borderRadius: Responsive.width(8),
    marginVertical: Responsive.height(4),
    width: '33.33%',
    alignItems: 'center'
  },
  selectedQuickPickerItem: {
    backgroundColor: COLORS.primary.main
  },
  quickPickerText: {
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.primary,
    textAlign: 'center',
    ...commonStyles.FontFamily_Medium500
  },
  selectedQuickPickerText: {
    color: COLORS.background.primary,
    ...commonStyles.FontFamily_SemiBold600
  },
  weekDaysContainer: {
    flexDirection: 'row',
    // borderTopColor: COLORS.border.light,
    // borderTopWidth: 1,
    //paddingTop: Responsive.height(16),
    marginBottom: Responsive.height(12)
  },
  weekDayCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  weekDayText: {
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary,
    ...commonStyles.FontFamily_Medium500
  },
  scrollContainer: {
    maxHeight: Responsive.height(300)
  },
  calendarGrid: {
    marginBottom: Responsive.height(15)
  },
  weekRow: {
    flexDirection: 'row',
    gap: 2
  },
  dayCell: {
    flex: 1,
    height: Responsive.height(38),
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Responsive.height(2),
    borderRadius: Responsive.width(10)
  },
  selectedDayCell: {
    backgroundColor: COLORS.primary.main
  },
  todayDayCell: {
    backgroundColor: COLORS.primary.pale,
    borderWidth: 1,
    borderColor: COLORS.primary.main
  },
  disabledDayCell: {
    opacity: 0.55
  },
  dayText: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    ...commonStyles.FontFamily_Medium500
  },
  selectedDayText: {
    color: COLORS.background.primary,
    ...commonStyles.FontFamily_SemiBold600
  },
  todayDayText: {
    color: COLORS.primary.main,
    ...commonStyles.FontFamily_SemiBold600
  },
  disabledDayText: {
    color: COLORS.text.quaternary
  },
  footer: {
    flexDirection: 'row',
    paddingTop: Responsive.height(20),
    gap: Responsive.width(12),
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light
  }
});

export default DatePickerModal;
