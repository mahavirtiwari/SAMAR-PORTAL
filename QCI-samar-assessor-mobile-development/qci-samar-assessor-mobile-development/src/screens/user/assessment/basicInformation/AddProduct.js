import { useEffect, useRef, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../../../assets/theme/Theme';
// Import the sub-modals
import { AppButton } from '../../../../components';
import AppInput from '../../../../components/base/textInput/AppInput';
import { Header } from '../../../../components/layout';
import { AppModal } from '../../../../components/modals';
import AppScrollView from '../../../../components/shared/AppScrollView';
import Icons from '../../../../constants/Icons';
import { Logger, sanitizePercentInput } from '../../../../utils';
import DatePickerModal from './DatePickerModal';
import SelectCapacityUnitModal from './SelectCapacityUnitModal';
import SelectDestinationCountriesBottomSheet from './SelectDestinationCountriesModal';
import SelectPercentageBottomSheet from './SelectPercentageModal';

// Helper function to parse Indian formatted numbers (e.g., 10,00,000 -> 1000000)
const parseIndianNumber = (value) => {
  if (!value) {
    return null;
  }
  // Remove all commas and parse as float
  const cleanValue = value.toString().replace(/,/g, '');
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? null : parsed;
};

// Keep only digits and a single decimal point, capped at 2 decimal places.
// Commas are display-only (added by formatIndianNumber), so strip them here.
const sanitizeCapacityInput = (text) => {
  const cleaned = (text || '').replace(/,/g, '').replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) {
    return cleaned;
  }
  const intPart = cleaned.slice(0, firstDot);
  const decPart = cleaned
    .slice(firstDot + 1)
    .replace(/\./g, '')
    .slice(0, 2);
  return `${intPart}.${decPart}`;
};

// Format with Indian commas (e.g., 1000000 -> 10,00,000). Grouping applies to
// the integer part only; up to 2 decimal places are preserved as typed.
const formatIndianNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const raw = value.toString().replace(/,/g, '');
  if (raw === '') {
    return '';
  }
  const hasDot = raw.includes('.');
  const [intRaw, ...decRest] = raw.split('.');
  const decRaw = decRest.join('').slice(0, 2);

  // Indian format on the integer part: 3 digits first, then 2 digits each
  let grouped = '';
  if (intRaw.length > 0) {
    const parts = [];
    let reversed = intRaw.split('').reverse().join('');
    parts.push(reversed.substring(0, 3));
    reversed = reversed.substring(3);
    while (reversed.length > 0) {
      parts.push(reversed.substring(0, 2));
      reversed = reversed.substring(2);
    }
    grouped = parts.join(',').split('').reverse().join('');
  }

  return hasDot ? `${grouped}.${decRaw}` : grouped;
};

// Both unit dropdowns show a placeholder until a real unit is picked: 'Select' on a
// fresh form, '--' when an existing product was stored without a unit. Neither is a
// valid unit, so both must fail validation.
const UNIT_PLACEHOLDERS = ['Select', '--'];
const isUnitUnset = (unit) => !unit || UNIT_PLACEHOLDERS.includes(unit);

const EMPTY_PRODUCT_FORM = {
  name: '',
  totalCapacity: '',
  totalCapacityUnit: 'Select',
  currentCapacity: '',
  currentCapacityUnit: 'Select',
  commencementDate: '',
  isExported: null,
  destinationCountries: [],
  exportPercentage: ''
};

