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
import { Logger, sanitizePercentInput } from '../../../../utils';
import DestinationCountriesBottomSheet from './DestinationCountriesBottomSheet';
import SelectPercentageBottomSheet from './SelectPercentageModal';

const AddRawMaterial = ({ isVisible, onSelect, selectedValue, onClose, existingRawMaterials }) => {
  // Refs for bottom sheets
  const countrySheetRef = useRef(null);
  const percentageSheetRef = useRef(null);

  const initialEmptyState = {
    name: '',
    isImported: null,
    country: '',
    percentage: ''
  };
  const [rawMaterialForm, setRawMaterialForm] = useState(initialEmptyState);
  const [errors, setErrors] = useState({});

  // Prefill or reset form when modal opens
  React.useEffect(() => {
    if (isVisible) {
      if (selectedValue) {
        setRawMaterialForm({
          name: selectedValue.materialName || '',
          isImported:
            typeof selectedValue.isImported === 'boolean' ? selectedValue.isImported : null,
          country: selectedValue.importCountry || '',
          percentage: selectedValue.importPercentage
            ? selectedValue.importPercentage.toString()
            : ''
        });
      } else {
        setRawMaterialForm(initialEmptyState);
      }
      setErrors({});
    }
  }, [isVisible, selectedValue]);

  const handleCancel = () => {
    setRawMaterialForm(initialEmptyState);
    setErrors({});
    onClose();
  };

  const addMaterialHandler = async () => {
    let newErrors = {};
    if (!rawMaterialForm.name.trim()) {
      newErrors.name = 'Key raw material name is required.';
    } else {
      const isDuplicate = existingRawMaterials?.some(
        (m) =>
          m.materialName?.toLowerCase() === rawMaterialForm.name.trim().toLowerCase() &&
          (!selectedValue || m.id !== selectedValue.id)
      );
      if (isDuplicate) {
        newErrors.name = 'Raw material already exists.';
      }
    }
    if (rawMaterialForm.isImported === null) {
      newErrors.isImported = 'Please specify if imported.';
    }
    if (rawMaterialForm.isImported === true) {
      if (!rawMaterialForm.country) {
        newErrors.country = 'Country is required.';
      }
      if (!rawMaterialForm.percentage) {
        newErrors.percentage = 'Import percentage is required.';
      } else if (parseFloat(rawMaterialForm.percentage) > 100) {
        newErrors.percentage = 'Percentage cannot be more than 100.';
      }
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    const val = {
      materialName: rawMaterialForm.name.trim(),
      isImported: rawMaterialForm.isImported || false,
      importPercentage:
        rawMaterialForm.isImported && rawMaterialForm.percentage
          ? parseFloat(rawMaterialForm.percentage)
          : null,
      importCountry: rawMaterialForm.isImported ? rawMaterialForm.country : null
    };
    onSelect(val);
    setRawMaterialForm(initialEmptyState);
    setErrors({});
    onClose();
  };

  const handleCountrySelection = (countries) => {
    if (countries.length > 0) {
      setRawMaterialForm((prev) => ({ ...prev, country: countries[0] }));
      if (errors.country && countries[0]) {
        setErrors((prev) => ({ ...prev, country: undefined }));
      }
    }
  };

  const handlePercentageSelection = (percentage) => {
    setRawMaterialForm((prev) => ({ ...prev, percentage }));
    if (errors.percentage && percentage) {
      setErrors((prev) => ({ ...prev, percentage: undefined }));
    }
  };

  const openCountrySelector = () => {
    countrySheetRef.current?.open();
  };

  return (
    <AppModal visible={isVisible}>
      <Header title={'Key Raw Material'} close={true} onPress={handleCancel} />
      <View style={styles.container}>
        {/* Form Content */}
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.formContainer}>
            {/* Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Name of Key Raw Material<Text style={{ color: COLORS.error.active }}>*</Text>
              </Text>
              <AutoCompleteInput
                name={'keyResource'}
                placeholder={'Search Key Raw Material...'}
                value={rawMaterialForm.name}
                onChangeText={(text) => {
                  setRawMaterialForm((prev) => ({ ...prev, name: text }));
                  if (errors.name && text.trim()) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                onSelect={(displayValue) => {
                  Logger.info('AutoCompleteInput onSelect', displayValue);
                  setRawMaterialForm((prev) => ({ ...prev, name: displayValue }));
                  if (errors.name && displayValue) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
              />

              {errors.name && (
                <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                  {errors.name}
                </Text>
              )}
            </View>

            {/* Whether Imported Question */}
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Is this Raw Material being Imported?
                <Text style={{ color: COLORS.error.active }}>*</Text>
              </Text>
              <View style={styles.radioContainer}>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.radioOption}
                  onPress={() => {
                    setRawMaterialForm((prev) => ({
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
                      rawMaterialForm.isImported === true && styles.radioButtonSelected
                    ]}>
                    {rawMaterialForm.isImported === true && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.radioLabel}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.radioOption}
                  onPress={() => {
                    setRawMaterialForm((prev) => ({
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
                      rawMaterialForm.isImported === false && styles.radioButtonSelected
                    ]}>
                    {rawMaterialForm.isImported === false && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.radioLabel}>No</Text>
                </TouchableOpacity>
              </View>
              {errors.isImported && (
                <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                  {errors.isImported}
                </Text>
              )}
            </View>

            {/* Country (conditional) */}
            {rawMaterialForm.isImported === true && (
              <View style={styles.inputContainer}>
                <Text style={styles.fieldLabel}>
                  Name of Country from this Key Raw Material is being imported
                  <Text style={{ color: COLORS.error.active }}>*</Text>
                </Text>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.countrySelector}
                  onPress={() => {
                    openCountrySelector();
                  }}>
                  <Text
                    style={[
                      styles.countryText,
                      !rawMaterialForm.country && styles.placeholderText
                    ]}>
                    {rawMaterialForm.country || 'Select Country'}
                  </Text>
                  <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
                </TouchableOpacity>
                {errors.country && (
                  <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                    {errors.country}
                  </Text>
                )}
              </View>
            )}

            {/* Percentage (conditional) */}
            {rawMaterialForm.isImported === true && (
              <View style={styles.inputContainer}>
                <Text style={styles.fieldLabel}>
                  Percentage(%) of Import <Text style={{ color: COLORS.error.active }}>*</Text>
                </Text>
                <AppInput
                  placeholderText={'Enter Percentage'}
                  value={rawMaterialForm.percentage}
                  onChange={(text) => {
                    const next = sanitizePercentInput(text);
                    if (next === null) {
                      return;
                    }
                    setRawMaterialForm((prev) => ({ ...prev, percentage: next }));
                    if (errors.percentage && next) {
                      setErrors((prev) => ({ ...prev, percentage: undefined }));
                    }
                  }}
                  keyboardType="numeric"
                  cap="none"
                  rightComponent={<Text style={styles.percentageSymbol}>%</Text>}
                />
                {errors.percentage && (
                  <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                    {errors.percentage}
                  </Text>
                )}
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
          selectedCountries={rawMaterialForm.country ? [rawMaterialForm.country] : []}
          multipleSelection={false}
          title="Select Country"
          excludeIndia
        />

        {/* Percentage Selection Bottom Sheet */}
        <SelectPercentageBottomSheet
          ref={percentageSheetRef}
          onSelect={handlePercentageSelection}
          selectedPercentage={rawMaterialForm.percentage}
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

export default AddRawMaterial;
