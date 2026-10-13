import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE } from '../../../../assets/theme/Theme';
import { AppBottomSheet } from '../../../../components/shared';

const SelectPercentageBottomSheet = forwardRef(({ onSelect, selectedPercentage }, ref) => {
  const bottomSheetRef = useRef(null);
  const [tempSelectedPercentage, setTempSelectedPercentage] = useState(selectedPercentage);

  useImperativeHandle(ref, () => ({
    open: () => {
      setTempSelectedPercentage(selectedPercentage);
      bottomSheetRef.current?.open();
    },
    close: () => {
      bottomSheetRef.current?.close();
    }
  }));

  const percentages = [
    { id: 1, value: '10' },
    { id: 2, value: '20' },
    { id: 3, value: '25' },
    { id: 4, value: '30' },
    { id: 5, value: '40' },
    { id: 6, value: '50' },
    { id: 7, value: '60' },
    { id: 8, value: '70' },
    { id: 9, value: '75' },
    { id: 10, value: '80' },
    { id: 11, value: '90' },
    { id: 12, value: '100' }
  ];

  const handlePercentageSelect = (percentageValue) => {
    setTempSelectedPercentage(percentageValue);
    // For single selection, automatically save and close
    onSelect(percentageValue);
    bottomSheetRef.current?.close();
  };

  const _handleSave = () => {
    onSelect(tempSelectedPercentage);
    bottomSheetRef.current?.close();
  };

  const _handleCancel = () => {
    setTempSelectedPercentage(selectedPercentage);
    bottomSheetRef.current?.close();
  };

  const renderPercentageItem = ({ item }) => {
    const isSelected = tempSelectedPercentage === item.value;

    return (
      <TouchableOpacity
        style={styles.percentageItem}
        onPress={() => handlePercentageSelect(item.value)}
        activeOpacity={0.6}>
        <Text style={styles.percentageName}>{item.value}%</Text>
        <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
          {isSelected && <View style={styles.radioButtonInner} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <AppBottomSheet
      ref={bottomSheetRef}
      snapPoints={['70%']}
      headerComponent={
        <View style={styles.header}>
          {/* <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <Image source={Icons.closeCross} style={styles.closeIcon} />
          </TouchableOpacity> */}
          <Text style={styles.headerTitle}>Select Percentage</Text>
          <View style={styles.placeholder} />
        </View>
      }>
      {/* Percentage List */}
      <View style={styles.listContainer}>
        <FlatList
          data={percentages}
          renderItem={renderPercentageItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </AppBottomSheet>
  );
});

const styles = {
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Responsive.width(20),
    paddingVertical: Responsive.height(16),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary
  },
  closeButton: {
    width: Responsive.width(24),
    height: Responsive.height(24),
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeIcon: {
    width: Responsive.width(16),
    height: Responsive.height(16),
    tintColor: COLORS.text.secondary
  },
  headerTitle: {
    fontSize: FONT_SIZE.fs18,
    fontWeight: '600',
    color: COLORS.text.primary,
    ...commonStyles.FontFamily_SemiBold600,
    textAlign: 'center',
    flex: 1
  },
  placeholder: {
    width: Responsive.width(24)
  },
  listContainer: {
    flex: 1,
    backgroundColor: COLORS.background.primary
  },
  list: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: Responsive.width(20)
  },
  percentageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Responsive.height(16),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light
  },
  percentageName: {
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.primary,
    ...commonStyles.FontFamily_Medium500
  },
  radioButton: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    borderRadius: Responsive.width(10),
    borderWidth: 2,
    borderColor: COLORS.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background.primary
  },
  radioButtonSelected: {
    borderColor: COLORS.primary.main
  },
  radioButtonInner: {
    width: Responsive.width(10),
    height: Responsive.height(10),
    borderRadius: Responsive.width(5),
    backgroundColor: COLORS.primary.main
  },
  checkIcon: {
    width: Responsive.width(12),
    height: Responsive.height(12),
    tintColor: COLORS.background.primary
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: Responsive.width(20),
    paddingVertical: Responsive.height(16),
    paddingBottom: Responsive.height(24),
    backgroundColor: COLORS.background.primary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    gap: Responsive.width(12)
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Responsive.height(16),
    backgroundColor: COLORS.background.secondary,
    borderRadius: BORDER_RADIUS.br12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border.medium
  },
  cancelButtonText: {
    fontSize: FONT_SIZE.fs16,
    fontWeight: '600',
    color: COLORS.text.secondary,
    ...commonStyles.FontFamily_SemiBold600
  },
  saveButton: {
    flex: 1,
    paddingVertical: Responsive.height(16),
    backgroundColor: COLORS.primary.main,
    borderRadius: BORDER_RADIUS.br12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveButtonText: {
    fontSize: FONT_SIZE.fs16,
    fontWeight: '600',
    color: COLORS.background.primary,
    ...commonStyles.FontFamily_SemiBold600
  }
};

export default SelectPercentageBottomSheet;
