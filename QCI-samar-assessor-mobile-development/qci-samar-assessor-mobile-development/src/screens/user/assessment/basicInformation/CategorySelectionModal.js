import { useEffect, useState } from 'react';
import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { COLORS, FONT_SIZE, SPACING } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
import { Header } from '../../../../components/layout';
import { AppModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';

const CategorySelectionModal = ({
  visible,
  onClose,
  categories = [],
  selectedCategory = null,
  onSelect
}) => {
  const [searchText, setSearchText] = useState('');
  const [tempSelectedCategory, setTempSelectedCategory] = useState(selectedCategory);

  useEffect(() => {
    if (visible) {
      setTempSelectedCategory(selectedCategory);
      setSearchText('');
    }
  }, [visible, selectedCategory]);

  const filteredCategories = categories?.filter((category) =>
    category?.categoryName?.includes(searchText?.toLowerCase())
  );
  const handleCategorySelect = (categoryId) => {
    setTempSelectedCategory(categoryId);
  };

  const handleCancel = () => {
    setTempSelectedCategory(selectedCategory);
    setSearchText('');
    onClose();
  };

  const handleSelect = () => {
    if (tempSelectedCategory) {
      const selectedCategoryData = categories.find(
        (cat) => cat.categoryName === tempSelectedCategory
      );
      onSelect(selectedCategoryData);
    }
    setSearchText('');
    onClose();
  };

  const renderCategoryItem = ({ item, index }) => {
    const isSelected = tempSelectedCategory === item.categoryName;

    return (
      <TouchableOpacity
        style={[
          styles.categoryItem,
          {
            borderBottomWidth: index < filteredCategories.length - 1 ? 1 : 0,
            borderBottomColor: COLORS.border.light
          }
        ]}
        onPress={() => handleCategorySelect(item.categoryName)}
        activeOpacity={0.6}>
        <Text style={styles.categoryText}>{item.categoryName}</Text>
        <Image
          source={isSelected ? Icons.radioBtn : Icons.radioUnchecked}
          style={[commonStyles.iconSize20]}
        />
      </TouchableOpacity>
    );
  };

  return (
    <AppModal visible={visible}>
      <View style={styles.container}>
        <Header title={'Select Category'} close={true} onPress={handleCancel} />
        <View style={styles.listContainer}>
          <FlatList
            data={filteredCategories}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        </View>
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
              onPress={handleSelect}
              disabled={!tempSelectedCategory}
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
    backgroundColor: COLORS.background.primary
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
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Responsive.width(8),
    paddingVertical: Responsive.height(16)
  },
  categoryText: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.primary,
    flex: 1
  },
  radioButton: {
    width: Responsive.width(24),
    height: Responsive.height(24),
    borderRadius: Responsive.width(12),
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
    width: Responsive.width(12),
    height: Responsive.height(12),
    borderRadius: Responsive.width(6),
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
    paddingVertical: Responsive.height(12),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Responsive.width(8)
  },
  cancelButton: {
    backgroundColor: COLORS.background.secondary
  },
  selectButton: {
    backgroundColor: COLORS.primary.main
  },
  cancelButtonText: {
    fontSize: FONT_SIZE.fs16,
    fontWeight: '600',
    color: COLORS.text.secondary
  },
  selectButtonText: {
    fontSize: FONT_SIZE.fs16,
    fontWeight: '600',
    color: COLORS.background.primary
  }
};

export default CategorySelectionModal;
