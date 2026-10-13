import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
import AppInput from '../../../../components/base/textInput/AppInput';
import AutoCompleteInput from '../../../../components/base/textInput/AutoCompleteInput';
import { Header } from '../../../../components/layout';
import { AppModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import { sanitizePercentInput } from '../../../../utils';
import DestinationCountriesBottomSheet from './DestinationCountriesBottomSheet';

// Copy for the two near-identical entities this modal serves. Key service
// resources and outsourced service components share the same import shape
// (the parent maps to svcKeyResources/resourceName vs
// svcOutsourcedComponents/componentName), so one modal renders both.
const VARIANT_COPY = {
  resource: {
    addTitle: 'Key Service Resources',
    editTitle: 'Edit Key Service Resource',
    nameLabel: 'Key Service Resources',
    placeholder: 'Name of Key Service Resources',
    importQuestion: 'Is this Resource from Overseas?',
    required: 'Key service resource name is required.',
    duplicate: 'Key service resource already exists.'
  },
  component: {
    addTitle: 'Outsourced Service Component',
    editTitle: 'Edit Outsourced Component',
    nameLabel: 'Outsourced Service Component',
    placeholder: 'Name of Outsourced Service Component',
    importQuestion: 'Is this Service Component from Overseas?',
    required: 'Outsourced component name is required.',
    duplicate: 'Outsourced component already exists.'
  }
};

const AddKeyResource = ({
  isVisible,
  onSelect,
  selectedValue,
  onClose,
  existingResources,
  providerType,
  variant = 'resource',
  // Outsourced components have no master list of their own — they're resources
  // that happen to be outsourced, so reuse the service-resource suggestions.
  autoCompleteName = 'serviceKeyResource'
}) => {
  const countrySheetRef = React.useRef(null);
  const copy = VARIANT_COPY[variant] || VARIANT_COPY.resource;

  const initialEmptyState = {
    name: '',
    isImported: null,
    country: '',
    percentage: ''
  };

  const [keyResourceForm, setKeyResourceForm] = useState(initialEmptyState);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isVisible) {
      if (selectedValue) {
        setKeyResourceForm({
          name: selectedValue.name || '',
          isImported:
            typeof selectedValue.isImported === 'boolean' ? selectedValue.isImported : null,
          country: selectedValue.importCountry || '',
          percentage:
            selectedValue.importPercentage != null ? selectedValue.importPercentage.toString() : ''
        });
      } else {
        setKeyResourceForm(initialEmptyState);
      }
      setErrors({});
    }
  }, [isVisible, selectedValue]);

  const handleCancel = () => {
    setKeyResourceForm(initialEmptyState);
    setErrors({});
    onClose();
  };

  const addResourceHandler = () => {
    const name = keyResourceForm.name.trim();
    let newErrors = {};

    if (!name) {
      newErrors.name = copy.required;
    } else {
      const isDuplicate = existingResources?.some(
        (r) =>
          r.name?.toLowerCase() === name.toLowerCase() &&
          (!selectedValue || r.id !== selectedValue.id)
      );
      if (isDuplicate) {
        newErrors.name = copy.duplicate;
      }
    }
    if (keyResourceForm.isImported === null) {
      newErrors.isImported = 'Please specify if this is from overseas.';
    }
    if (keyResourceForm.isImported === true) {
      if (!keyResourceForm.country) {
        newErrors.country = 'Source country is required.';
      }
      if (!keyResourceForm.percentage) {
        newErrors.percentage = 'Overseas sourcing percentage is required.';
      } else if (parseFloat(keyResourceForm.percentage) > 100) {
        newErrors.percentage = 'Percentage cannot be more than 100.';
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    const val = {
      name,
      isImported: keyResourceForm.isImported || false,
      importCountry: keyResourceForm.isImported ? keyResourceForm.country : null,
      importPercentage:
        keyResourceForm.isImported && keyResourceForm.percentage
          ? parseFloat(keyResourceForm.percentage)
          : null
    };

    onSelect(val);
    setKeyResourceForm(initialEmptyState);
    setErrors({});
    onClose();
  };

  const setImported = (value) => {
    // Switching import status clears the dependent fields so a stale country /
    // percentage can't be submitted once the answer flips.
    setKeyResourceForm((prev) => ({ ...prev, isImported: value, country: '', percentage: '' }));
    setErrors((prev) => ({
      ...prev,
      isImported: undefined,
      country: undefined,
      percentage: undefined
    }));
  };

  const handleCountrySelection = (countries) => {
    if (countries.length > 0) {
      setKeyResourceForm((prev) => ({ ...prev, country: countries[0] }));
      if (errors.country && countries[0]) {
        setErrors((prev) => ({ ...prev, country: undefined }));
      }
    }
  };

  return (
    <AppModal visible={isVisible}>
      <Header
        title={selectedValue ? copy.editTitle : copy.addTitle}
        close={true}
        onPress={handleCancel}
      />
      <View style={styles.modalContainer}>
        <ScrollView
          style={styles.modalScrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.modalFormContainer}>
            {/* Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                {copy.nameLabel}
                <Text style={{ color: COLORS.error.active }}>*</Text>
              </Text>
              <AutoCompleteInput
                name={autoCompleteName}
                value={keyResourceForm.name}
                providerType={providerType}
                placeholder={copy.placeholder}
                onSelect={(item) => {
                  setKeyResourceForm((prev) => ({ ...prev, name: item }));
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                onChangeText={(text) => {
                  setKeyResourceForm((prev) => ({ ...prev, name: text }));
                  if (errors.name && text.trim()) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
              />
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>
            {/* Imported? */}
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                {copy.importQuestion}
                <Text style={{ color: COLORS.error.active }}>*</Text>
              </Text>
              <View style={styles.radioContainer}>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.radioOption}
                  onPress={() => setImported(true)}>
                  <View
                    style={[
                      styles.radioButton,
                      keyResourceForm.isImported === true && styles.radioButtonSelected
                    ]}>
                    {keyResourceForm.isImported === true && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.radioLabel}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.radioOption}
                  onPress={() => setImported(false)}>
                  <View
                    style={[
                      styles.radioButton,
                      keyResourceForm.isImported === false && styles.radioButtonSelected
                    ]}>
                    {keyResourceForm.isImported === false && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.radioLabel}>No</Text>
                </TouchableOpacity>
              </View>
              {errors.isImported && <Text style={styles.errorText}>{errors.isImported}</Text>}
            </View>
            {/* Source Country (conditional) */}
            {keyResourceForm.isImported === true && (
              <View style={styles.inputContainer}>
                <Text style={styles.fieldLabel}>
                  Source Country
                  <Text style={{ color: COLORS.error.active }}>*</Text>
                </Text>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.countrySelector}
                  onPress={() => countrySheetRef.current?.open()}>
                  <Text
                    style={[
                      styles.countryText,
                      !keyResourceForm.country && styles.placeholderText
                    ]}>
                    {keyResourceForm.country || 'Select Country'}
                  </Text>
                  <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
                </TouchableOpacity>
                {errors.country && <Text style={styles.errorText}>{errors.country}</Text>}
              </View>
            )}
            {/* Import Percentage (conditional) */}
            {keyResourceForm.isImported === true && (
              <View style={styles.inputContainer}>
                <Text style={styles.fieldLabel}>
                  Overseas Sourcing (%)
                  <Text style={{ color: COLORS.error.active }}>*</Text>
                </Text>
                <View style={styles.percentageWrapper}>
                  <AppInput
                    placeholderText="Enter Percentage"
                    value={keyResourceForm.percentage}
                    keyboardType="numeric"
                    cap="none"
                    addressInputStyle={{ paddingRight: Responsive.width(36) }}
                    onChange={(text) => {
                      const next = sanitizePercentInput(text);
                      if (next === null) {
                        return;
                      }
                      setKeyResourceForm((prev) => ({ ...prev, percentage: next }));
                      if (errors.percentage && next) {
                        setErrors((prev) => ({ ...prev, percentage: undefined }));
                      }
                    }}
                  />
                  <View style={styles.percentageSuffix} pointerEvents="none">
                    <Text style={styles.percentageSymbol}>%</Text>
                  </View>
                </View>
                {errors.percentage && <Text style={styles.errorText}>{errors.percentage}</Text>}
              </View>
            )}
          </View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <AppButton
            title={selectedValue ? 'Save' : 'Add'}
            variant="primary"
            size="large"
            onPress={addResourceHandler}
          />
        </View>
        <DestinationCountriesBottomSheet
          ref={countrySheetRef}
          onSelect={handleCountrySelection}
          selectedCountries={keyResourceForm.country ? [keyResourceForm.country] : []}
          multipleSelection={false}
          title="Select Country"
          excludeIndia
        />
      </View>
    </AppModal>
  );
};

