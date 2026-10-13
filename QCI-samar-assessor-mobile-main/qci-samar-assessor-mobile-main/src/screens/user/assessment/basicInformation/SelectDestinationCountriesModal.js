import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
import AppInput from '../../../../components/base/textInput/AppInput';
import { AppBottomSheet } from '../../../../components/shared';
import Icons from '../../../../constants/Icons';
import { Logger } from '../../../../utils';

const SelectDestinationCountriesBottomSheet = forwardRef(
  ({ onSelect, selectedCountries = [], countries, excludeIndia = false }, ref) => {
    const bottomSheetRef = useRef(null);
    const [tempSelectedCountries, setTempSelectedCountries] = useState(selectedCountries || []);
    const [searchText, setSearchText] = useState('');

    // Filter countries based on search text
    const filteredCountries = countries?.filter(
      (country) =>
        country.name.toLowerCase().includes(searchText.toLowerCase()) &&
        (!excludeIndia || country.name.trim().toLowerCase() !== 'india')
    );

    // Prefilled/edited records carry only { name } (no id), so match by id when
    // both sides have one and fall back to normalized name otherwise. Without this
    // the previously selected countries don't highlight when the sheet reopens.
    const normalize = (value) =>
      String(value ?? '')
        .trim()
        .toLowerCase();
    const isSameCountry = (a, b) =>
      a?.id != null && b?.id != null ? a.id === b.id : normalize(a?.name) === normalize(b?.name);

    useEffect(() => {
      setTempSelectedCountries([...selectedCountries]);
    }, [selectedCountries]);

    useImperativeHandle(ref, () => ({
      open: () => {
        setTempSelectedCountries([...selectedCountries]);
        setSearchText('');
        bottomSheetRef.current?.open();
      },
      close: () => {
        bottomSheetRef.current?.close();
      }
    }));

    const handleCountryToggle = (country) => {
      Logger.info('Toggling country selection:', country);
      setTempSelectedCountries((prev) => {
        const isSelected = prev.some((c) => isSameCountry(c, country));
        if (isSelected) {
          return prev.filter((c) => !isSameCountry(c, country));
        } else {
          return [...prev, country];
        }
      });
    };

    const handleSave = () => {
      onSelect(tempSelectedCountries);
      bottomSheetRef.current?.close();
    };

    const handleCancel = () => {
      setTempSelectedCountries(selectedCountries || []);
      setSearchText('');
      bottomSheetRef.current?.close();
    };

    const renderCountryItem = ({ item }) => {
      const isSelected = tempSelectedCountries.some((c) => isSameCountry(c, item));

      return (
        <TouchableOpacity
          style={styles.countryItem}
          onPress={() => handleCountryToggle(item)}
          activeOpacity={0.6}>
          <Text style={styles.countryName}>{item.name}</Text>
          <Image
            source={!isSelected ? Icons.radioUnchecked : Icons.radioChecked}
            style={[commonStyles.iconSize20]}
            resizeMode="contain"
          />
          {/* </View> */}
        </TouchableOpacity>
      );
    };

    return (
      <AppBottomSheet
        ref={bottomSheetRef}
        snapPoints={['70%']}
        headerComponent={
          <View style={[styles.header]}>
            <Text style={styles.headerTitle}>Select Destination Countries</Text>
            {/* <View style={styles.placeholder} /> */}
          </View>
        }>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <AppInput
            heightInput={40}
            InputIcon={Icons.search}
            style={styles.searchInput}
            placeholderText="Search..."
            placeholderTextColor={COLORS.text.tertiary}
            value={searchText}
            onChange={setSearchText}
            cap="none"
          />
        </View>

        {/* Countries List */}
        <View style={styles.listContainer}>
          {filteredCountries.length > 0 ? (
            <FlatList
              data={filteredCountries}
              renderItem={renderCountryItem}
              keyExtractor={(item) => item.id.toString()}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={commonStyles.bodyLargePrimary700}>No results found</Text>
              <Text
                style={[
                  commonStyles.bodySmallPrimary400,
                  { textAlign: 'center', marginTop: Responsive.height(8) }
                ]}>
                Try searching with a different country name or check your spelling.
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <View style={[commonStyles.fill]}>
            <AppButton
              size="medium"
              variant="soft"
              title="Cancel"
              onPress={handleCancel}
              // disabled={!tempSelectedDate}
            />
          </View>
          <View style={[commonStyles.fill]}>
            <AppButton
              size="medium"
              variant="primary"
              title="Select"
              onPress={handleSave}
              // disabled={!tempSelectedDate}
            />
          </View>
        </View>
      </AppBottomSheet>
    );
  }
);

const styles = {
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Responsive.width(20),
    paddingTop: Responsive.height(5),
    paddingBottom: Responsive.height(16),
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
    color: COLORS.text.primary,
    ...commonStyles.FontFamily_SemiBold600,
    textAlign: 'center',
    flex: 1
  },
  placeholder: {
    width: Responsive.width(24)
  },
  searchContainer: {
    paddingHorizontal: Responsive.width(20),
    paddingVertical: Responsive.height(16),
    backgroundColor: COLORS.background.primary
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.secondary,
    borderRadius: BORDER_RADIUS.br12,
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(12),
    borderWidth: 1,
    borderColor: COLORS.border.light
  },
  searchIcon: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    tintColor: COLORS.text.placeholder,
    marginRight: Responsive.width(12)
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.primary,
    ...commonStyles.FontFamily_Medium500,
    paddingVertical: 0
  },
  clearButton: {
    padding: Responsive.width(4)
  },
  clearIcon: {
    width: Responsive.width(16),
    height: Responsive.height(16),
    tintColor: COLORS.text.placeholder
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
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Responsive.height(16),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light
  },
  countryName: {
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.primary,
    ...commonStyles.FontFamily_Medium500,
    flex: 1
  },
  checkbox: {
    width: Responsive.width(24),
    height: Responsive.height(24),
    borderRadius: Responsive.width(12),
    borderWidth: 2,
    borderColor: COLORS.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background.primary
  },
  checkboxSelected: {
    borderColor: COLORS.primary.main,
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
    // paddingBottom: Responsive.height(24),
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
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Responsive.width(20)
  }
};

export default SelectDestinationCountriesBottomSheet;
