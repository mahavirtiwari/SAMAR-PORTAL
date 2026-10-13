import { useEffect, useState } from 'react';
import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { COLORS, FONT_SIZE, SPACING } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
import AppInput from '../../../../components/base/textInput/AppInput';
import { Header } from '../../../../components/layout';
import { AppModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';

const StoreSelectionModal = ({ visible, onClose, stores = [], selectedStores = [], onSave }) => {
  const [searchText, setSearchText] = useState('');
  // Working selection holds store NAMES (the identity used by toggle/isSelected).
  const [tempSelectedStores, setTempSelectedStores] = useState([]);

  // Re-initialise the working selection from the committed selection every time
  // the modal OPENS. Without this, a Cancel (which never commits) left stale
  // state behind, so reopening showed nothing selected and the next pick wiped
  // the earlier choices. Keying on `visible` makes each open start clean from
  // whatever was last saved.
  useEffect(() => {
    if (visible) {
      setTempSelectedStores(selectedStores.map((item) => item?.storeName).filter(Boolean));
      setSearchText('');
    }
  }, [visible, selectedStores]);

  // Show selected stores at the top, even when searching
  const filteredStores = stores?.filter((store) =>
    store?.storeName?.toLowerCase().includes(searchText?.toLowerCase())
  );

  // If searching, show selected stores first (even if they don't match search), then matching unselected stores
  const displayStores = searchText.trim()
    ? [
        ...stores.filter((store) => tempSelectedStores.includes(store.storeName)), // All selected stores
        ...filteredStores.filter((store) => !tempSelectedStores.includes(store.storeName)) // Unselected stores that match search
      ]
    : stores; // If no search, show all stores

  const toggleStoreSelection = (storeId) => {
    setTempSelectedStores((prev) => {
      if (prev.includes(storeId)) {
        return prev.filter((id) => id !== storeId);
      } else {
        return [...prev, storeId];
      }
    });
  };

  const handleCancel = () => {
    // Revert the working selection back to the committed one (as NAMES), so
    // discarded changes don't leak into the next open.
    setTempSelectedStores(selectedStores.map((item) => item?.storeName).filter(Boolean));
    setSearchText('');
    onClose();
  };

  const handleSave = () => {
    const selectedStoreData = stores.filter((store) =>
      tempSelectedStores.includes(store.storeName)
    );
    onSave(selectedStoreData);
    setSearchText('');
    onClose();
  };

  const renderStoreItem = ({ item, index }) => {
    const isSelected = tempSelectedStores.includes(item.storeName);
    return (
      <TouchableOpacity
        style={[
          styles.storeItem,
          {
            borderBottomWidth: index < displayStores.length - 1 ? 1 : 0,
            borderBottomColor: COLORS.border.light
          }
        ]}
        onPress={() => toggleStoreSelection(item.storeName)}
        activeOpacity={0.6}>
        <Text style={styles.storeText}>{item.storeName}</Text>
        <Image
          source={isSelected ? Icons.radioChecked : Icons.radioUnchecked}
          style={[commonStyles.iconSize20]}
        />
      </TouchableOpacity>
    );
  };

  return (
    <AppModal visible={visible}>
      <View style={styles.container}>
        <Header title="Select Store" close={true} onPress={handleCancel} />
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <AppInput
            heightInput={Responsive.height(40)}
            InputIcon={Icons.search}
            style={styles.searchInput}
            placeholderText="Search Store..."
            placeholderTextColor={COLORS.text.placeholder}
            value={searchText}
            onChange={setSearchText}
            cap="none"
          />
        </View>

        {/* Store List */}
        <View style={styles.listContainer}>
          {displayStores.length > 0 ? (
            <FlatList
              data={displayStores}
              renderItem={renderStoreItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            <View
              style={[
                {
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: SPACING.sp8,
                  padding: 16
                }
              ]}>
              <Text style={commonStyles.bodyLargePrimary700}>No results found</Text>
              <Text style={[commonStyles.bodySmallPrimary400, { textAlign: 'center' }]}>
                Try searching with a different store name or check your spelling.
              </Text>
            </View>
          )}
        </View>

        {/* Footer Buttons */}
        <View
          style={[
            commonStyles.row,
            commonStyles.paddingHorizontal16,
            commonStyles.paddingVertical16,
            { gap: SPACING.sp10, borderTopWidth: 1, borderTopColor: COLORS.border.light }
          ]}>
          <View style={[commonStyles.fill]}>
            <AppButton size="large" variant="soft" title="Cancel" onPress={handleCancel} />
          </View>
          <View style={[commonStyles.fill]}>
            <AppButton
              size="large"
              variant="primary"
              title="Select"
              onPress={handleSave}
              disabled={tempSelectedStores?.length === 0}
            />
          </View>
        </View>
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
  searchContainer: {
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16)
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.secondary,
    borderRadius: Responsive.width(12),
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(12)
  },
  searchIcon: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    tintColor: COLORS.text.tertiary,
    marginRight: Responsive.width(12)
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.primary,
    padding: 0
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: Responsive.width(16)
  },
  listContent: {
    paddingBottom: Responsive.height(20)
  },
  storeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Responsive.height(16)
  },
  storeText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.primary,
    flex: 1
  },
  checkbox: {
    width: Responsive.width(24),
    height: Responsive.height(24),
    borderRadius: Responsive.width(4),
    borderWidth: 2,
    borderColor: COLORS.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background.primary
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary.main,
    borderColor: COLORS.primary.main
  },
  checkIcon: {
    width: Responsive.width(12),
    height: Responsive.height(12),
    tintColor: COLORS.background.primary
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16),
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    gap: Responsive.width(12)
  },
  button: {
    flex: 1,
    paddingVertical: Responsive.height(12),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Responsive.width(8)
  },
  cancelButton: {
    backgroundColor: COLORS.background.secondary
  },
  saveButton: {
    backgroundColor: COLORS.primary.main
  },
  cancelButtonText: {
    fontSize: FONT_SIZE.fs16,
    fontWeight: '600',
    color: COLORS.text.secondary
  },
  saveButtonText: {
    fontSize: FONT_SIZE.fs16,
    fontWeight: '600',
    color: COLORS.background.primary
  }
};

export default StoreSelectionModal;
