import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
import AppInput from '../../../../components/base/textInput/AppInput';
import AutoCompleteInput from '../../../../components/base/textInput/AutoCompleteInput';
import { Header } from '../../../../components/layout';
import { AppCommonModal, AppModal } from '../../../../components/modals';
import { AppBottomSheet } from '../../../../components/shared';
import AppScrollView from '../../../../components/shared/AppScrollView';
import Icons from '../../../../constants/Icons';
import {
  getAssessmentByIdAction,
  getStepProgressAction
} from '../../../../redux/action/assessmentAction';
import {
  addBasicInformationAction,
  getBasicInformationAction,
  getCountriesAction,
  getServiceCategoryAction,
  getVendorLabsAction
} from '../../../../redux/action/basicInformationAction';
import {
  resetAddBasicInformationState,
  resetData
} from '../../../../redux/slices/basicInformationSlice';
import { Logger, sanitizePercentInput } from '../../../../utils';
import { useApplicationLoader } from '../../../../utils/useApplicationLoader';
import AddCustomer from './AddCustomer';
import AddKeyResource from './AddKeyResource';
import CategorySelectionModal from './CategorySelectionModal';
import DatePickerModal from './DatePickerModal';
import SelectDestinationCountriesBottomSheet from './SelectDestinationCountriesModal';
import StoreSelectionModal from './StoreSelectionModal';

// Type of service provider. The category / labs / key-process / key-resource
// master lists are all scoped to one of these, so the selection gates and
// filters everything below it (mirrors the web service application form).
const PROVIDER_TYPES = [
  { id: 'annual_maintenance_contract', label: 'Annual Maintenance Contract (AMC)' },
  { id: 'critical_service_provider', label: 'Critical Service Provider' },
  { id: 'civil_works_contractor', label: 'Civil Works Contractors' }
];

const parseIndianNumber = (value) => {
  if (!value) {
    return null;
  }
  const cleanValue = String(value).replace(/,/g, '');
  const parsed = parseFloat(cleanValue);
  return Number.isNaN(parsed) ? null : parsed;
};

// Sanitize a capacity entry: digits, one decimal point, max 2 decimal digits.
// Returns null when the input should be rejected (so onChange can ignore it).
const sanitizeCapacity = (text) => {
  let sanitized = String(text)
    .replace(/,/g, '')
    .replace(/[^0-9.]/g, '');
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    sanitized = `${parts[0]}.${parts.slice(1).join('')}`;
  }
  const decimalPart = sanitized.split('.')[1];
  if (decimalPart !== undefined && decimalPart.length > 2) {
    return null;
  }
  return sanitized;
};

const formatIndianNumber = (value) => {
  if (value == null || value === '') {
    return '';
  }
  const num = String(value).replace(/,/g, '');
  if (!num) {
    return '';
  }

  // Keep the decimal portion untouched; only group the integer part.
  const [integerPart, ...decimalParts] = num.split('.');
  const decimalPart = decimalParts.join('');

  const parts = [];
  let reversed = integerPart.split('').reverse().join('');
  if (reversed.length > 0) {
    parts.push(reversed.substring(0, 3));
    reversed = reversed.substring(3);
  }
  while (reversed.length > 0) {
    parts.push(reversed.substring(0, 2));
    reversed = reversed.substring(2);
  }
  const groupedInteger = parts.join(',').split('').reverse().join('');
  // Preserve a trailing dot while the user is mid-typing (e.g. "12.").
  if (num.includes('.')) {
    return `${groupedInteger}.${decimalPart}`;
  }
  return groupedInteger;
};