const AddProduct = ({ isVisible, onClose, onSelect, selectedValue, existingProducts }) => {
  const destinationCountriesBottomSheetRef = useRef(null);
  const percentageBottomSheetRef = useRef(null);
  const [capacityUnitModalVisible, setCapacityUnitModalVisible] = useState(false);
  const [datePickerModalVisible, setDatePickerModalVisible] = useState(false);

  const { countriesList } = useSelector((state) => state.basicInformation);

  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);

  const [currentUnitField, setCurrentUnitField] = useState(''); // 'total' or 'current'

  const handleCancel = () => {
    setProductForm(EMPTY_PRODUCT_FORM);
    onClose();
  };

  // Repopulate every time the modal OPENS — not only when selectedValue changes.
  // handleCancel clears the form, so reopening the same product (same
  // selectedValue reference) would otherwise leave the form empty and wrongly
  // fire "Destination countries are required" for a product that already has them.
  useEffect(() => {
    if (!isVisible) {
      return;
    }
    if (selectedValue) {
      setProductForm({
        name: selectedValue.productName || '',
        totalCapacity: selectedValue.totalProductionCapacity
          ? selectedValue.totalProductionCapacity.toString()
          : '',
        totalCapacityUnit: selectedValue.capacityUnit || '--',
        currentCapacity: selectedValue.currentUtilizedCapacity
          ? selectedValue.currentUtilizedCapacity.toString()
          : '',
        currentCapacityUnit: selectedValue.capacityUnitUtilized || '--',
        commencementDate: selectedValue.commencementDate || '',
        isExported: selectedValue.isExported || false,
        destinationCountries: selectedValue.exportCountries
          ? selectedValue.exportCountries.map((name) => ({ name }))
          : [],
        exportPercentage: selectedValue.exportPercentage
          ? selectedValue.exportPercentage.toString()
          : ''
      });
    } else {
      setProductForm(EMPTY_PRODUCT_FORM);
    }
    // Clear any stale validation from a previous open.
    setErrors({});
    setCapacityError('');
    setPercentageError('');
  }, [isVisible, selectedValue]);

  const { assessmentData } = useSelector((state) => state.assessment);

  const [errors, setErrors] = useState({});
  const [capacityError, setCapacityError] = useState('');
  const [percentageError, setPercentageError] = useState('');

  const addProductHandler = async () => {
    let newErrors = {};
    // Required fields validation
    if (!productForm.name.trim()) {
      newErrors.name = 'Product name is required.';
    } else {
      const isDuplicate = existingProducts?.some(
        (p) =>
          p.productName?.toLowerCase() === productForm.name.trim().toLowerCase() &&
          (!selectedValue || p.id !== selectedValue.id)
      );
      if (isDuplicate) {
        newErrors.name = 'Product already exists';
      }
    }
    if (!productForm.totalCapacity) {
      newErrors.totalCapacity = 'Total production capacity is required.';
    }
    if (isUnitUnset(productForm.totalCapacityUnit)) {
      newErrors.totalCapacityUnit = 'Select total capacity unit.';
    }
    if (!productForm.currentCapacity) {
      newErrors.currentCapacity = 'Current utilized capacity is required.';
    }
    if (isUnitUnset(productForm.currentCapacityUnit)) {
      newErrors.currentCapacityUnit = 'Select current utilized capacity unit.';
    }
    if (!productForm.commencementDate) {
      newErrors.commencementDate = 'Date of commencement is required.';
    }
    if (productForm.isExported === null) {
      newErrors.isExported = 'Please specify if the product is exported.';
    }

    if (productForm.isExported === true) {
      if (!productForm.destinationCountries || productForm.destinationCountries.length === 0) {
        newErrors.destinationCountries = 'Destination countries are required.';
      }
      if (!productForm.exportPercentage) {
        newErrors.exportPercentage = 'Export percentage is required.';
      } else if (parseFloat(productForm.exportPercentage) > 100) {
        setPercentageError('Export percentage cannot be more than 100.');
        return;
      } else {
        setPercentageError('');
      }
    }

    setErrors(newErrors);
    // Prevent submission if there are validation errors or capacity/percentage error
    if (Object.keys(newErrors).length > 0 || capacityError || percentageError) {
      return;
    }

    const totalCapacity = parseIndianNumber(productForm.totalCapacity);
    const currentCapacity = parseIndianNumber(productForm.currentCapacity);

    const val = {
      productName: productForm.name.trim(),
      isExported: productForm.isExported || false,
      exportCountries: productForm.isExported
        ? productForm.destinationCountries.map((item) => item?.name)
        : [],
      exportPercentage:
        productForm.isExported && productForm.exportPercentage
          ? parseFloat(productForm.exportPercentage)
          : null,
      totalProductionCapacity: totalCapacity,
      capacityUnit: productForm.totalCapacityUnit,
      currentUtilizedCapacity: currentCapacity,
      capacityUnitUtilized: productForm.currentCapacityUnit,
      commencementDate: productForm.commencementDate || null
    };
    Logger.info('Adding product with values:', val);
    onSelect(val);
    handleCancel(); // Close modal
  };

  const handleUnitSelection = (unit) => {
    // Set the same unit for both total and current capacity automatically
    setProductForm((prev) => ({
      ...prev,
      totalCapacityUnit: unit,
      currentCapacityUnit: unit
    }));
    // Clear unit errors if they exist
    if (errors.totalCapacityUnit || errors.currentCapacityUnit) {
      setErrors((prev) => ({
        ...prev,
        totalCapacityUnit: undefined,
        currentCapacityUnit: undefined
      }));
    }
    setCapacityUnitModalVisible(false);
  };

  const handlePercentageSelection = (percentage) => {
    setProductForm((prev) => ({ ...prev, exportPercentage: percentage }));
  };

  const handleDestinationCountriesSelection = (countries) => {
    Logger.info('Selected destination countries:', countries);
    setProductForm((prev) => ({ ...prev, destinationCountries: countries }));
    if (errors.destinationCountries && countries && countries.length > 0) {
      setErrors((prev) => ({ ...prev, destinationCountries: undefined }));
    }
  };

  const handleDateSelection = (dateString) => {
    setProductForm((prev) => ({ ...prev, commencementDate: dateString }));
    if (errors.commencementDate) {
      setErrors((prev) => ({ ...prev, commencementDate: undefined }));
    }
    setDatePickerModalVisible(false);
  };

  const openCapacityUnitModal = (field) => {
    setCurrentUnitField(field);
    setCapacityUnitModalVisible(true);
  };

  const openDestinationCountriesModal = () => {
    destinationCountriesBottomSheetRef.current?.open();
  };

  const formatDestinationCountries = () => {
    if (productForm.destinationCountries.length === 0) {
      return 'Select Destination Countries';
    }
    return `${productForm.destinationCountries.length} countries selected`;
  };

  const formatCommencementDate = () => {
    if (!productForm.commencementDate) {
      return '';
    }
    const date = new Date(productForm.commencementDate);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  return (
    <AppModal visible={isVisible}>
      <Header title={'Add Product'} onPress={handleCancel} close={true} />
      <View style={styles.container}>
        {/* Form Content */}
        <AppScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.formContainer}>
            {/* Product Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Name of Product
                <Text style={{ color: COLORS.error.active }}>*</Text>
              </Text>
              <AppInput
                maxLength={150}
                label={undefined}
                placeholderText="Enter Name"
                value={productForm.name}
                onChange={(text) => {
                  setProductForm((prev) => ({ ...prev, name: text }));
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
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Is the product being exported?
                <Text style={{ color: COLORS.error.active }}>*</Text>
              </Text>
              <View style={styles.radioContainer}>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.radioOption}
                  onPress={() => {
                    setProductForm((prev) => ({ ...prev, isExported: true }));
                    if (errors.isExported) {
                      setErrors((prev) => ({ ...prev, isExported: undefined }));
                    }
                  }}>
                  <View
                    style={[
                      styles.radioButton,
                      productForm.isExported === true && styles.radioButtonSelected
                    ]}>
                    {productForm.isExported === true && <View style={styles.radioButtonInner} />}
                  </View>
                  <Text style={styles.radioLabel}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.radioOption}
                  onPress={() => {
                    setProductForm((prev) => ({ ...prev, isExported: false }));
                    if (errors.isExported) {
                      setErrors((prev) => ({ ...prev, isExported: undefined }));
                    }
                  }}>
                  <View
                    style={[
                      styles.radioButton,
                      productForm.isExported === false && styles.radioButtonSelected
                    ]}>
                    {productForm.isExported === false && <View style={styles.radioButtonInner} />}
                  </View>
                  <Text style={styles.radioLabel}>No</Text>
                </TouchableOpacity>
              </View>
              {errors.isExported && (
                <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                  {errors.isExported}
                </Text>
              )}
            </View>
            {productForm.isExported === true && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.fieldLabel}>
                    Destination Countries
                    <Text style={{ color: COLORS.error.active }}>*</Text>
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    style={styles.modalTriggerField}
                    onPress={openDestinationCountriesModal}>
                    <Text
                      style={[
                        styles.modalTriggerText,
                        productForm.destinationCountries.length === 0 && styles.placeholderText
                      ]}>
                      {formatDestinationCountries()}
                    </Text>
                    <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
                  </TouchableOpacity>
                  {errors.destinationCountries && (
                    <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                      {errors.destinationCountries}
                    </Text>
                  )}
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.fieldLabel}>
                    Percentage (%) of export of the product
                    <Text style={{ color: COLORS.error.active }}>*</Text>
                  </Text>
                  <AppInput
                    label={undefined}
                    placeholderText={'Enter Percentage'}
                    value={productForm.exportPercentage}
                    onChange={(text) => {
                      const sanitized = sanitizePercentInput(text);
                      if (sanitized === null) {
                        return;
                      }
                      setPercentageError('');
                      setProductForm((prev) => ({ ...prev, exportPercentage: sanitized }));
                      if (errors.exportPercentage && sanitized) {
                        setErrors((prev) => ({ ...prev, exportPercentage: undefined }));
                      }
                    }}
                    keyboardType="numeric"
                    cap="none"
                    rightComponent={<Text style={styles.percentageSymbol}>%</Text>}
                  />
                  {errors.exportPercentage && (
                    <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                      {errors.exportPercentage}
                    </Text>
                  )}
                  {percentageError ? (
                    <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                      {percentageError}
                    </Text>
                  ) : null}
                </View>
              </>
            )}
            {/* Total Capacity */}
            <View style={styles.inputContainer}>
              <View style={styles.capacityRow}>
                <View style={styles.capacityInput}>
                  <Text style={styles.fieldLabel}>
                    Total production capacity per year
                    <Text style={{ color: COLORS.error.active }}>*</Text>
                  </Text>
                  <AppInput
                    label={undefined}
                    placeholderText="Enter capacity"
                    maxLength={15}
                    value={formatIndianNumber(productForm.totalCapacity)}
                    onChange={(text) => {
                      const cleanValue = sanitizeCapacityInput(text);
                      setProductForm((prev) => ({ ...prev, totalCapacity: cleanValue }));
                      if (errors.totalCapacity && cleanValue) {
                        setErrors((prev) => ({ ...prev, totalCapacity: undefined }));
                      }
                      const total = parseIndianNumber(cleanValue);
                      const current = parseIndianNumber(productForm.currentCapacity);
                      if (total !== null && current !== null) {
                        if (current > total) {
                          setCapacityError('Current capacity cannot exceed total capacity.');
                        } else {
                          setCapacityError('');
                        }
                      } else {
                        setCapacityError('');
                      }
                    }}
                    keyboardType="numeric"
                  />
                </View>
                <TouchableOpacity
                  style={styles.unitSelector}
                  activeOpacity={0.6}
                  onPress={() => openCapacityUnitModal('total')}>
                  <Text
                    style={[
                      styles.unitText,
                      {
                        color:
                          productForm.totalCapacityUnit === 'Select'
                            ? COLORS.text.placeholder
                            : COLORS.text.primary
                      }
                    ]}>
                    {productForm.totalCapacityUnit}
                  </Text>
                  <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
                </TouchableOpacity>
              </View>
              {errors.totalCapacity && (
                <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                  {errors.totalCapacity}
                </Text>
              )}
              {errors.totalCapacityUnit && (
                <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                  {errors.totalCapacityUnit}
                </Text>
              )}
            </View>
            {/* Current Capacity */}
            <View style={styles.inputContainer}>
              <View style={styles.capacityRow}>
                <View style={styles.capacityInput}>
                  <Text style={styles.fieldLabel}>
                    Current utilized capacity per year
                    <Text style={{ color: COLORS.error.active }}>*</Text>
                  </Text>
                  <AppInput
                    label={undefined}
                    placeholderText="Enter capacity"
                    maxLength={15}
                    value={formatIndianNumber(productForm.currentCapacity)}
                    onChange={(text) => {
                      const cleanValue = sanitizeCapacityInput(text);
                      setProductForm((prev) => ({ ...prev, currentCapacity: cleanValue }));
                      if (errors.currentCapacity && cleanValue) {
                        setErrors((prev) => ({ ...prev, currentCapacity: undefined }));
                      }
                      const total = parseIndianNumber(productForm.totalCapacity);
                      const current = parseIndianNumber(cleanValue);
                      if (total !== null && current !== null) {
                        if (current > total) {
                          setCapacityError('Current capacity cannot exceed total capacity.');
                        } else {
                          setCapacityError('');
                        }
                      } else {
                        setCapacityError('');
                      }
                    }}
                    keyboardType="numeric"
                  />
                </View>
                <TouchableOpacity
                  style={styles.unitSelector}
                  activeOpacity={0.6}
                  onPress={() => openCapacityUnitModal('current')}>
                  <Text
                    style={[
                      styles.unitText,
                      {
                        color:
                          productForm.currentCapacityUnit === 'Select'
                            ? COLORS.text.placeholder
                            : COLORS.text.primary
                      }
                    ]}>
                    {productForm.currentCapacityUnit}
                  </Text>
                  <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
                </TouchableOpacity>
              </View>
              {errors.currentCapacity && (
                <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                  {errors.currentCapacity}
                </Text>
              )}
              {errors.currentCapacityUnit && (
                <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                  {errors.currentCapacityUnit}
                </Text>
              )}
              {capacityError ? (
                <Text style={{ color: COLORS.error.active, marginTop: 4, fontSize: 12 }}>
                  {capacityError}
                </Text>
              ) : null}
            </View>
            {/* Date of Commencement */}
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Date of Commencement
                <Text style={{ color: COLORS.error.active }}>*</Text>
              </Text>
              <TouchableOpacity
                activeOpacity={0.6}
                style={styles.modalTriggerField}
                onPress={() => setDatePickerModalVisible(true)}>
                <Text
                  style={[
                    styles.modalTriggerText,
                    !productForm.commencementDate && styles.placeholderText
                  ]}>
                  {productForm.commencementDate ? formatCommencementDate() : 'Select Date'}
                </Text>
                <Image source={Icons.calenderGrey} style={[commonStyles.iconSize24]} />
              </TouchableOpacity>
              {errors.commencementDate && (
                <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                  {errors.commencementDate}
                </Text>
              )}
            </View>
            {/* Export Question */}

            {/* Export Details (conditional) */}
          </View>
          <View style={styles.footer}>
            <AppButton
              title={'Add'}
              size="large"
              variant="primary"
              onPress={() => addProductHandler()}
            />
          </View>
        </AppScrollView>
        {/* Sub-modals */}
        <SelectCapacityUnitModal
          visible={capacityUnitModalVisible}
          onClose={() => setCapacityUnitModalVisible(false)}
          onSelect={handleUnitSelection}
          selectedUnit={
            currentUnitField === 'total'
              ? productForm.totalCapacityUnit
              : productForm.currentCapacityUnit
          }
        />
        <SelectPercentageBottomSheet
          ref={percentageBottomSheetRef}
          onSelect={handlePercentageSelection}
          selectedPercentage={productForm.exportPercentage}
        />
        <SelectDestinationCountriesBottomSheet
          ref={destinationCountriesBottomSheetRef}
          onSelect={handleDestinationCountriesSelection}
          selectedCountries={productForm.destinationCountries}
          countries={countriesList}
          excludeIndia
        />
        <DatePickerModal
          minDate={assessmentData?.assessment?.application?.unit?.commencementDate}
          maxDate={new Date().toISOString().slice(0, 10)}
          visible={datePickerModalVisible}
          onClose={() => setDatePickerModalVisible(false)}
          onSelect={handleDateSelection}
          selectedDate={productForm.commencementDate}
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
    marginBottom: Responsive.height(20)
  },
  fieldLabel: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    marginBottom: 4
  },
  capacityRow: {
    flexDirection: 'row',
    gap: Responsive.width(8),
    alignItems: 'flex-end'
  },
  capacityInput: {
    flex: 1
  },
  unitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(12),
    borderWidth: 1,
    borderColor: '#EBEDF3',
    borderRadius: Responsive.width(10),
    backgroundColor: COLORS.background.primary,
    minWidth: Responsive.width(100),
    height: 45
  },
  unitText: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary
  },
  dropdownIcon: {
    width: Responsive.width(16),
    height: Responsive.height(16),
    tintColor: COLORS.text.accent
  },
  dateSelector: {
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
  dateText: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary
  },
  placeholderText: {
    color: COLORS.text.tertiary
  },
  calendarIcon: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    tintColor: COLORS.text.tertiary
  },
  radioContainer: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 8
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
  destinationSelector: {
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
  destinationText: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    flex: 1
  },
  modalTriggerField: {
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
  modalTriggerText: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    flex: 1
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  percentageSymbol: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.tertiary,
    marginLeft: Responsive.width(8)
  },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16),
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light
  },
  button: {
    paddingVertical: Responsive.height(12),
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

export default AddProduct;
