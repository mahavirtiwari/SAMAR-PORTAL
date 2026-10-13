import { useState } from 'react';
import { FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../../../assets/theme/Layout';
import { COLORS, FONT_SIZE } from '../../../../assets/theme/Theme';

const SelectCapacityUnitModal = ({ visible, onClose, onSelect, selectedUnit }) => {
  const [tempSelectedUnit, setTempSelectedUnit] = useState(selectedUnit);

  const units = [
    { id: 1, name: 'Kilogram' },
    { id: 2, name: 'Ton' },
    { id: 3, name: 'Litre' },
    { id: 4, name: 'Number' },
    { id: 5, name: 'Meter' }
  ];

  const handleUnitSelect = (unitName) => {
    setTempSelectedUnit(unitName);
    setTimeout(() => {
      onSelect(unitName);
    }, 100);
  };

  const renderUnitItem = ({ item }) => {
    const isSelected = tempSelectedUnit === item.name;

    return (
      <TouchableOpacity
        style={styles.unitItem}
        onPress={() => handleUnitSelect(item.name)}
        activeOpacity={0.6}>
        <Text style={styles.unitName}>{item.name}</Text>
        <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
          {isSelected && <View style={styles.radioButtonInner} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Select Capacity Unit</Text>
          </View>

          {/* Unit List */}
          <View style={styles.listContainer}>
            <FlatList
              data={units}
              renderItem={renderUnitItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              bounces={false}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Responsive.width(20)
  },
  container: {
    backgroundColor: COLORS.background.primary,
    borderRadius: Responsive.width(16),
    width: '100%',
    maxHeight: Responsive.height(400),
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  header: {
    alignItems: 'center',
    paddingVertical: Responsive.height(20),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.regular
  },
  title: {
    fontSize: FONT_SIZE.fs18,
    fontWeight: '600',
    color: COLORS.text.primary
  },
  listContainer: {
    paddingVertical: Responsive.height(8)
  },
  unitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Responsive.width(20),
    paddingVertical: Responsive.height(16)
  },
  unitName: {
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.primary,
    flex: 1
  },
  radioButton: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    borderRadius: Responsive.width(10),
    borderWidth: 2,
    borderColor: COLORS.border.light,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioButtonSelected: {
    borderColor: COLORS.primary.main
  },
  radioButtonInner: {
    width: Responsive.width(10),
    height: Responsive.height(10),
    borderRadius: Responsive.width(5),
    backgroundColor: COLORS.primary.main
  }
};

export default SelectCapacityUnitModal;
