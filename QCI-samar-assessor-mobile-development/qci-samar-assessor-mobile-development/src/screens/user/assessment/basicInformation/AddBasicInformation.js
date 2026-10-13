// Track if any AutoCompleteInput dropdown is open
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { COLORS, FONT_SIZE, FONTS_FAMILY } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
// Import the modal components
import AutoCompleteInput from '../../../../components/base/textInput/AutoCompleteInput';
import { Header } from '../../../../components/layout';
import { AppCommonModal } from '../../../../components/modals';
import AppScrollView from '../../../../components/shared/AppScrollView';
import Icons from '../../../../constants/Icons';
import {
  getAssessmentByIdAction,
  getStepProgressAction
} from '../../../../redux/action/assessmentAction';
import {
  addBasicInformationAction,
  getBasicInformationAction,
  getCategory,
  getCountriesAction,
  getStore
} from '../../../../redux/action/basicInformationAction';
import {
  resetAddBasicInformationState,
  resetData
} from '../../../../redux/slices/basicInformationSlice';
import { Logger } from '../../../../utils';
import { useApplicationLoader } from '../../../../utils/useApplicationLoader';
import AddBoughtOutPart from './AddBoughtOutPart';
import AddCustomer from './AddCustomer';
import AddProduct from './AddProduct';
import AddRawMaterial from './AddRawMaterial';
import CategorySelectionModal from './CategorySelectionModal';
import StoreSelectionModal from './StoreSelectionModal';

