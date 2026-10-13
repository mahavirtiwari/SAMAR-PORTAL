import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
import AppInput from '../../../../components/base/textInput/AppInput';
import { Header } from '../../../../components/layout';
import { AppModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import { setCustomersData } from '../../../../redux/slices/basicInformationSlice';
import { Logger } from '../../../../utils';
import DestinationCountriesBottomSheet from './DestinationCountriesBottomSheet';

const AddCustomer = ({ isVisible, onClose, onSelect, selectedValue, existingCustomers }) => {
  const dispatch = useDispatch();

  const _navigation = useNavigation();
  // Refs for bottom sheets
  const countrySheetRef = useRef(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    isInternational: null, // true for Yes, false for No
    country: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isVisible) {
      if (selectedValue) {
        setCustomerForm({
          name: selectedValue.customerName || '',
          isInternational: selectedValue.customerType === 'international' ? true : false,
          country: selectedValue.country || ''
        });
      } else {
        setCustomerForm({
          name: '',
          isInternational: null,
          country: ''
        });
      }
      setErrors({});
    }
  }, [isVisible, selectedValue]);

  const addCustomerHandler = async () => {
    let newErrors = {};
    if (!customerForm.name.trim()) {
      newErrors.name = 'Customer name is required.';
    } else {
      const isDuplicate = existingCustomers?.some(
        (c) =>
          c.customerName?.toLowerCase() === customerForm.name.trim().toLowerCase() &&
          (!selectedValue || c.id !== selectedValue.id)
      );
      if (isDuplicate) {
        newErrors.name = 'Customer already exists';
      }
    }
    if (customerForm.isInternational === null) {
      newErrors.isInternational = 'Please select international or domestic.';
    }
    if (customerForm.isInternational === true && !customerForm.country) {
      newErrors.country = 'Country is required.';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    const val = {
      customerName: customerForm.name.trim(),
      customerType: customerForm.isInternational === true ? 'international' : 'domestic',
      country: customerForm.isInternational === true ? customerForm.country : null
    };

    Logger.info('Adding customer with values:', val);
    dispatch(setCustomersData([val])); // Update Redux store
    onSelect(val); // Pass data back to parent
    setCustomerForm({ name: '', isInternational: null, country: '' });
    setErrors({});
    onClose(); // Close modal
  };

  const handleCountrySelection = (countries) => {
    if (countries.length > 0) {
      setCustomerForm((prev) => ({ ...prev, country: countries[0] }));
      if (errors.country && countries[0]) {
        setErrors((prev) => ({ ...prev, country: undefined }));
      }
    }
  };

  const openCountrySelector = () => {
    countrySheetRef.current?.open();
  };

  return (
    <AppModal visible={isVisible}>
      <Header title={'Add Customer'} close={true} onPress={onClose} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.formContainer}>
            {/* Customer Name */}
            <View style={styles.inputContainer}>
              <AppInput
                maxLength={150}
                label={
                  <Text>
                    Name of the Customer<Text style={{ color: COLORS.error.active }}>*</Text>
                  </Text>
                }
                placeholderText="Enter Name of the Customer"
                value={customerForm.name}
                onChange={(text) => {
                  setCustomerForm((prev) => ({ ...prev, name: text }));
                  if (errors.name && text.trim()) {
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
            {/* International or Domestic Question */}
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Is the customer international or domestic?
                <Text style={{ color: COLORS.error.active }}>*</Text>
              </Text>
              <View style={styles.radioContainer}>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.radioOption}
                  onPress={() => {
                    setCustomerForm((prev) => ({ ...prev, isInternational: false }));
                    if (errors.isInternational) {
                      setErrors((prev) => ({ ...prev, isInternational: undefined }));
                    }
                  }}>
                  <View
                    style={[
                      styles.radioButton,
                      customerForm.isInternational === false && styles.radioButtonSelected
                    ]}>
                    {customerForm.isInternational === false && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.radioLabel}>Domestic</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioOption}
                  activeOpacity={0.6}
                  onPress={() => {
                    setCustomerForm((prev) => ({ ...prev, isInternational: true }));
                    if (errors.isInternational) {
                      setErrors((prev) => ({ ...prev, isInternational: undefined }));
                    }
                  }}>
                  <View
                    style={[
                      styles.radioButton,
                      customerForm.isInternational === true && styles.radioButtonSelected
                    ]}>
                    {customerForm.isInternational === true && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.radioLabel}>International</Text>
                </TouchableOpacity>
              </View>
              {errors.isInternational && (
                <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                  {errors.isInternational}
                </Text>
              )}
            </View>
            {/* Country (conditional) */}
            {customerForm.isInternational === true && (
              <View style={styles.inputContainer}>
                <Text style={styles.fieldLabel}>
                  Country<Text style={{ color: COLORS.error.active }}>*</Text>
                </Text>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.countrySelector}
                  onPress={openCountrySelector}>
                  <Text
                    style={[styles.countryText, !customerForm.country && styles.placeholderText]}>
                    {customerForm.country || 'Select Country'}
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
          </View>
        </ScrollView>
        {/* Footer */}
        <View style={styles.footer}>
          <AppButton
            title="Add"
            variant="primary"
            size="large"
            onPress={() => addCustomerHandler()}
          />
        </View>
        {/* Country Selection Bottom Sheet */}
        <DestinationCountriesBottomSheet
          ref={countrySheetRef}
          onSelect={handleCountrySelection}
          selectedCountries={customerForm.country ? [customerForm.country] : []}
          multipleSelection={false}
          title="Select Country"
          excludeIndia
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Responsive.height(60),
    paddingBottom: Responsive.height(16),
    paddingHorizontal: Responsive.width(16),
    backgroundColor: COLORS.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light
  },
  closeIcon: {
    width: Responsive.width(24),
    height: Responsive.height(24),
    tintColor: COLORS.text.primary
  },
  headerTitle: {
    fontSize: FONT_SIZE.fs18,
    fontWeight: '600',
    color: COLORS.text.primary
  },
  placeholder: {
    width: Responsive.width(24)
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
    gap: 24
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
    tintColor: COLORS.text.tertiary
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

export default AddCustomer;