const styles = {
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background.primary
  },
  modalScrollContainer: {
    flex: 1
  },
  modalFormContainer: {
    paddingHorizontal: Responsive.width(16),
    paddingTop: Responsive.height(16)
  },
  inputContainer: {
    marginBottom: Responsive.height(20)
  },
  fieldLabel: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    marginBottom: 4
  },
  errorText: {
    color: COLORS.error.active
  },
  radioContainer: {
    flexDirection: 'row',
    gap: Responsive.width(24),
    marginTop: Responsive.height(4)
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Responsive.width(8)
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
    paddingHorizontal: Responsive.width(12),
    paddingVertical: Responsive.height(12),
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: Responsive.width(8),
    backgroundColor: COLORS.background.primary,
    minHeight: 45
  },
  countryText: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    flex: 1
  },
  placeholderText: {
    color: COLORS.text.placeholder
  },
  dropdownIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.text.accent
  },
  percentageWrapper: {
    position: 'relative',
    justifyContent: 'center'
  },
  percentageSuffix: {
    position: 'absolute',
    right: Responsive.width(18),
    top: 0,
    bottom: 0,
    justifyContent: 'center'
  },
  percentageSymbol: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.tertiary
  },
  modalFooter: {
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16),
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary
  }
};

export default AddKeyResource;