const AddBasicInforamtion = ({ route }) => {
  const scrollViewRef = useRef(null);
  const keyProcessInputRef = useRef(null);
  const certificationInputRef = useRef(null);
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const assessmentId = route?.params?.assessmentId;
  // readOnly is the post-punch-out review pass. This form has ~20 separate
  // add / edit / delete affordances spread across its sections, so it is made
  // non-interactive as a whole rather than gating each one — a single wrapper
  // cannot miss a control the way a per-control gate can. Scrolling still works
  // because the wrapper sits INSIDE the scroll view, which keeps its own
  // touches; only the Save action is removed outright.
  const readOnly = route?.params?.readOnly === true;
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [storeModalVisible, setStoreModalVisible] = useState(false);
  const [addProductModalVisible, setAddProductModalVisible] = useState(false);
  const [addCustomerModalVisible, setAddCustomerModalVisible] = useState(false);
  const [addRawMaterialModalVisible, setAddRawMaterialModalVisible] = useState(false);
  const [addBoughtOutPartModalVisible, setAddBoughtOutPartModalVisible] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modaltitle, setModalTitle] = useState('');
  const [modalmessage, setModalMessage] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [modalType, setModalType] = useState('');
  const [, setAutoCompleteDropdownOpen] = useState(false);

  // Edit states
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingRawMaterial, setEditingRawMaterial] = useState(null);
  const [editingBoughtOutPart, setEditingBoughtOutPart] = useState(null);

  // Form state
  const [_selectedMode, setSelectedMode] = useState('onsite');
  const [formData, setFormData] = useState({
    category: null,
    stores: []
  });

  // Products state
  const [products, setProducts] = useState([]);

  // Customers state
  const [customers, setCustomers] = useState([]);

  // Raw Materials state
  const [rawMaterials, setRawMaterials] = useState([]);
  const [boughtOutParts, setBoughtOutParts] = useState([]);

  // Processes state
  const [keyProcesses, setKeyProcesses] = useState([]);
  const [outsourcedProcesses, setOutsourcedProcesses] = useState([]);

  // Third Party Certifications state
  const [certifications, setCertifications] = useState([]);

  // Input states for processes and certifications
  const [keyProcessInput, setKeyProcessInput] = useState('');
  const [outsourcedProcessInput, setOutsourcedProcessInput] = useState('');
  const [certificationInput, setCertificationInput] = useState('');

  const [successModal, setSuccessModal] = useState(false);

  useEffect(() => {
    dispatch(resetData());
    dispatch(getBasicInformationAction(assessmentId));
    dispatch(getCategory());
    dispatch(getStore());
  }, []);
  useFocusEffect(
    React.useCallback(() => {
      const product = navigation.getState().routes.find((r) => r.name === 'AddBasicInformation')
        ?.params?.product;
      Logger.info('Received product from child:', product);
      if (product) {
        // Do something with the product, e.g. add to products list
        handleAddProduct(product);
        // Optionally clear the param so it doesn't trigger again
        navigation.setParams({ product: undefined });
      }
    }, [navigation])
  );

  const {
    basicInformation,
    getCategoryData,
    getStoreData,
    deleteBasicInfoProductLoading,
    deleteCustomerLoading,
    deleteRawMaterialLoading,
    addBasicInformationLoading,
    basicInformationLoading,
    addBasicInformationData
  } = useSelector((state) => state.basicInformation);

  useEffect(() => {
    if (addBasicInformationData) {
      setSuccessModal(true);
      dispatch(getStepProgressAction(assessmentId));
      dispatch(getAssessmentByIdAction(assessmentId));
      dispatch(resetAddBasicInformationState());
      setTimeout(() => {
        // User may have navigated back during the 2s window — don't fire
        // state updates / a second goBack on an unmounted screen.
        if (!navigation.isFocused()) {
          return;
        }
        setSuccessModal(false);
        navigation.goBack();
      }, 2000);
    }
  }, [addBasicInformationData]);

  useEffect(() => {
    setFormData({
      category: { categoryName: basicInformation?.basicInformation?.category },
      stores:
        basicInformation?.basicInformation?.mfgDrdoVendorStores?.map((item, index) => ({
          id: index + 1,
          storeName: item?.storeName
        })) || []
    });
    // keyProcesses and outsourcedProcesses are now arrays of objects with processName
    const keyProcs = basicInformation?.basicInformation?.mfgKeyProcesses || [];
    const outsourcedProcs = basicInformation?.basicInformation?.mfgOutsourcedProcesses || [];
    const certs = basicInformation?.basicInformation?.thirdPartyCertificationNames || [];

    setKeyProcesses(
      keyProcs.map((item, index) => ({
        id: index + 1,
        name: typeof item === 'string' ? item : item.processName
      }))
    );
    setOutsourcedProcesses(
      outsourcedProcs.map((item, index) => ({
        id: index + 1,
        name: typeof item === 'string' ? item : item.processName
      }))
    );
    setCertifications(
      certs.map((cert, index) => ({
        id: index + 1,
        name: typeof cert === 'string' ? cert : cert
      }))
    );

    setProducts(basicInformation?.basicInformation?.mfgProducts || []);
    setCustomers(basicInformation?.basicInformation?.customers || []);
    setRawMaterials(basicInformation?.basicInformation?.mfgRawMaterials || []);
    setBoughtOutParts(basicInformation?.basicInformation?.mfgBoughtOutParts || []);
  }, [basicInformation]);

  useEffect(() => {
    dispatch(getCountriesAction());
  }, []);

  useApplicationLoader(
    'basicInformation',
    deleteBasicInfoProductLoading ||
      deleteCustomerLoading ||
      deleteRawMaterialLoading ||
      basicInformationLoading ||
      addBasicInformationLoading
  );
  // Handler functions
  const _handleModeSelect = (modeId) => {
    setSelectedMode(modeId);
  };

  const handleCategorySelect = (category) => {
    setFormData((prev) => ({ ...prev, category }));
    setFormErrors((prev) => {
      const newErrors = { ...prev };
      if (category && category.categoryName) {
        delete newErrors.category;
      }
      return newErrors;
    });
  };

  const handleStoreSelect = (selectedStores) => {
    setFormData((prev) => ({ ...prev, stores: selectedStores }));
    setFormErrors((prev) => {
      const newErrors = { ...prev };
      if (selectedStores && selectedStores.length > 0) {
        delete newErrors.stores;
      }
      return newErrors;
    });
  };

  const getSelectedStoreIds = () => {
    return formData.stores;
  };

  const _getStoreDisplayText = () => {
    if (formData.stores.length === 0) {
      return 'Select the Stores';
    }
    return `${formData.stores.length} stores selected`;
  };

  const handleRemoveStore = (storeId) => {
    setFormData((prev) => ({
      ...prev,
      stores: prev.stores.filter((store) => store.id !== storeId)
    }));
  };

  // Product handlers
  const handleAddProduct = (productData) => {
    if (editingProduct) {
      // Edit existing product
      setProducts((prev) =>
        prev.map((product) =>
          product.id === editingProduct.id ? { ...editingProduct, ...productData } : product
        )
      );
      setEditingProduct(null);
    } else {
      // Add new product
      setProducts((prev) => [...prev, { id: Date.now(), ...productData }]);
    }
    setFormErrors((prev) => {
      const newErrors = { ...prev };
      if (products.length + 1 > 0) {
        delete newErrors.products;
      }
      return newErrors;
    });
  };

  const handleEditProduct = (id, productData) => {
    setEditingProduct({ id, ...productData });
    setAddProductModalVisible(true);
  };

  const handleDeleteProduct = async (id) => {
    setProducts((prev) => prev.filter((product) => product.id !== id));
  };

  // Customer handlers
  const handleAddCustomer = (customerData) => {
    if (editingCustomer) {
      // Edit existing customer
      setCustomers((prev) =>
        prev.map((customer) =>
          customer.id === editingCustomer.id ? { ...editingCustomer, ...customerData } : customer
        )
      );
      setEditingCustomer(null);
    } else {
      // Add new customer
      setCustomers((prev) => [...prev, { id: Date.now(), ...customerData }]);
    }
    setFormErrors((prev) => {
      const newErrors = { ...prev };
      if (customers.length + 1 > 0) {
        delete newErrors.customers;
      }
      return newErrors;
    });
  };

  const handleEditCustomer = (id, customerData) => {
    setEditingCustomer({ id, ...customerData });
    setAddCustomerModalVisible(true);
  };

  const handleDeleteCustomer = async (id) => {
    setCustomers((prev) => prev.filter((customer) => customer.id !== id));
  };

  const _DeleteConfirmation = (id, type) => {
    setModalOpen(true);
    setModalTitle('Delete ' + type);
    setModalMessage('Are you sure want to delete ' + type + '?');
    setDeleteId(id);
    setModalType(type);
  };

  // Raw Material handlers
  const handleAddRawMaterial = (rawMaterialData) => {
    Logger.info('Handling Add/Edit Raw Material:', rawMaterialData, editingRawMaterial);
    if (editingRawMaterial) {
      // Edit existing raw material
      setRawMaterials((prev) =>
        prev.map((material) =>
          material.id === editingRawMaterial.id
            ? { ...editingRawMaterial, ...rawMaterialData }
            : material
        )
      );
      setEditingRawMaterial(null);
    } else {
      // Add new raw material
      setRawMaterials((prev) => [...prev, { id: Date.now(), ...rawMaterialData }]);
    }
    // Remove validation errors for rawMaterials and boughtOutParts if either has items
    setFormErrors((prev) => {
      const newErrors = { ...prev };
      if (rawMaterials.length + 1 > 0 || boughtOutParts.length > 0) {
        delete newErrors.rawMaterials;
        delete newErrors.boughtOutParts;
      }
      return newErrors;
    });
  };

  const handleAddBoughtOutPart = (boughtOutPartData) => {
    Logger.info('Handling Add/Edit Bought Out Part:', boughtOutPartData, editingBoughtOutPart);
    if (editingBoughtOutPart) {
      // Edit existing bought out part
      setBoughtOutParts((prev) =>
        prev.map((part) =>
          part.id === editingBoughtOutPart.id
            ? { ...editingBoughtOutPart, ...boughtOutPartData }
            : part
        )
      );
      setEditingBoughtOutPart(null);
    } else {
      // Add new bought out part
      setBoughtOutParts((prev) => [...prev, { id: Date.now(), ...boughtOutPartData }]);
    }
    // Remove validation errors for rawMaterials and boughtOutParts if either has items
    setFormErrors((prev) => {
      const newErrors = { ...prev };
      if (rawMaterials.length > 0 || boughtOutParts.length + 1 > 0) {
        delete newErrors.rawMaterials;
        delete newErrors.boughtOutParts;
      }
      return newErrors;
    });
  };

  const handleEditRawMaterial = (id, rawMaterialData) => {
    setEditingRawMaterial({ id, ...rawMaterialData });
    setAddRawMaterialModalVisible(true);
  };

  const handleEditBoughtOutPart = (id, boughtOutPartData) => {
    setEditingBoughtOutPart({ id, ...boughtOutPartData });
    setAddBoughtOutPartModalVisible(true);
  };

  const handleDeleteRawMaterial = (id) => {
    setRawMaterials((prev) => prev.filter((material) => material.id !== id));
  };
  const handleDeleteBoughtOutPart = (id) => {
    setBoughtOutParts((prev) => prev.filter((part) => part.id !== id));
  };

  // Process handlers
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

  const _handleDeleteOutsourcedProcess = (id) => {
    setOutsourcedProcesses((prev) => prev.filter((process) => process.id !== id));
  };

  const handleDeleteCertification = (id) => {
    setCertifications((prev) => prev.filter((cert) => cert.id !== id));
  };

  // Process and Certification input handlers
  const handleAddKeyProcess = () => {
    if (keyProcessInput) {
      setKeyProcesses((prev) => [...prev, { id: Date.now(), name: keyProcessInput }]);
      setKeyProcessInput('');
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        if (keyProcesses.length + 1 > 0) {
          delete newErrors.keyProcesses;
        }
        return newErrors;
      });
    }
  };

  const handleAddOutsourcedProcess = () => {
    if (outsourcedProcessInput.trim()) {
      setOutsourcedProcesses((prev) => [
        ...prev,
        { id: Date.now(), name: outsourcedProcessInput.trim() }
      ]);
      setOutsourcedProcessInput('');
    }
  };

  const handleAddCertification = () => {
    if (certificationInput.trim()) {
      setCertifications((prev) => [...prev, { id: Date.now(), name: certificationInput.trim() }]);
      setCertificationInput('');
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        if (certifications.length + 1 > 0) {
          delete newErrors.certifications;
        }
        return newErrors;
      });
    }
  };

  // Handle input submit on Enter key
  const _handleKeyProcessSubmit = () => {
    handleAddKeyProcess();
  };

  const _handleOutsourcedProcessSubmit = () => {
    handleAddOutsourcedProcess();
  };

  const _handleCertificationSubmit = () => {
    handleAddCertification();
  };

  // Error state for validation
  const [formErrors, setFormErrors] = useState({});

  // Save form data with validation
  const handleSaveAndNext = async () => {
    const errors = {};
    if (!formData.category || !formData.category.categoryName) {
      errors.category = 'Category is required';
    }
    if (!formData.stores || formData.stores.length === 0) {
      errors.stores = 'At least one store is required';
    }
    if (!products || products.length === 0) {
      errors.products = 'At least one product is required';
    }
    if (!customers || customers.length === 0) {
      errors.customers = 'At least one customer is required';
    }
    // Only require one of rawMaterials or boughtOutParts
    if (
      (!rawMaterials || rawMaterials.length === 0) &&
      (!boughtOutParts || boughtOutParts.length === 0)
    ) {
      errors.rawMaterials = 'At least one key raw material or bought-out part is required';
      errors.boughtOutParts = 'At least one key raw material or bought-out part is required';
    }
    if (!keyProcesses || keyProcesses.length === 0) {
      errors.keyProcesses = 'At least one key process is required';
    }
    if (!certifications || certifications.length === 0) {
      errors.certifications = 'At least one third party certification is required';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      // Optionally scroll to top or first error
      setTimeout(() => {
        scrollViewRef.current?.scrollTo?.({ y: 0, animated: true });
      }, 100);
      return;
    }
    setFormErrors({});
    const val = {
      assessmentId: assessmentId,
      data: {
        category: formData.category ? formData.category.categoryName : '',
        mfgDrdoVendorStores: formData.stores
          ?.filter((store) => store.id)
          .map((store) => ({ storeName: store.storeName })),
        mfgProducts: products,
        customers: customers,
        mfgRawMaterials: rawMaterials,
        mfgBoughtOutParts: boughtOutParts,
        mfgKeyProcesses: keyProcesses.map((process) => ({ processName: process.name })),
        mfgOutsourcedProcesses: outsourcedProcesses.map((process) => ({
          processName: process.name
        })),
        thirdPartyCertifications: certifications.map((cert) => cert.name)
      }
    };
    Logger.info('AddBasicInforamtion - Form Data to Save:', val);
    await dispatch(addBasicInformationAction(val));
  };
  return (
    <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
      <Header title="Basic Information" back={true} />
      <AppScrollView ref={scrollViewRef}>
        <View style={[]} pointerEvents={readOnly ? 'none' : 'auto'}>
          {/* Category Selection */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              Category
              <Text style={[{ color: COLORS.error.active }]}>*</Text>
            </Text>
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.dropdownField}
              onPress={() => setCategoryModalVisible(true)}>
              <Text
                style={[
                  formData?.category?.categoryName ? styles.dropdownText : styles.placeholderText,
                  commonStyles.FontFamily_Medium500
                ]}>
                {formData?.category?.categoryName
                  ? formData.category.categoryName
                  : 'Select the Category'}
              </Text>
              <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
            </TouchableOpacity>
            {formErrors.category && (
              <Text style={{ color: COLORS.error.main, marginTop: 2, fontSize: 12 }}>
                {formErrors.category}
              </Text>
            )}
          </View>
          {/* Store Selection */}
          <View style={[styles.fieldContainer, { paddingBottom: Responsive.height(16) }]}>
            <Text style={styles.fieldLabel}>
              Store
              <Text style={[{ color: COLORS.error.active }]}>*</Text>
            </Text>
            {formData.stores.length === 0 ? (
              /* Empty State - Simple Dropdown */
              <TouchableOpacity
                activeOpacity={0.6}
                style={styles.dropdownField}
                onPress={() => setStoreModalVisible(true)}>
                <Text style={[styles.dropdownText, styles.placeholderText]}>Select the Stores</Text>
                <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
              </TouchableOpacity>
            ) : (
              /* With Selections - Chip Container */
              <TouchableOpacity
                style={styles.storeContainer}
                activeOpacity={0.6}
                onPress={() => setStoreModalVisible(true)}>
                {/* Selected Stores Chips */}
                <View style={styles.selectedStoresContainer}>
                  {formData.stores.map((store, index) => (
                    <View key={store.id ? store.id : `store-${index}`} style={styles.storeChip}>
                      <Text style={styles.storeChipText}>{store.storeName}</Text>
                      <TouchableOpacity
                        activeOpacity={0.6}
                        style={[styles.removeStoreButton]}
                        onPress={() => handleRemoveStore(store.id)}>
                        {/* <Text style={styles.removeStoreText}>×</Text> */}
                        <Image
                          source={Icons.close}
                          style={[commonStyles.iconSize20, { marginRight: -2 }]}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {/* Dropdown Arrow */}
                  <View style={styles.addStoreButton}>
                    <Image source={Icons.dropdownArrow} style={styles.dropdownIcon} />
                  </View>
                </View>
              </TouchableOpacity>
            )}
            {formErrors.stores && (
              <Text style={{ color: COLORS.error.main, marginTop: 2, fontSize: 12 }}>
                {formErrors.stores}
              </Text>
            )}
          </View>
          {/* Products/Articles Details Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>PRODUCTS / ARTICLES DETAILS</Text>
            {products?.length > 0
              ? products.map((product, index) => (
                  <View
                    key={product.id ? product.id : `product-${index}`}
                    style={styles.listItemContainer}>
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemNumber}>
                        {String(index + 1).padStart(2, '0')}
                      </Text>
                      <Text style={styles.listItemText}>{product.productName}</Text>
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        activeOpacity={0.6}
                        style={styles.actionButton}
                        onPress={() => handleEditProduct(product.id, product)}>
                        <Image source={Icons.edit} style={styles.actionIcon} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.6}
                        style={styles.actionButton}
                        onPress={() => handleDeleteProduct(product.id)}>
                        <Image
                          source={Icons.trash}
                          style={[styles.actionIcon, { tintColor: COLORS.error.active }]}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              : null}
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.addButton}
              onPress={() => {
                setEditingProduct(null);
                setAddProductModalVisible(true);
              }}>
              <Text style={styles.addButtonText}>+ Add Product</Text>
            </TouchableOpacity>
            {formErrors.products && (
              <Text style={{ color: COLORS.error.main, marginBottom: 2, fontSize: 12 }}>
                {formErrors.products}
              </Text>
            )}
          </View>
          {/* Customer Details Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>CUSTOMER DETAILS</Text>
            {customers?.length > 0
              ? customers.map((customer, index) => (
                  <View
                    key={customer.id ? customer.id : `customer-${index}`}
                    style={styles.listItemContainer}>
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemNumber}>
                        {String(index + 1).padStart(2, '0')}
                      </Text>
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
                ))
              : null}
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.addButton}
              onPress={() => {
                setEditingCustomer(null);
                setAddCustomerModalVisible(true);
              }}>
              <Text style={styles.addButtonText}>+ Add Customer</Text>
            </TouchableOpacity>
            {formErrors.customers && (
              <Text style={{ color: COLORS.error.main, marginBottom: 2, fontSize: 12 }}>
                {formErrors.customers}
              </Text>
            )}
          </View>
          {/* Processes Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Key Manufacturing Processes</Text>
            <View style={styles.processInputContainer}>
              {/* Input field for adding key processes */}
              <Text style={styles.fieldLabel}>
                Key Processes<Text style={{ color: COLORS.error.main }}>*</Text>
              </Text>
              <AutoCompleteInput
                ref={keyProcessInputRef}
                name={'keyProcess'}
                value={keyProcessInput}
                excludeValues={keyProcesses.map((p) => p.name)}
                placeholder="Search key processes..."
                onSelect={(item) => {
                  Logger.info('Selected Key Process:', item);
                  setKeyProcessInput(item);
                }}
                onChangeText={(text) => {
                  Logger.info('Key Process Input Changed:', text);
                  setKeyProcessInput(text);
                }}
                onDropdownOpen={(setOpen) => {
                  setAutoCompleteDropdownOpen(setOpen);
                }}
                onFocus={() => {
                  // Add a small offset for better visibility
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToInput?.(keyProcessInputRef, 30);
                  }, 100);
                }}
              />
              {keyProcessInput && (
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={[styles.addProcessButton]}
                  onPress={handleAddKeyProcess}>
                  <Text style={styles.addProcessButtonText}>Add</Text>
                </TouchableOpacity>
              )}
              {/* Display added key processes */}
              {keyProcesses.length > 0 && (
                <View style={styles.processChipsContainer}>
                  {keyProcesses.map((process, index) => (
                    <View
                      key={process.id ? process.id : `keyProcess-${index}`}
                      style={{
                        backgroundColor: COLORS.background.secondary,
                        padding: 12,
                        borderRadius: 8,
                        marginVertical: 4
                      }}>
                      <Text>{process.name}</Text>
                      <View style={styles.processChip}>
                        {outsourcedProcesses.some((p) => p.name === process.name) ? (
                          <TouchableOpacity
                            onPress={() => {
                              // Remove from outsourcedProcesses
                              setOutsourcedProcesses((prev) =>
                                prev.filter((p) => p.name !== process.name)
                              );
                            }}
                            activeOpacity={0.6}>
                            <Image style={{ width: 18, height: 18 }} source={Icons.rightTick} />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => {
                              // Add to outsourcedProcesses
                              setOutsourcedProcesses((prev) => {
                                if (!prev.some((p) => p.name === process.name)) {
                                  return [...prev, { id: Date.now(), name: process.name }];
                                }
                                return prev;
                              });
                            }}
                            activeOpacity={0.6}>
                            <View
                              style={{
                                width: 18,
                                height: 18,
                                borderWidth: 1,
                                borderColor: '#ccc',
                                backgroundColor: COLORS.background.primary,
                                borderRadius: 4
                              }}></View>
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
              <Text style={{ color: COLORS.error.main, marginBottom: 2, fontSize: 12 }}>
                {formErrors.keyProcesses}
              </Text>
            )}
          </View>
          {/* Key Raw Material Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>KEY RAW MATERIAL</Text>
            {rawMaterials?.length > 0
              ? rawMaterials?.map((material, index) => (
                  <View
                    key={material.id ? material.id : `material-${index}`}
                    style={styles.listItemContainer}>
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemNumber}>
                        {String(index + 1).padStart(2, '0')}
                      </Text>
                      <Text style={styles.listItemText}>{material.materialName}</Text>
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        activeOpacity={0.6}
                        style={styles.actionButton}
                        onPress={() => handleEditRawMaterial(material.id, material)}>
                        <Image source={Icons.edit} style={styles.actionIcon} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.6}
                        style={styles.actionButton}
                        onPress={() => handleDeleteRawMaterial(material.id)}>
                        <Image
                          source={Icons.trash}
                          style={[styles.actionIcon, { tintColor: COLORS.error.active }]}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              : null}
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.addButton}
              onPress={() => {
                setEditingRawMaterial(null);
                setAddRawMaterialModalVisible(true);
              }}>
              <Text style={styles.addButtonText}>+ Add Key Raw Material</Text>
            </TouchableOpacity>
            {formErrors.rawMaterials && (
              <Text style={{ color: COLORS.error.main, marginBottom: 2, fontSize: 12 }}>
                {formErrors.rawMaterials}
              </Text>
            )}
          </View>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>BOUGHT-OUT PART</Text>
            {boughtOutParts?.length > 0
              ? boughtOutParts.map((material, index) => (
                  <View
                    key={material.id ? material.id : `material-${index}`}
                    style={styles.listItemContainer}>
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemNumber}>
                        {String(index + 1).padStart(2, '0')}
                      </Text>
                      <Text style={styles.listItemText}>{material?.partName}</Text>
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        activeOpacity={0.6}
                        style={styles.actionButton}
                        onPress={() => handleEditBoughtOutPart(material.id, material)}>
                        <Image source={Icons.edit} style={styles.actionIcon} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.6}
                        style={styles.actionButton}
                        onPress={() => handleDeleteBoughtOutPart(material.id)}>
                        <Image
                          source={Icons.trash}
                          style={[styles.actionIcon, { tintColor: COLORS.error.active }]}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              : null}
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.addButton}
              onPress={() => {
                setEditingBoughtOutPart(null);
                setAddBoughtOutPartModalVisible(true);
              }}>
              <Text style={styles.addButtonText}>+ Add Bought-out Part</Text>
            </TouchableOpacity>
            {formErrors.boughtOutParts && (
              <Text style={{ color: COLORS.error.main, marginBottom: 2, fontSize: 12 }}>
                {formErrors.boughtOutParts}
              </Text>
            )}
          </View>
          {/* Third Party Certifications */}
          <View style={styles.sectionContainer}>
            <View style={styles.processInputContainer}>
              <Text style={styles.fieldLabel}>
                Third Party Certifications
                <Text style={[{ color: COLORS.error.active }]}>*</Text>
              </Text>
              <AutoCompleteInput
                ref={certificationInputRef}
                name={'certificate'}
                value={certificationInput}
                placeholder="e.g. ISO 9001: 2015, ISO 9001: 2018, etc."
                excludeValues={certifications.map((c) => c.name)}
                onSelect={(item) => {
                  Logger.info('Selected Certification:', item);
                  setCertificationInput(item);
                }}
                onChangeText={(text) => {
                  Logger.info('Certification Input Changed:', text);
                  setCertificationInput(text);
                }}
                onDropdownOpen={setAutoCompleteDropdownOpen}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToInput?.(certificationInputRef, 30);
                  }, 100);
                }}
              />
              {certificationInput.trim() && (
                <TouchableOpacity
                  activeOpacity={0.6}
                  style={[styles.addProcessButton]}
                  onPress={handleAddCertification}>
                  <Text style={styles.addProcessButtonText}>Add</Text>
                </TouchableOpacity>
              )}
              {formErrors.certifications && (
                <Text style={{ color: COLORS.error.main, marginBottom: 2, fontSize: 12 }}>
                  {formErrors.certifications}
                </Text>
              )}
            </View>
            {/* Display added certifications */}
            {certifications.length > 0 && (
              <View style={styles.processChipsContainer}>
                {certifications.map((certification, index) => (
                  <View
                    key={certification.id ? certification.id : `certification-${index}`}
                    style={{
                      padding: 10,
                      flexDirection: 'row',
                      backgroundColor: COLORS.background.secondary,
                      borderRadius: 8,
                      marginVertical: 4,
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
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
      {/* Validation Error Messages now shown individually below each field/section */}
      {/* Footer Button */}

      <AppCommonModal
        showmodal={successModal}
        imgsrc={Icons.success}
        title="Basic Information Added"
        subTitle="Your Basic Information has been added successfully."
      />
      {/* Category Selection Modal */}
      <CategorySelectionModal
        visible={categoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
        categories={getCategoryData}
        selectedCategory={formData.category?.categoryName}
        onSelect={handleCategorySelect}
      />
      {/* Store Selection Modal */}
      <StoreSelectionModal
        visible={storeModalVisible}
        onClose={() => setStoreModalVisible(false)}
        stores={getStoreData}
        selectedStores={getSelectedStoreIds()}
        onSave={handleStoreSelect}
      />
      <AddCustomer
        isVisible={addCustomerModalVisible}
        onClose={() => setAddCustomerModalVisible(false)}
        onSelect={handleAddCustomer}
        selectedValue={editingCustomer}
        assessmentId={assessmentId}
        existingCustomers={customers}
      />
      <AddProduct
        isVisible={addProductModalVisible}
        onClose={() => setAddProductModalVisible(false)}
        onSelect={handleAddProduct}
        selectedValue={editingProduct}
        //editingProduct={editingProduct}
        assessmentId={assessmentId}
        existingProducts={products}
      />
      <AddRawMaterial
        isVisible={addRawMaterialModalVisible}
        onClose={() => setAddRawMaterialModalVisible(false)}
        onSelect={handleAddRawMaterial}
        selectedValue={editingRawMaterial}
        assessmentId={assessmentId}
        existingRawMaterials={rawMaterials}
      />
      <AddBoughtOutPart
        isVisible={addBoughtOutPartModalVisible}
        onClose={() => setAddBoughtOutPartModalVisible(false)}
        onSelect={handleAddBoughtOutPart}
        selectedValue={editingBoughtOutPart}
        assessmentId={assessmentId}
        existingBoughtOutParts={boughtOutParts}
      />
      <AppCommonModal
        showmodal={modalOpen}
        imgsrc={Icons.deleteIcon}
        LeftbuttonTextColor={COLORS.button.primary}
        leftButtonColor={'#E2EEFF'}
        title={modaltitle}
        subTitle={modalmessage}
        twoButtonModal={true}
        leftButtonText="Cancel"
        LeftonPress={() => {
          setModalOpen(false);
          setDeleteId(null);
        }}
        rightButtonText="Delete"
        onPress={async () => {
          if (modalType === 'Product' && deleteId) {
            await handleDeleteProduct(deleteId);
          } else if (modalType === 'Customer' && deleteId) {
            await handleDeleteCustomer(deleteId);
          } else if (modalType === 'Raw Material' && deleteId) {
            handleDeleteRawMaterial(deleteId);
          }
          setModalOpen(false);
          setDeleteId(null);
        }}
        leftvariant="secondary"
        variant="danger"
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
  removeStoreText: {
    fontSize: FONT_SIZE.fs10,
    color: COLORS.background.primary,
    fontWeight: 'bold'
  },
  addStoreButton: {
    paddingVertical: 6,
    position: 'absolute',
    right: 0,
    top: 0
  },
  addStoreText: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.primary.main,
    flex: 1,
    fontFamily: FONTS_FAMILY.Medium500
  },
  sectionContainer: {
    ...commonStyles.paddingHorizontal16,
    paddingTop: Responsive.height(20),
    backgroundColor: COLORS.background.primary,
    marginTop: Responsive.height(4),
    paddingBottom: Responsive.height(8)
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
    letterSpacing: 0.2
  },
  inputContainer: {
    marginBottom: Responsive.height(16)
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
  materialInfo: {
    flex: 1
  },
  materialType: {
    ...commonStyles.FontFamily_Regular400,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.tertiary
  },
  materialName: {
    ...commonStyles.FontFamily_Regular400,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    marginTop: Responsive.height(2),
    paddingRight: Responsive.width(25)
  },
  processSubSection: {
    marginTop: Responsive.height(6)
  },
  processLabel: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.primary,
    marginBottom: Responsive.height(8)
  },
  processChipsContainer: {
    flex: 1
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
  processChipClose: {
    width: Responsive.width(16),
    height: Responsive.height(16),
    borderRadius: Responsive.width(8),
    backgroundColor: COLORS.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  processChipCloseText: {
    fontSize: FONT_SIZE.fs10,
    color: COLORS.background.primary,
    fontWeight: 'bold'
  },
  processInputContainer: {
    marginBottom: Responsive.height(12),
    position: 'relative'
  },

  addProcessButtonText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.background.primary
  },
  emptyStateContainer: {
    paddingVertical: Responsive.height(20),
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyStateText: {
    ...commonStyles.FontFamily_Regular400,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.tertiary,
    fontStyle: 'italic'
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
  }
};

export default AddBasicInforamtion;
