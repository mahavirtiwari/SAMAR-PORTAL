import React, { useRef, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { COLORS, FONT_SIZE, FONTS_FAMILY } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
import AppInput from '../../../../components/base/textInput/AppInput';
import AutoCompleteInput from '../../../../components/base/textInput/AutoCompleteInput';
import { Header } from '../../../../components/layout';
import { AppModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import { sanitizePercentInput } from '../../../../utils';
import DestinationCountriesBottomSheet from './DestinationCountriesBottomSheet';
import SelectPercentageBottomSheet from './SelectPercentageModal';

const AddBoughtOutPart = ({
  isVisible,
  onSelect,
  selectedValue,
  onClose,
  existingBoughtOutParts
}) => {
  // Refs for bottom sheets
  const countrySheetRef = useRef(null);
  const percentageSheetRef = useRef(null);

  const initialEmptyState = {
    name: '',
    isImported: null,
    country: '',
    percentage: ''
  };
  const [boughtOutPartForm, setBoughtOutPartForm] = useState(initialEmptyState);
  // Error state for validation
  const [errors, setErrors] = useState({});

  // Prefill or reset form when modal opens
  React.useEffect(() => {
    if (isVisible) {
      if (selectedValue) {
        setBoughtOutPartForm({
          name: selectedValue.partName || '',
          isImported:
            typeof selectedValue.isImported === 'boolean' ? selectedValue.isImported : null,
          country: selectedValue.importCountry || '',
          percentage: selectedValue.importPercentage
            ? selectedValue.importPercentage.toString()
            : ''
        });
      } else {
        setBoughtOutPartForm(initialEmptyState);
      }
      setErrors({});
    }
  }, [isVisible, selectedValue]);

  const handleCancel = () => {
    setBoughtOutPartForm(initialEmptyState);
    setErrors({});
    onClose();
  };

  const validateForm = () => {
    const newErrors = {};
    if (!boughtOutPartForm.name.trim()) {
      newErrors.name = 'Bought-out Part name is required';
    } else {
      const isDuplicate = existingBoughtOutParts?.some(
        (p) =>
          p.partName?.toLowerCase() === boughtOutPartForm.name.trim().toLowerCase() &&
          (!selectedValue || p.id !== selectedValue.id)
      );
      if (isDuplicate) {
        newErrors.name = 'Bought-out Part already exists';
      }
    }
    if (boughtOutPartForm.isImported === null) {
      newErrors.isImported = 'Please select whether imported';
    }
    if (boughtOutPartForm.isImported === true) {
      if (!boughtOutPartForm.country) {
        newErrors.country = 'Country is required';
      }
      if (!boughtOutPartForm.percentage) {
        newErrors.percentage = 'Percentage is required';
      } else if (
        isNaN(boughtOutPartForm.percentage) ||
        Number(boughtOutPartForm.percentage) <= 0 ||
        Number(boughtOutPartForm.percentage) > 100
      ) {
        newErrors.percentage = 'Enter a valid percentage (1-100)';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addMaterialHandler = async () => {
    if (!validateForm()) {
      return;
    }

    const val = {
      partName: boughtOutPartForm.name.trim(),
      isImported: boughtOutPartForm.isImported || false,
      importPercentage:
        boughtOutPartForm.isImported && boughtOutPartForm.percentage
          ? parseFloat(boughtOutPartForm.percentage)
          : null,
      importCountry: boughtOutPartForm.isImported ? boughtOutPartForm.country : null
    };
    onSelect(val);
    setBoughtOutPartForm(initialEmptyState);
    setErrors({});
    onClose();
  };

  const handleCountrySelection = (countries) => {
    if (countries.length > 0) {
      setBoughtOutPartForm((prev) => ({ ...prev, country: countries[0] }));
      if (errors.country && countries[0]) {
        setErrors((prev) => ({ ...prev, country: undefined }));
      }
    }
  };

  const handlePercentageSelection = (percentage) => {
    setBoughtOutPartForm((prev) => ({ ...prev, percentage }));
    if (errors.percentage && percentage) {
      setErrors((prev) => ({ ...prev, percentage: undefined }));
    }
  };

  const openCountrySelector = () => {
    countrySheetRef.current?.open();
  };

  return (
    <AppModal visible={isVisible}>
      <Header title={'Bought-Out Part'} close={true} onPress={handleCancel} />
      <View style={styles.container}>
        {/* Form Content */}
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.formContainer}>
            {/* Type Selection */}

            {/* Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Name of Bought-out Part<Text style={{ color: COLORS.error.active }}>*</Text>
              </Text>
              <AutoCompleteInput
                name={'boughtOutPart'}
                placeholder={'Search Bought-out Part...'}
                value={boughtOutPartForm.name}
                onChangeText={(text) => {
                  setBoughtOutPartForm((prev) => ({ ...prev, name: text }));
                  if (errors.name && text.trim()) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                onSelect={(_displayValue, item) => {
                  setBoughtOutPartForm((prev) => ({
                    ...prev,
                    name: item?.partName || item?.name || ''
                  }));
                  if (errors.name && (item?.partName || item?.name)) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
              />
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>
            {/* Whether Imported Question */}
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Is this Bought-Out Part being Imported?
                <Text style={{ color: COLORS.error.active }}>*</Text>
              </Text>
              <View style={styles.radioContainer}>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.radioOption}
                  onPress={() => {
                    setBoughtOutPartForm((prev) => ({
                      ...prev,
                      isImported: true,
                      country: '',
                      percentage: ''
                    }));
                    if (errors.isImported) {
                      setErrors((prev) => ({ ...prev, isImported: undefined }));
                    }
                  }}>
                  <View
                    style={[
                      styles.radioButton,
                      boughtOutPartForm.isImported === true && styles.radioButtonSelected
                    ]}>
                    {boughtOutPartForm.isImported === true && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.radioLabel}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.radioOption}
                  onPress={() => {
                    setBoughtOutPartForm((prev) => ({
                      ...prev,
                      isImported: false,
                      country: '',
                      percentage: ''
                    }));
                    if (errors.isImported) {
                      setErrors((prev) => ({ ...prev, isImported: undefined }));
                    }
                  }}>
                  <View
                    style={[
                      styles.radioButton,
                      boughtOutPartForm.isImported === false && styles.radioButtonSelected
                    ]}>
                    {boughtOutPartForm.isImported === false && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.radioLabel}>No</Text>
                </TouchableOpacity>
              </View>
              {errors.isImported && <Text style={styles.errorText}>{errors.isImported}</Text>}
            </View>
            {/* Country (conditional) */}
            {boughtOutPartForm.isImported === true && (
              <View style={styles.inputContainer}>
                <Text style={styles.fieldLabel}>
                  Name of Country from this Bought-out Part is being imported
                  <Text style={{ color: COLORS.error.active }}>*</Text>
                </Text>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.countrySelector}
                  onPress={openCountrySelector}>
                  <Text
                    style={[
                      styles.countryText,
                      !boughtOutPartForm.country && styles.placeholderText
                    ]}>
                    {boughtOutPartForm.country || 'Select Country'}
                  </Text>
                  <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
                </TouchableOpacity>
                {errors.country && <Text style={styles.errorText}>{errors.country}</Text>}
              </View>
            )}
            {/* Percentage (conditional) */}
            {boughtOutPartForm.isImported === true && (
              <View style={styles.inputContainer}>
                <Text style={styles.fieldLabel}>
                  Percentage(%) of Import<Text style={{ color: COLORS.error.active }}>*</Text>
                </Text>
                <AppInput
                  label={undefined}
                  placeholderText={'Enter Percentage'}
                  value={boughtOutPartForm.percentage}
                  onChange={(text) => {
                    const next = sanitizePercentInput(text);
                    if (next === null) {
                      return;
                    }
                    setBoughtOutPartForm((prev) => ({ ...prev, percentage: next }));
                    if (errors.percentage && next) {
                      setErrors((prev) => ({ ...prev, percentage: undefined }));
                    }
                  }}
                  keyboardType="numeric"
                  cap="none"
                  rightComponent={<Text style={styles.percentageSymbol}>%</Text>}
                />
                {errors.percentage && <Text style={styles.errorText}>{errors.percentage}</Text>}
              </View>
            )}
          </View>
        </ScrollView>
        {/* Footer */}
        <View style={styles.footer}>
          <AppButton
            title={'Add'}
            size="large"
            variant="primary"
            onPress={() => addMaterialHandler()}
          />
        </View>
        {/* Country Selection Bottom Sheet */}
        <DestinationCountriesBottomSheet
          ref={countrySheetRef}
          onSelect={handleCountrySelection}
          selectedCountries={boughtOutPartForm.country ? [boughtOutPartForm.country] : []}
          multipleSelection={false}
          title="Select Country"
          excludeIndia
        />
        {/* Percentage Selection Bottom Sheet */}
        <SelectPercentageBottomSheet
          ref={percentageSheetRef}
          onSelect={handlePercentageSelection}
          selectedPercentage={boughtOutPartForm.percentage}
        />
      </View>
    </AppModal>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary
  },
  scrollContainer: {
    flex: 1
  },
  formContainer: {
    padding: Responsive.width(16)
  },
  inputContainer: {
    marginBottom: Responsive.height(24)
  },
  fieldLabel: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    marginBottom: 4
  },
  radioContainer: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 12
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border.light,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioButtonSelected: {
    borderColor: COLORS.primary.main
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary.main
  },
  radioLabel: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(12),
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: Responsive.width(8),
    backgroundColor: COLORS.background.primary,
    height: 45
  },
  countryText: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    flex: 1
  },
  placeholderText: {
    color: COLORS.text.tertiary
  },
  dropdownIcon: {
    width: Responsive.width(16),
    height: Responsive.height(16),
    tintColor: COLORS.text.accent
  },
  percentageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(12),
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: Responsive.width(8),
    backgroundColor: COLORS.background.primary,
    height: 45
  },
  percentageText: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    flex: 1
  },
  percentageSymbol: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.tertiary,
    fontFamily: FONTS_FAMILY.Medium500
  },
  footer: {
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16),
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light
  },
  errorText: {
    color: COLORS.error.main || 'red',
    fontSize: FONT_SIZE.fs12,
    marginTop: 4
  },
  button: {
    paddingVertical: Responsive.height(14),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Responsive.width(8)
  },
  addButton: {
    backgroundColor: COLORS.primary.main
  },
  addButtonText: {
    fontSize: FONT_SIZE.fs16,
    fontWeight: '600',
    color: COLORS.background.primary
  }
};

export default AddBoughtOutPart;
