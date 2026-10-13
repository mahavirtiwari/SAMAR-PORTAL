import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../../../assets/theme/Theme';
import AppInput from '../../../../components/base/textInput/AppInput';
import { AppBottomSheet } from '../../../../components/shared';
import Icons from '../../../../constants/Icons';

const DestinationCountriesBottomSheet = forwardRef(
  (
    {
      onSelect,
      selectedCountries = [],
      multipleSelection = true, // New prop to control selection mode
      title = 'Select Destination Countries', // Customizable title
      excludeIndia = false
    },
    ref
  ) => {
    const { countriesList } = useSelector((state) => state.basicInformation);

    const bottomSheetRef = useRef(null);
    const [searchText, setSearchText] = useState('');
    const [tempSelectedCountries, setTempSelectedCountries] = useState([...selectedCountries]);

    useEffect(() => {
      setTempSelectedCountries([...selectedCountries]);
    }, [selectedCountries]);
    // Normalize so a stored value highlights its row even if casing/whitespace differs
    // from the master-list name (e.g. prefilled/edited records or server responses).
    const normalize = (value) =>
      String(value ?? '')
        .trim()
        .toLowerCase();
    const isCountrySelected = (countryName) =>
      tempSelectedCountries.some((selected) => normalize(selected) === normalize(countryName));
    const filteredCountries = countriesList.filter(
      (country) =>
        country?.name?.toLowerCase().includes(searchText.toLowerCase()) &&
        (!excludeIndia || country?.name?.trim().toLowerCase() !== 'india')
    );

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

    const toggleCountrySelection = (countryName) => {
      if (multipleSelection) {
        // Multiple selection mode (existing behavior)
        setTempSelectedCountries((prev) => {
          if (prev.some((name) => normalize(name) === normalize(countryName))) {
            return prev.filter((name) => normalize(name) !== normalize(countryName));
          } else {
            return [...prev, countryName];
          }
        });
      } else {
        // Single selection mode
        setTempSelectedCountries([countryName]);
        // For single selection, automatically save and close
        onSelect([countryName]);
        setSearchText('');
        bottomSheetRef.current?.close();
      }
    };

    const handleCancel = () => {
      setTempSelectedCountries([...selectedCountries]);
      setSearchText('');
      bottomSheetRef.current?.close();
    };

    const handleSave = () => {
      onSelect(tempSelectedCountries);
      setSearchText('');
      bottomSheetRef.current?.close();
    };

    const renderCountryItem = ({ item }) => {
      const isSelected = isCountrySelected(item.name);

      return (
        <TouchableOpacity
          style={styles.countryItem}
          onPress={() => toggleCountrySelection(item.name)}
          activeOpacity={0.6}>
          <Text style={styles.countryName}>{item.name}</Text>
          {multipleSelection ? (
            // Show checkbox for multiple selection
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Image source={Icons.checkmark} style={styles.checkIcon} />}
            </View>
          ) : (
            // Show radio button for single selection
            <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
              {isSelected && <View style={styles.radioButtonInner} />}
            </View>
          )}
        </TouchableOpacity>
      );
    };

    return (
      <AppBottomSheet ref={bottomSheetRef} snapPoints={['70%']}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
          </View>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <AppInput
              heightInput={Responsive.height(40)}
              InputIcon={Icons.search}
              style={styles.searchInput}
              placeholderText="Search..."
              placeholderTextColor={COLORS.text.tertiary}
              value={searchText}
              onChange={setSearchText}
              cap="none"
            />
          </View>
          {/* Country List */}
          <View style={styles.listContainer}>
            {filteredCountries.length > 0 ? (
              <FlatList
                data={filteredCountries}
                renderItem={renderCountryItem}
                keyExtractor={(item) => item.iso}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: Responsive.width(20)
                }}>
                <Text style={commonStyles.bodyLargePrimary700}>No Result found.</Text>
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
          {/* Footer Buttons - Only show for multiple selection */}
          {multipleSelection && (
            <View style={styles.footer}>
              <TouchableOpacity
                activeOpacity={0.6}
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.6}
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </AppBottomSheet>
    );
  }
);

const styles = {
  container: {
    flex: 1
  },
  header: {
    alignItems: 'center',
    paddingTop: Responsive.height(5),
    paddingBottom: Responsive.height(15),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light
  },
  title: {
    fontSize: FONT_SIZE.fs18,
    fontWeight: '600',
    color: COLORS.text.primary
  },
  searchContainer: {
    paddingHorizontal: Responsive.width(16),
    marginVertical: Responsive.height(16)
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.secondary,
    borderRadius: Responsive.width(8),
    paddingHorizontal: Responsive.width(12),
    paddingVertical: Responsive.height(12)
  },
  searchIcon: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    tintColor: COLORS.text.tertiary,
    marginRight: Responsive.width(8)
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
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Responsive.height(16),
    paddingHorizontal: Responsive.width(4)
  },
  countryName: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    flex: 1
  },
  checkbox: {
    width: Responsive.width(24),
    height: Responsive.height(24),
    borderRadius: Responsive.width(12),
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
    paddingVertical: Responsive.height(14),
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

export default DestinationCountriesBottomSheet;