const AddServiceBasicInformation = ({ route }) => {
  const scrollViewRef = useRef(null);
  const keyProcessInputRef = useRef(null);
  const certificationInputRef = useRef(null);
  const destinationCountriesBottomSheetRef = useRef(null);
  const navigation = useNavigation();
  const dispatch = useDispatch();
  // readOnly is the post-punch-out review pass. As on the manufacturing form,
  // the whole body is made non-interactive rather than gating each of its many
  // add / edit / delete controls; the wrapper sits inside the scroll view so
  // scrolling still works, and only the Save action is removed outright.
  const { assessmentId, readOnly = false } = route?.params || {};

  const providerTypeBottomSheetRef = useRef(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [labModalVisible, setLabModalVisible] = useState(false);
  const [addCustomerModalVisible, setAddCustomerModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [keyResourceModalVisible, setKeyResourceModalVisible] = useState(false);
  const [editingKeyResource, setEditingKeyResource] = useState(null);
  const [outsourcedComponentModalVisible, setOutsourcedComponentModalVisible] = useState(false);
  const [editingOutsourcedComponent, setEditingOutsourcedComponent] = useState(null);
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [datePickerModalVisible, setDatePickerModalVisible] = useState(false);
  const [_autoCompleteDropdownOpen, setAutoCompleteDropdownOpen] = useState(false);

  // Form state
  const [providerType, setProviderType] = useState('');
  const [formData, setFormData] = useState({ category: null, labs: [] });
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [keyProcesses, setKeyProcesses] = useState([]);
  const [outsourcedProcesses, setOutsourcedProcesses] = useState([]);
  const [keyResources, setKeyResources] = useState([]);
  const [outsourcedComponents, setOutsourcedComponents] = useState([]);
  const [certifications, setCertifications] = useState([]);

  const [serviceForm, setServiceForm] = useState({
    serviceName: '',
    isExported: null,
    destinationCountries: [],
    exportPercentage: '',
    totalCapacity: '',
    totalCapacityUnit: 'Number',
    currentCapacity: '',
    currentCapacityUnit: 'Number',
    commencementDate: ''
  });
  const [serviceErrors, setServiceErrors] = useState({});
  const [servicePercentageError, setServicePercentageError] = useState('');
  const [serviceCapacityError, setServiceCapacityError] = useState('');
  const [keyProcessInput, setKeyProcessInput] = useState('');
  const [certificationInput, setCertificationInput] = useState('');

  const [formErrors, setFormErrors] = useState({});
  const [successModal, setSuccessModal] = useState(false);

  useEffect(() => {
    dispatch(resetData());
    dispatch(getBasicInformationAction(assessmentId));
    dispatch(getServiceCategoryAction());
    dispatch(getVendorLabsAction());
    dispatch(getCountriesAction());
  }, []);

  const {
    basicInformation,
    basicInformationLoading,
    addBasicInformationLoading,
    addBasicInformationData,
    getServiceCategoryData,
    getVendorLabsData,
    countriesList
  } = useSelector((state) => state.basicInformation);

  // Prefill from any previously-saved service basic information.
  useEffect(() => {
    const info = basicInformation?.basicInformation;
    if (!info) {
      return;
    }
    setProviderType(info.svcProviderType || '');
    setFormData({
      category: info.category ? { categoryName: info.category } : null,
      labs:
        info.svcDrdoVendorLabs?.map((item, index) => ({
          id: index + 1,
          storeName: item?.storeName || item?.labName
        })) || []
    });
    setServices(
      (info.svcServices || []).map((item, index) => {
        if (typeof item === 'string') {
          return { id: index + 1, serviceName: item };
        }
        return {
          id: index + 1,
          serviceName: item.serviceName || '',
          isExported: item.isExported ?? null,
          destinationCountries: (item.exportCountries || []).map((name) => ({ name })),
          exportPercentage: item.exportPercentage != null ? item.exportPercentage.toString() : '',
          totalCapacity:
            item.totalProductionCapacity != null ? item.totalProductionCapacity.toString() : '',
          totalCapacityUnit: item.capacityUnit || 'Number',
          currentCapacity:
            item.currentUtilizedCapacity != null ? item.currentUtilizedCapacity.toString() : '',
          currentCapacityUnit: item.capacityUnitUtilized || 'Number',
          commencementDate: item.commencementDate || ''
        };
      })
    );
    setCustomers(info.customers || []);
    setKeyProcesses(
      (info.svcKeyProcesses || []).map((item, index) => ({
        id: index + 1,
        name: typeof item === 'string' ? item : item.processName
      }))
    );
    setOutsourcedProcesses(
      (info.svcOutsourcedProcesses || []).map((item, index) => ({
        id: index + 1,
        name: typeof item === 'string' ? item : item.processName
      }))
    );
    setKeyResources(
      (info.svcKeyResources || []).map((item, index) => {
        if (typeof item === 'string') {
          return { id: index + 1, name: item, isImported: false };
        }
        return {
          id: index + 1,
          name: item.resourceName,
          isImported: !!item.isImported,
          importCountry: item.importCountry || null,
          importPercentage: item.importPercentage ?? null
        };
      })
    );
    setOutsourcedComponents(
      (info.svcOutsourcedComponents || []).map((item, index) => {
        if (typeof item === 'string') {
          return { id: index + 1, name: item, isImported: false };
        }
        return {
          id: index + 1,
          name: item.componentName,
          isImported: !!item.isImported,
          importCountry: item.importCountry || null,
          importPercentage: item.importPercentage ?? null
        };
      })
    );
    setCertifications(
      (info.thirdPartyCertificationNames || []).map((cert, index) => ({
        id: index + 1,
        name: typeof cert === 'string' ? cert : cert?.certificationName
      }))
    );
  }, [basicInformation]);

  useEffect(() => {
    if (addBasicInformationData) {
      setSuccessModal(true);
      dispatch(getStepProgressAction(assessmentId));
      dispatch(getAssessmentByIdAction(assessmentId));
      dispatch(resetAddBasicInformationState());
      setTimeout(() => {
        // The user may have navigated back during the 2s window — don't fire
        // state updates / a second goBack on an unmounted screen.
        if (!navigation.isFocused()) {
          return;
        }
        setSuccessModal(false);
        navigation.goBack();
      }, 2000);
    }
  }, [addBasicInformationData]);

  useApplicationLoader(
    'serviceBasicInformation',
    basicInformationLoading || addBasicInformationLoading
  );

  // Category / labs masters are scoped to the selected provider type. Items
  // missing the field pass through so a partial master never hides everything.
  const matchesProviderType = (item) =>
    !providerType || item?.serviceProviderType == null || item.serviceProviderType === providerType;
  const filteredCategories = (
    Array.isArray(getServiceCategoryData) ? getServiceCategoryData : []
  ).filter(matchesProviderType);
  // The lab picker is the shared StoreSelectionModal, which keys off storeName —
  // map the vendor-labs master (labName) onto that shape.
  const filteredLabs = (Array.isArray(getVendorLabsData) ? getVendorLabsData : [])
    .filter(matchesProviderType)
    .map((lab) => ({ id: lab.id, storeName: lab.labName || lab.storeName }));

  const clearError = (key) =>
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handleProviderTypeSelect = (typeId) => {
    if (typeId === providerType) {
      providerTypeBottomSheetRef.current?.close();
      return;
    }
    // Category and labs are strictly provider-type-bound selections; clear them
    // so a stale pick from another type can't be submitted.
    setProviderType(typeId);
    setFormData({ category: null, labs: [] });
    clearError('providerType');
    providerTypeBottomSheetRef.current?.close();
  };

  const handleCategorySelect = (category) => {
    setFormData((prev) => ({ ...prev, category }));
    if (category?.categoryName) {
      clearError('category');
    }
  };

  const handleLabSelect = (selectedLabs) => {
    setFormData((prev) => ({ ...prev, labs: selectedLabs }));
    if (selectedLabs?.length > 0) {
      clearError('labs');
    }
  };

  const handleRemoveLab = (labId) => {
    setFormData((prev) => ({ ...prev, labs: prev.labs.filter((lab) => lab.id !== labId) }));
  };

  const openServiceModal = (service = null) => {
    setEditingService(service);
    setServiceForm({
      serviceName: service?.serviceName || '',
      isExported: service?.isExported ?? null,
      destinationCountries: service?.destinationCountries || [],
      exportPercentage: service?.exportPercentage || '',
      totalCapacity: service?.totalCapacity || '',
      totalCapacityUnit: service?.totalCapacityUnit || 'Number',
      currentCapacity: service?.currentCapacity || '',
      currentCapacityUnit: service?.currentCapacityUnit || 'Number',
      commencementDate: service?.commencementDate || ''
    });
    setServiceErrors({});
    setServicePercentageError('');
    setServiceCapacityError('');
    setServiceModalVisible(true);
  };

  const handleSaveService = () => {
    const value = serviceForm.serviceName.trim();
    const errors = {};
    if (!value) {
      errors.serviceName = 'Service name is required.';
    }
    if (serviceForm.isExported === null) {
      errors.isExported = 'Please specify if the service is supplied internationally.';
    }
    if (serviceForm.isExported === true) {
      if (!serviceForm.destinationCountries || serviceForm.destinationCountries.length === 0) {
        errors.destinationCountries = 'Destination countries are required.';
      }
      if (!serviceForm.exportPercentage) {
        errors.exportPercentage = 'Percentage is required.';
      } else if (parseFloat(serviceForm.exportPercentage) > 100) {
        setServicePercentageError('Percentage cannot be more than 100.');
      }
    }
    if (!serviceForm.totalCapacity) {
      errors.totalCapacity = 'Total capacity is required.';
    }
    if (!serviceForm.currentCapacity) {
      errors.currentCapacity = 'Current capacity is required.';
    }
    if (!serviceForm.commencementDate) {
      errors.commencementDate = 'Date of commencement is required.';
    }
    const total = parseIndianNumber(serviceForm.totalCapacity);
    const current = parseIndianNumber(serviceForm.currentCapacity);
    if (total != null && current != null && current > total) {
      errors.currentCapacity = 'Current capacity cannot exceed total capacity.';
    }
    if (Object.keys(errors).length > 0 || servicePercentageError || serviceCapacityError) {
      setServiceErrors(errors);
      return;
    }

    const servicePayload = {
      id: editingService?.id || Date.now(),
      serviceName: value,
      isExported: serviceForm.isExported,
      destinationCountries: serviceForm.destinationCountries,
      exportPercentage: serviceForm.exportPercentage,
      totalCapacity: serviceForm.totalCapacity,
      totalCapacityUnit: serviceForm.totalCapacityUnit,
      currentCapacity: serviceForm.currentCapacity,
      currentCapacityUnit: serviceForm.currentCapacityUnit,
      commencementDate: serviceForm.commencementDate
    };

    if (editingService) {
      setServices((prev) =>
        prev.map((item) => (item.id === editingService.id ? servicePayload : item))
      );
    } else {
      setServices((prev) => [...prev, servicePayload]);
    }

    clearError('services');
    setServiceModalVisible(false);
    setEditingService(null);
    setServiceForm({
      serviceName: '',
      isExported: null,
      destinationCountries: [],
      exportPercentage: '',
      totalCapacity: '',
      totalCapacityUnit: 'Number',
      currentCapacity: '',
      currentCapacityUnit: 'Number',
      commencementDate: ''
    });
    setServicePercentageError('');
  };

  const handleDestinationCountriesSelection = (countries) => {
    setServiceForm((prev) => ({ ...prev, destinationCountries: countries }));
    if (serviceErrors.destinationCountries && countries?.length > 0) {
      setServiceErrors((prev) => ({ ...prev, destinationCountries: undefined }));
    }
  };

  const handleDateSelection = (dateString) => {
    setServiceForm((prev) => ({ ...prev, commencementDate: dateString }));
    if (serviceErrors.commencementDate) {
      setServiceErrors((prev) => ({ ...prev, commencementDate: undefined }));
    }
    setDatePickerModalVisible(false);
  };

  const openDestinationCountriesModal = () => {
    destinationCountriesBottomSheetRef.current?.open();
  };

  const handleDeleteService = (id) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddCustomer = (customerData) => {
    if (editingCustomer) {
      setCustomers((prev) =>
        prev.map((customer) =>
          customer.id === editingCustomer.id ? { ...editingCustomer, ...customerData } : customer
        )
      );
      setEditingCustomer(null);
    } else {
      setCustomers((prev) => [...prev, { id: Date.now(), ...customerData }]);
    }
    clearError('customers');
  };

  const handleEditCustomer = (id, customerData) => {
    setEditingCustomer({ id, ...customerData });
    setAddCustomerModalVisible(true);
  };

  const handleDeleteCustomer = (id) => {
    setCustomers((prev) => prev.filter((customer) => customer.id !== id));
  };

  const handleAddKeyProcess = () => {
    const value = keyProcessInput.trim();
    if (!value) {
      return;
    }
    if (keyProcesses.some((p) => p.name?.toLowerCase() === value.toLowerCase())) {
      setKeyProcessInput('');
      return;
    }
    setKeyProcesses((prev) => [...prev, { id: Date.now(), name: value }]);
    setKeyProcessInput('');
    clearError('keyProcesses');
  };

  const handleDeleteKeyProcess = (id) => {
    setKeyProcesses((prev) => {
      const removed = prev.find((process) => process.id === id);
      const next = prev.filter((process) => process.id !== id);
      if (removed) {
        setOutsourcedProcesses((prevOut) => prevOut.filter((p) => p.name !== removed.name));
      }
      return next;
    });
  };

  const handleSaveKeyResource = (resourceData) => {
    if (editingKeyResource) {
      setKeyResources((prev) =>
        prev.map((r) =>
          r.id === editingKeyResource.id ? { ...editingKeyResource, ...resourceData } : r
        )
      );
      setEditingKeyResource(null);
    } else {
      setKeyResources((prev) => [...prev, { id: Date.now(), ...resourceData }]);
    }
    clearError('keyResources');
  };

  const handleEditKeyResource = (resource) => {
    setEditingKeyResource(resource);
    setKeyResourceModalVisible(true);
  };

  const handleDeleteKeyResource = (id) => {
    setKeyResources((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSaveOutsourcedComponent = (componentData) => {
    if (editingOutsourcedComponent) {
      setOutsourcedComponents((prev) =>
        prev.map((c) =>
          c.id === editingOutsourcedComponent.id
            ? { ...editingOutsourcedComponent, ...componentData }
            : c
        )
      );
      setEditingOutsourcedComponent(null);
    } else {
      setOutsourcedComponents((prev) => [...prev, { id: Date.now(), ...componentData }]);
    }
    clearError('keyResources');
  };

  const handleEditOutsourcedComponent = (component) => {
    setEditingOutsourcedComponent(component);
    setOutsourcedComponentModalVisible(true);
  };

  const handleDeleteOutsourcedComponent = (id) => {
    setOutsourcedComponents((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddCertification = () => {
    const value = certificationInput.trim();
    if (!value) {
      return;
    }
    if (certifications.some((c) => c.name?.toLowerCase() === value.toLowerCase())) {
      setCertificationInput('');
      return;
    }
    setCertifications((prev) => [...prev, { id: Date.now(), name: value }]);
    setCertificationInput('');
    clearError('certifications');
  };

  const handleDeleteCertification = (id) => {
    setCertifications((prev) => prev.filter((cert) => cert.id !== id));
  };

  const handleSaveAndNext = async () => {
    const errors = {};
    if (!providerType) {
      errors.providerType = 'Service provider type is required';
    }
    if (!formData.category?.categoryName) {
      errors.category = 'Category is required';
    }
    if (!formData.labs || formData.labs.length === 0) {
      errors.labs = 'At least one service is required';
    }
    if (services.length === 0) {
      errors.services = 'At least one service is required';
    }
    if (customers.length === 0) {
      errors.customers = 'At least one customer is required';
    }
    if (keyProcesses.length === 0) {
      errors.keyProcesses = 'At least one key process is required';
    }
    if (keyResources.length === 0 && outsourcedComponents.length === 0) {
      errors.keyResources = 'Add at least one key service resource or outsourced service component';
    }
    if (certifications.length === 0) {
      errors.certifications = 'At least one third party certification is required';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo?.({ y: 0, animated: true });
      }, 100);
      return;
    }
    setFormErrors({});
    const val = {
      assessmentId,
      data: {
        svcProviderType: providerType,
        category: formData.category?.categoryName || '',
        svcDrdoVendorLabs: formData.labs
          ?.filter((lab) => lab.storeName)
          .map((lab) => ({ labName: lab.storeName })),
        svcServices: services.map((service) => ({
          serviceName: service.serviceName,
          isExported: service.isExported,
          exportCountries: service.destinationCountries?.map((country) => country.name),
          exportPercentage: service.exportPercentage ? parseFloat(service.exportPercentage) : null,
          totalProductionCapacity: parseIndianNumber(service.totalCapacity),
          capacityUnit: service.totalCapacityUnit,
          currentUtilizedCapacity: parseIndianNumber(service.currentCapacity),
          capacityUnitUtilized: service.currentCapacityUnit,
          commencementDate: service.commencementDate
        })),
        customers,
        svcKeyProcesses: keyProcesses.map((process) => ({ processName: process.name })),
        svcOutsourcedProcesses: outsourcedProcesses.map((process) => ({
          processName: process.name
        })),
        svcKeyResources: keyResources.map((resource) => ({
          resourceName: resource.name,
          isImported: !!resource.isImported,
          importCountry: resource.isImported ? resource.importCountry || null : null,
          importPercentage: resource.isImported ? (resource.importPercentage ?? null) : null
        })),
        svcOutsourcedComponents: outsourcedComponents.map((component) => ({
          componentName: component.name,
          isImported: !!component.isImported,
          importCountry: component.isImported ? component.importCountry || null : null,
          importPercentage: component.isImported ? (component.importPercentage ?? null) : null
        })),
        thirdPartyCertifications: certifications.map((cert) => cert.name)
      }
    };
    Logger.info('AddServiceBasicInformation - Form Data to Save:', val);
    await dispatch(addBasicInformationAction(val));
  };

  const requiredMark = <Text style={[{ color: COLORS.error.active }]}>*</Text>;

  return (
    <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
      <Header title="Basic Information" back={true} />
      <AppScrollView ref={scrollViewRef}>
        <View pointerEvents={readOnly ? 'none' : 'auto'}>
          {/* Service Provider Type */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Type of Service Provider {requiredMark}</Text>
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.dropdownField}
              onPress={() => providerTypeBottomSheetRef.current?.open()}>
              <Text
                style={
                  providerType
                    ? [styles.dropdownText, commonStyles.FontFamily_Medium500]
                    : [styles.placeholderText, commonStyles.FontFamily_Medium500]
                }>
                {PROVIDER_TYPES.find((type) => type.id === providerType)?.label ||
                  'Select Service Provider'}
              </Text>
              <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
            </TouchableOpacity>
            {formErrors.providerType && (
              <Text style={styles.errorText}>{formErrors.providerType}</Text>
            )}
          </View>
          {/* Category */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Category {requiredMark}</Text>
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.dropdownField}
              onPress={() => {
                if (!providerType) {
                  setFormErrors((prev) => ({
                    ...prev,
                    providerType: 'Select the service provider type first'
                  }));
                  return;
                }
                setCategoryModalVisible(true);
              }}>
              <Text
                style={[
                  formData?.category?.categoryName ? styles.dropdownText : styles.placeholderText,
                  commonStyles.FontFamily_Medium500
                ]}>
                {formData?.category?.categoryName || 'Select Category'}
              </Text>
              <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
            </TouchableOpacity>
            {formErrors.category && <Text style={styles.errorText}>{formErrors.category}</Text>}
          </View>
          {/* Labs */}
          <View style={[styles.fieldContainer, { paddingBottom: Responsive.height(16) }]}>
            <Text style={styles.fieldLabel}>Service(s) {requiredMark}</Text>
            {formData.labs.length === 0 ? (
              <TouchableOpacity
                activeOpacity={0.6}
                style={styles.dropdownField}
                onPress={() => {
                  if (!providerType) {
                    setFormErrors((prev) => ({
                      ...prev,
                      providerType: 'Select the service provider type first'
                    }));
                    return;
                  }
                  setLabModalVisible(true);
                }}>
                <Text style={[styles.dropdownText, styles.placeholderText]}>Select Service(s)</Text>
                <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
              </TouchableOpacity>
            ) : (
              <View style={styles.storeContainer}>
                <View style={styles.selectedStoresContainer}>
                  {formData.labs.map((lab, index) => (
                    <View key={lab.id ? lab.id : `lab-${index}`} style={styles.storeChip}>
                      <Text style={styles.storeChipText}>{lab.storeName}</Text>
                      <TouchableOpacity
                        activeOpacity={0.6}
                        style={styles.removeStoreButton}
                        onPress={() => handleRemoveLab(lab.id)}>
                        <Image
                          source={Icons.close}
                          style={[commonStyles.iconSize20, { marginRight: -1 }]}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addStoreButton}
                    onPress={() => setLabModalVisible(true)}
                    activeOpacity={0.6}>
                    <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {formErrors.labs && <Text style={styles.errorText}>{formErrors.labs}</Text>}
          </View>
          {/* Services */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>SERVICES DETAILS</Text>
            {services.map((service, index) => (
              <View
                key={service.id ? service.id : `service-${index}`}
                style={styles.listItemContainer}>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemNumber}>{String(index + 1).padStart(2, '0')}</Text>
                  <Text style={styles.listItemText}>{service.serviceName}</Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    style={styles.actionButton}
                    onPress={() => openServiceModal(service)}>
                    <Image source={Icons.edit} style={styles.actionIcon} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    style={styles.actionButton}
                    onPress={() => handleDeleteService(service.id)}>
                    <Image
                      source={Icons.trash}
                      style={[styles.actionIcon, { tintColor: COLORS.error.active }]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity
              activeOpacity={0.6}
              // style={[{ backgroundColor: 'red' }]}
              onPress={() => openServiceModal()}>
              <Text style={styles.addButtonText}>+ Add Service</Text>
            </TouchableOpacity>
            {formErrors.services && <Text style={styles.errorText}>{formErrors.services}</Text>}
          </View>
          {/* Customer Details */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>CUSTOMER DETAILS</Text>
            {customers.map((customer, index) => (
              <View
                key={customer.id ? customer.id : `customer-${index}`}
                style={styles.listItemContainer}>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemNumber}>{String(index + 1).padStart(2, '0')}</Text>
                  <Text style={styles.listItemText}>{customer.customerName}</Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    style={styles.actionButton}
                    onPress={() => handleEditCustomer(customer.id, customer)}>
                    <Image source={Icons.edit} style={styles.actionIcon} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    style={styles.actionButton}
                    onPress={() => handleDeleteCustomer(customer.id)}>
                    <Image
                      source={Icons.trash}
                      style={[styles.actionIcon, { tintColor: COLORS.error.active }]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => {
                setEditingCustomer(null);
                setAddCustomerModalVisible(true);
              }}>
              <Text style={styles.addButtonText}>+ Add Customer</Text>
            </TouchableOpacity>
            {formErrors.customers && <Text style={styles.errorText}>{formErrors.customers}</Text>}
          </View>
          {/* Key Processes */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Processes</Text>
            <View style={[styles.processInputContainer, { marginTop: Responsive.height(6) }]}>
              <Text style={styles.fieldLabel}>Key Services{requiredMark}</Text>
              <AutoCompleteInput
                ref={keyProcessInputRef}
                name={'serviceKeyProcess'}
                value={keyProcessInput}
                providerType={providerType}
                excludeValues={keyProcesses.map((p) => p.name)}
                placeholder="Enter Key Services"
                onSelect={(item) => setKeyProcessInput(item)}
                onChangeText={(text) => setKeyProcessInput(text)}
                onDropdownOpen={setAutoCompleteDropdownOpen}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToInput?.(keyProcessInputRef, 30);
                  }, 100);
                }}
              />
              <Text style={styles.helperText}>
                e.g. installation, maintenance, calibration, repair, inspection, integration,
                testing, facility management, etc.
              </Text>
              {keyProcessInput ? (
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.addProcessButton}
                  onPress={handleAddKeyProcess}>
                  <Text style={styles.addProcessButtonText}>Add</Text>
                </TouchableOpacity>
              ) : null}
              {keyProcesses.length > 0 && (
                <View style={styles.processChipsContainer}>
                  {keyProcesses.map((process, index) => (
                    <View
                      key={process.id ? process.id : `keyProcess-${index}`}
                      style={styles.processItemBox}>
                      <Text>{process.name}</Text>
                      <View style={styles.processChip}>
                        {outsourcedProcesses.some((p) => p.name === process.name) ? (
                          <TouchableOpacity
                            onPress={() =>
                              setOutsourcedProcesses((prev) =>
                                prev.filter((p) => p.name !== process.name)
                              )
                            }
                            activeOpacity={0.6}>
                            <Image style={{ width: 18, height: 18 }} source={Icons.rightTick} />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() =>
                              setOutsourcedProcesses((prev) =>
                                prev.some((p) => p.name === process.name)
                                  ? prev
                                  : [...prev, { id: Date.now(), name: process.name }]
                              )
                            }
                            activeOpacity={0.6}>
                            <View style={styles.outsourcedCheckbox} />
                          </TouchableOpacity>
                        )}
                        <Text style={styles.processChipText}>Outsourced</Text>
                        <TouchableOpacity
                          activeOpacity={0.6}
                          onPress={() => handleDeleteKeyProcess(process.id)}>
                          <Image source={Icons.trash} style={[commonStyles.iconSize18]} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
            {formErrors.keyProcesses && (
              <Text style={styles.errorText}>{formErrors.keyProcesses}</Text>
            )}
          </View>
          {/* Key Service Resources */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Key Service Resources</Text>
            {keyResources.map((resource, index) => (
              <View
                key={resource.id ? resource.id : `keyResource-${index}`}
                style={styles.listItemContainer}>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemNumber}>{String(index + 1).padStart(2, '0')}</Text>
                  <Text style={styles.listItemText}>{resource.name}</Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    style={styles.actionButton}
                    onPress={() => handleEditKeyResource(resource)}>
                    <Image source={Icons.edit} style={styles.actionIcon} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    style={styles.actionButton}
                    onPress={() => handleDeleteKeyResource(resource.id)}>
                    <Image
                      source={Icons.trash}
                      style={[styles.actionIcon, { tintColor: COLORS.error.active }]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => {
                setEditingKeyResource(null);
                setKeyResourceModalVisible(true);
              }}>
              <Text style={styles.addButtonText}>+ Add Key Service Resource</Text>
            </TouchableOpacity>
            {formErrors.keyResources && (
              <Text style={styles.errorText}>{formErrors.keyResources}</Text>
            )}
          </View>
          {/* Outsourced Service Components */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Outsourced Service Components</Text>
            {outsourcedComponents.map((component, index) => (
              <View
                key={component.id ? component.id : `outsourcedComponent-${index}`}
                style={styles.listItemContainer}>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemNumber}>{String(index + 1).padStart(2, '0')}</Text>
                  <Text style={styles.listItemText}>{component.name}</Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    style={styles.actionButton}
                    onPress={() => handleEditOutsourcedComponent(component)}>
                    <Image source={Icons.edit} style={styles.actionIcon} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    style={styles.actionButton}
                    onPress={() => handleDeleteOutsourcedComponent(component.id)}>
                    <Image
                      source={Icons.trash}
                      style={[styles.actionIcon, { tintColor: COLORS.error.active }]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => {
                setEditingOutsourcedComponent(null);
                setOutsourcedComponentModalVisible(true);
              }}>
              <Text style={styles.addButtonText}>+ Add Outsourced Service Component</Text>
            </TouchableOpacity>
          </View>
          {/* Third Party Certifications */}
          <View style={styles.sectionContainer}>
            <View style={styles.processInputContainer}>
              <Text style={styles.fieldLabel}>Third Party Certifications{requiredMark}</Text>
              <AutoCompleteInput
                ref={certificationInputRef}
                name={'certificate'}
                value={certificationInput}
                excludeValues={certifications.map((c) => c.name)}
                placeholder="Enter Third Party Certifications"
                onSelect={(item) => setCertificationInput(item)}
                onChangeText={(text) => setCertificationInput(text)}
                onDropdownOpen={setAutoCompleteDropdownOpen}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToInput?.(certificationInputRef, 30);
                  }, 100);
                }}
              />
              {certificationInput.trim() ? (
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.addProcessButton}
                  onPress={handleAddCertification}>
                  <Text style={styles.addProcessButtonText}>Add</Text>
                </TouchableOpacity>
              ) : null}
              {formErrors.certifications && (
                <Text style={styles.errorText}>{formErrors.certifications}</Text>
              )}
            </View>
            {certifications.length > 0 && (
              <View style={styles.processChipsContainer}>
                {certifications.map((certification, index) => (
                  <View
                    key={certification.id ? certification.id : `certification-${index}`}
                    style={styles.tagRowItem}>
                    <Text style={styles.processChipText}>{certification.name}</Text>
                    <TouchableOpacity
                      activeOpacity={0.6}
                      onPress={() => handleDeleteCertification(certification.id)}>
                      <Image source={Icons.trash} style={[commonStyles.iconSize18]} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
        {readOnly ? null : (
          <View style={styles.footer}>
            <AppButton
              size="large"
              variant="primary"
              title="Save & Next"
              onPress={handleSaveAndNext}
            />
          </View>
        )}
      </AppScrollView>
      <AppCommonModal
        showmodal={successModal}
        imgsrc={Icons.success}
        title="Basic Information Added"
        subTitle="Your Basic Information has been added successfully."
      />
      <CategorySelectionModal
        visible={categoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
        categories={filteredCategories}
        selectedCategory={formData.category?.categoryName}
        onSelect={handleCategorySelect}
      />
      <AppBottomSheet ref={providerTypeBottomSheetRef} snapPoints={['40%']}>
        <View style={styles.bottomSheetHeader}>
          <Text style={styles.bottomSheetTitle}>Select Service Provider</Text>
        </View>
        <View style={styles.bottomSheetContent}>
          {PROVIDER_TYPES.map((type) => {
            const isSelected = providerType === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                style={styles.bottomSheetItem}
                activeOpacity={0.6}
                onPress={() => handleProviderTypeSelect(type.id)}>
                <View style={styles.radioButtonRow}>
                  <Text style={styles.bottomSheetItemText}>{type.label}</Text>
                  <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                    {isSelected && <View style={styles.radioButtonInner} />}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </AppBottomSheet>
      <AppModal visible={serviceModalVisible}>
        <Header
          title={editingService ? 'Edit Service' : 'Add Service'}
          close={true}
          onPress={() => setServiceModalVisible(false)}
        />
        <View style={styles.modalContainer}>
          <AppScrollView style={styles.modalScrollContainer} enableKeyboardAware={false}>
            <View style={styles.modalFormContainer}>
              <View style={styles.inputContainer}>
                <AppInput
                  maxLength={150}
                  asterisk
                  label={'Name of Service'}
                  placeholderText="Enter Name"
                  value={serviceForm.serviceName}
                  onChange={(text) => {
                    setServiceForm((prev) => ({ ...prev, serviceName: text }));
                    if (serviceErrors.serviceName && text.trim()) {
                      setServiceErrors((prev) => ({ ...prev, serviceName: undefined }));
                    }
                  }}
                />
                {serviceErrors.serviceName && (
                  <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                    {serviceErrors.serviceName}
                  </Text>
                )}
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.fieldLabel}>
                  Is the service being supplied internationally?
                  <Text style={{ color: COLORS.error.active }}>*</Text>
                </Text>
                <View style={styles.radioContainer}>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    style={styles.radioOption}
                    onPress={() => {
                      setServiceForm((prev) => ({ ...prev, isExported: true }));
                      setServiceErrors((prev) => {
                        const next = { ...prev };
                        delete next.isExported;
                        delete next.destinationCountries;
                        delete next.exportPercentage;
                        return next;
                      });
                      setServicePercentageError('');
                    }}>
                    <View
                      style={[
                        styles.radioButton,
                        serviceForm.isExported === true && styles.radioButtonSelected
                      ]}>
                      {serviceForm.isExported === true && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioLabel}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    style={styles.radioOption}
                    onPress={() => {
                      setServiceForm((prev) => ({
                        ...prev,
                        isExported: false,
                        destinationCountries: [],
                        exportPercentage: ''
                      }));
                      setServiceErrors((prev) => {
                        const next = { ...prev };
                        delete next.isExported;
                        delete next.destinationCountries;
                        delete next.exportPercentage;
                        return next;
                      });
                      setServicePercentageError('');
                    }}>
                    <View
                      style={[
                        styles.radioButton,
                        serviceForm.isExported === false && styles.radioButtonSelected
                      ]}>
                      {serviceForm.isExported === false && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioLabel}>No</Text>
                  </TouchableOpacity>
                </View>
                {serviceErrors.isExported && (
                  <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                    {serviceErrors.isExported}
                  </Text>
                )}
              </View>
              {serviceForm.isExported === true && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.fieldLabel}>
                      Destination Countries
                      <Text style={{ color: COLORS.error.active }}>*</Text>
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.6}
                      style={styles.dropdownField}
                      onPress={openDestinationCountriesModal}>
                      <Text
                        style={
                          serviceForm.destinationCountries.length === 0
                            ? [styles.dropdownText, styles.placeholderText]
                            : [styles.dropdownText, commonStyles.FontFamily_Medium500]
                        }>
                        {serviceForm.destinationCountries.length > 0
                          ? `${serviceForm.destinationCountries.length} countries selected`
                          : 'Select Destination Countries'}
                      </Text>
                      <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
                    </TouchableOpacity>
                    {serviceErrors.destinationCountries && (
                      <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                        {serviceErrors.destinationCountries}
                      </Text>
                    )}
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.fieldLabel}>
                      Percentage (%) of Service Supplied Internationally
                      <Text style={{ color: COLORS.error.active }}>*</Text>
                    </Text>
                    <View style={styles.percentageWrapper}>
                      <AppInput
                        label={undefined}
                        placeholderText="Enter Percentage"
                        value={serviceForm.exportPercentage}
                        keyboardType="numeric"
                        cap="none"
                        addressInputStyle={{ paddingRight: Responsive.width(36) }}
                        onChange={(text) => {
                          const sanitized = sanitizePercentInput(text);
                          if (sanitized === null) {
                            return;
                          }
                          setServicePercentageError('');
                          setServiceForm((prev) => ({ ...prev, exportPercentage: sanitized }));
                          if (serviceErrors.exportPercentage && sanitized) {
                            setServiceErrors((prev) => ({ ...prev, exportPercentage: undefined }));
                          }
                        }}
                      />
                      <View style={styles.percentageSuffix} pointerEvents="none">
                        <Text style={styles.percentageSymbol}>%</Text>
                      </View>
                    </View>
                    {serviceErrors.exportPercentage && (
                      <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                        {serviceErrors.exportPercentage}
                      </Text>
                    )}
                    {servicePercentageError ? (
                      <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                        {servicePercentageError}
                      </Text>
                    ) : null}
                  </View>
                </>
              )}
              <View style={styles.inputContainer}>
                <Text style={styles.fieldLabel}>
                  Total Services capacity per year
                  <Text style={{ color: COLORS.error.active }}>*</Text>
                </Text>
                <View style={styles.capacityRow}>
                  <View style={styles.capacityInput}>
                    <AppInput
                      label={undefined}
                      placeholderText="Enter capacity"
                      keyboardType="numeric"
                      cap="none"
                      addressInputStyle={styles.capacityInputText}
                      value={formatIndianNumber(serviceForm.totalCapacity)}
                      onChange={(text) => {
                        const cleanValue = sanitizeCapacity(text);
                        if (cleanValue === null) {
                          return;
                        }
                        setServiceForm((prev) => ({ ...prev, totalCapacity: cleanValue }));
                        if (serviceErrors.totalCapacity && cleanValue) {
                          setServiceErrors((prev) => ({ ...prev, totalCapacity: undefined }));
                        }
                        const total = parseIndianNumber(cleanValue);
                        const current = parseIndianNumber(serviceForm.currentCapacity);
                        if (total !== null && current !== null && current > total) {
                          setServiceCapacityError('Current capacity cannot exceed total capacity.');
                        } else {
                          setServiceCapacityError('');
                        }
                      }}
                    />
                  </View>
                  <View style={styles.unitSelector}>
                    <Text style={[styles.unitText, commonStyles.FontFamily_Medium500]}>
                      {serviceForm.totalCapacityUnit}
                    </Text>
                  </View>
                </View>
                <Text style={styles.helperText}>As on date of application for assessment</Text>
                {serviceErrors.totalCapacity && (
                  <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                    {serviceErrors.totalCapacity}
                  </Text>
                )}
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.fieldLabel}>
                  Current utilised capacity per year
                  <Text style={{ color: COLORS.error.active }}>*</Text>
                </Text>
                <View style={styles.capacityRow}>
                  <View style={styles.capacityInput}>
                    <AppInput
                      label={undefined}
                      placeholderText="Enter capacity"
                      keyboardType="numeric"
                      cap="none"
                      addressInputStyle={styles.capacityInputText}
                      value={formatIndianNumber(serviceForm.currentCapacity)}
                      onChange={(text) => {
                        const cleanValue = sanitizeCapacity(text);
                        if (cleanValue === null) {
                          return;
                        }
                        setServiceForm((prev) => ({ ...prev, currentCapacity: cleanValue }));
                        if (serviceErrors.currentCapacity && cleanValue) {
                          setServiceErrors((prev) => ({ ...prev, currentCapacity: undefined }));
                        }
                        const total = parseIndianNumber(serviceForm.totalCapacity);
                        const current = parseIndianNumber(cleanValue);
                        if (total !== null && current !== null && current > total) {
                          setServiceCapacityError('Current capacity cannot exceed total capacity.');
                        } else {
                          setServiceCapacityError('');
                        }
                      }}
                    />
                  </View>
                  <View style={styles.unitSelector}>
                    <Text style={[styles.unitText, commonStyles.FontFamily_Medium500]}>
                      {serviceForm.currentCapacityUnit}
                    </Text>
                  </View>
                </View>
                <Text style={styles.helperText}>As on date of application for assessment</Text>
                {serviceErrors.currentCapacity && (
                  <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                    {serviceErrors.currentCapacity}
                  </Text>
                )}
                {serviceCapacityError ? (
                  <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                    {serviceCapacityError}
                  </Text>
                ) : null}
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.fieldLabel}>
                  Date of Commencement of Service
                  <Text style={{ color: COLORS.error.active }}>*</Text>
                </Text>
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.dropdownField}
                  onPress={() => setDatePickerModalVisible(true)}>
                  <Text
                    style={
                      serviceForm.commencementDate
                        ? [styles.dropdownText, commonStyles.FontFamily_Medium500]
                        : [styles.dropdownText, styles.placeholderText]
                    }>
                    {serviceForm.commencementDate
                      ? new Date(serviceForm.commencementDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                      : 'Select Date'}
                  </Text>
                  <Image source={Icons.unfilledCalendar} style={styles.calendarIcon} />
                </TouchableOpacity>
                {serviceErrors.commencementDate && (
                  <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 2 }}>
                    {serviceErrors.commencementDate}
                  </Text>
                )}
              </View>
            </View>
          </AppScrollView>
          <View style={styles.modalFooter}>
            <AppButton
              title={editingService ? 'Save Service' : 'Add Service'}
              variant="primary"
              size="large"
              onPress={handleSaveService}
            />
          </View>
        </View>
      </AppModal>
      <StoreSelectionModal
        visible={labModalVisible}
        onClose={() => setLabModalVisible(false)}
        stores={filteredLabs}
        selectedStores={formData.labs}
        onSave={handleLabSelect}
      />
      <DatePickerModal
        visible={datePickerModalVisible}
        onClose={() => setDatePickerModalVisible(false)}
        onSelect={handleDateSelection}
        selectedDate={serviceForm.commencementDate}
        minDate={null}
        maxDate={null}
      />
      <SelectDestinationCountriesBottomSheet
        ref={destinationCountriesBottomSheetRef}
        onSelect={handleDestinationCountriesSelection}
        selectedCountries={serviceForm.destinationCountries}
        countries={countriesList || []}
        excludeIndia
      />
      <AddCustomer
        isVisible={addCustomerModalVisible}
        onClose={() => setAddCustomerModalVisible(false)}
        onSelect={handleAddCustomer}
        selectedValue={editingCustomer}
        assessmentId={assessmentId}
        existingCustomers={customers}
      />
      <AddKeyResource
        variant="resource"
        isVisible={keyResourceModalVisible}
        onClose={() => {
          setKeyResourceModalVisible(false);
          setEditingKeyResource(null);
        }}
        onSelect={handleSaveKeyResource}
        selectedValue={editingKeyResource}
        existingResources={keyResources}
        providerType={providerType}
      />
      <AddKeyResource
        variant="component"
        isVisible={outsourcedComponentModalVisible}
        onClose={() => {
          setOutsourcedComponentModalVisible(false);
          setEditingOutsourcedComponent(null);
        }}
        onSelect={handleSaveOutsourcedComponent}
        selectedValue={editingOutsourcedComponent}
        existingResources={outsourcedComponents}
        providerType={providerType}
      />
    </View>
  );
};

const styles = {
  fieldContainer: {
    ...commonStyles.paddingHorizontal16,
    paddingTop: Responsive.height(16),
    backgroundColor: COLORS.background.primary
  },
  fieldLabel: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    marginBottom: 4
  },
  helperText: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.secondary,
    marginTop: Responsive.height(4)
  },
  errorText: {
    color: COLORS.error.main
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Responsive.height(6),
    gap: Responsive.width(6)
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
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Responsive.width(30)
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: Responsive.width(10),
    backgroundColor: COLORS.background.primary,
    overflow: 'hidden'
  },
  capacityInput: {
    flex: 1
  },
  capacityInputText: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent'
  },
  unitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: Responsive.width(110),
    alignSelf: 'stretch',
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border.light
  },
  unitText: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.tertiary
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
    color: COLORS.text.primary
  },
  bottomSheetHeader: {
    paddingHorizontal: Responsive.width(16),
    paddingTop: Responsive.height(16),
    paddingBottom: Responsive.height(12),
    borderBottomWidth: 1,
    borderColor: COLORS.border.light
  },
  bottomSheetTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.primary,
    textAlign: 'center'
  },
  bottomSheetContent: {
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(12)
  },
  bottomSheetItem: {
    paddingVertical: Responsive.height(14),
    borderBottomWidth: 1,
    borderColor: COLORS.border.light
  },
  bottomSheetItemText: {
    fontSize: FONT_SIZE.fs14,
    ...commonStyles.FontFamily_SemiBold600,

    color: COLORS.text.primary,
    flex: 1
  },
  radioButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dropdownField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: Responsive.height(12),
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: Responsive.width(8),
    backgroundColor: COLORS.background.primary,
    minHeight: 45
  },
  dropdownText: {
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
  storeContainer: {
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: Responsive.width(8),
    backgroundColor: COLORS.background.primary,
    padding: Responsive.width(12),
    paddingBottom: Responsive.height(0),
    minHeight: 45
  },
  selectedStoresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Responsive.height(8),
    paddingRight: Responsive.width(30)
  },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.secondary,
    borderRadius: Responsive.width(6),
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: Responsive.width(8),
    marginBottom: Responsive.height(4),
    borderWidth: 1,
    borderColor: COLORS.border.light
  },
  storeChipText: {
    fontSize: FONT_SIZE.fs13,
    color: COLORS.text.primary,
    marginRight: Responsive.width(4)
  },
  removeStoreButton: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  addStoreButton: {
    paddingVertical: 6,
    position: 'absolute',
    right: 0,
    top: 0
  },
  sectionContainer: {
    ...commonStyles.paddingHorizontal16,
    paddingVertical: Responsive.height(16),
    backgroundColor: COLORS.background.primary,
    marginTop: Responsive.height(4)
  },
  sectionTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.secondary,
    marginBottom: Responsive.height(4),
    textTransform: 'uppercase'
  },
  addButton: {
    paddingVertical: Responsive.height(12)
  },
  addButtonText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.primary.main,
    paddingTop: Responsive.height(4)
  },
  addServiceButton: {
    marginTop: Responsive.height(12),
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: Responsive.width(8),
    backgroundColor: COLORS.background.primary,
    paddingHorizontal: 12,
    paddingVertical: Responsive.height(12)
  },
  addServiceText: {
    ...commonStyles.FontFamily_Medium500,
    color: COLORS.primary.main
  },
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
    marginBottom: Responsive.height(18)
  },
  modalFooter: {
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16),
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary
  },
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Responsive.width(8),
    marginTop: Responsive.height(8)
  },
  inlineAddButton: {
    backgroundColor: COLORS.primary.main,
    borderRadius: Responsive.width(6),
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(12)
  },
  inlineAddButtonText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.background.primary
  },
  footer: {
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16),
    backgroundColor: COLORS.background.primary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light
  },
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Responsive.height(2)
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  listItemNumber: {
    ...commonStyles.FontFamily_Bold700,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.placeholder,
    marginRight: Responsive.width(4),
    minWidth: Responsive.width(20)
  },
  listItemText: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    flex: 1
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  actionButton: {
    padding: Responsive.width(5)
  },
  actionIcon: {
    width: Responsive.width(18),
    height: Responsive.height(18)
  },
  processChipsContainer: {
    flex: 1,
    marginTop: Responsive.height(12)
  },
  processItemBox: {
    backgroundColor: COLORS.background.secondary,
    padding: 12,
    borderRadius: 8,
    marginVertical: 6
  },
  processChip: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: COLORS.background.secondary,
    borderRadius: Responsive.width(6),
    marginTop: Responsive.height(4)
  },
  processChipText: {
    ...commonStyles.FontFamily_Regular400,
    fontSize: FONT_SIZE.fs13,
    color: COLORS.text.primary,
    marginRight: Responsive.width(8),
    flex: 1
  },
  outsourcedCheckbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: COLORS.background.primary,
    borderRadius: 4
  },
  tagRowItem: {
    padding: 10,
    flexDirection: 'row',
    backgroundColor: COLORS.background.secondary,
    borderRadius: 8,
    marginVertical: 6,
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  processInputContainer: {
    // marginBottom: Responsive.height(12),
    position: 'relative'
  },
  addProcessButton: {
    position: 'absolute',
    right: 8,
    top: 30,
    backgroundColor: COLORS.primary.main,
    borderRadius: Responsive.width(6),
    paddingHorizontal: Responsive.width(12),
    paddingVertical: Responsive.height(6),
    zIndex: 9999
  },
  addProcessButtonText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.background.primary
  },
  calendarIcon: {
    height: 24,
    width: 24,
    resizeMode: 'contain'
  }
};

export default AddServiceBasicInformation;
