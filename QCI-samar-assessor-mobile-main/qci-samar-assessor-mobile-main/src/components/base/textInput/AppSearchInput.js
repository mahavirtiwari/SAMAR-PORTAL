import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Image, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../../assets/theme/Layout';
import { layout } from '../../../assets/theme/Styles';
import { BORDER_RADIUS, BORDER_WIDTH, COLORS, FONTS_FAMILY } from '../../../assets/theme/Theme';
import Icons from '../../../constants/Icons';

const AppSearchInput = ({ onchange, placeholderText }) => {
  const [categorySearch, setCategorySearch] = useState('');

  const handleTextChange = (text) => {
    onchange(text);
    setCategorySearch(text);
  };

  useFocusEffect(
    useCallback(() => {
      setCategorySearch('');
      return () => undefined;
    }, [])
  );

  return (
    <View style={styles.searchContainer}>
      <TouchableOpacity activeOpacity={0.6} style={styles.searchInput}>
        <View style={layout.center}>
          <Image source={Icons.search} style={styles.searchIcon} />
        </View>
        <View style={layout.fill}>
          <TextInput
            returnKeyType="done"
            placeholder={placeholderText ? placeholderText : 'Search by name'}
            placeholderTextColor={COLORS.text.placeholder}
            style={styles.textInput}
            onChangeText={handleTextChange}
            value={categorySearch}
          />
        </View>
        {categorySearch.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => handleTextChange('')}
            style={[layout.center, { paddingRight: Responsive.width(15) }]}>
            <Image source={Icons.crossIcon} style={layout.iconSize20} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default AppSearchInput;

const styles = StyleSheet.create({
  searchContainer: {
    backgroundColor: COLORS.background.primary,
    paddingVertical: Responsive.height(10)
  },
  searchInput: {
    backgroundColor: COLORS.background.secondary,
    borderColor: COLORS.border.borderRegular,
    borderRadius: BORDER_RADIUS.br8,
    borderWidth: BORDER_WIDTH.borderWidth.thin,
    ...layout.row,
    height: 45,
    marginHorizontal: Responsive.width(20)
  },
  searchIcon: {
    height: Responsive.height(16),
    marginLeft: Responsive.width(15),
    resizeMode: 'contain',
    width: Responsive.width(16)
  },
  textInput: {
    color: COLORS.text.primary,
    fontSize: Responsive.font(13),
    fontFamily: FONTS_FAMILY.Medium500,
    marginLeft: Platform.select({
      ios: Responsive.width(15),
      android: Responsive.width(10)
    }),
    height: 45,
    paddingVertical: 0
  }
});
