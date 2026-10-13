import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  FONTS_FAMILY,
  SPACING
} from '../../../../assets/theme/Theme';
import { Header } from '../../../../components/layout';
import ScreenLoader from '../../../../components/shared/ScreenLoader';
import { getBasicInformationAction } from '../../../../redux/action/basicInformationAction';
import { isInitialLoad } from '../../../../utils';

const Tag = ({ label }) => (
  <View style={styles.tag}>
    <Text style={styles.tagText}>{label}</Text>
  </View>
);

const SectionRow = ({ index, label, value }) => (
  <View style={styles.row}>
    <Text style={styles.index}>0{index}</Text>
    <View style={styles.rowTextBox}>
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
  </View>
);

const BasicInformation = ({ route }) => {
  const dispatch = useDispatch();
  const { assessmentId } = route.params;

  useEffect(() => {
    dispatch(getBasicInformationAction(assessmentId));
  }, [assessmentId, dispatch]);

  const { basicInformation, basicInformationLoading, basicInformationError } = useSelector(
    (state) => state.basicInformation
  );

  if (isInitialLoad(basicInformationLoading, basicInformation, basicInformationError)) {
    return (
      <View style={styles.container}>
        <Header title="Basic Information" back={true} />
        <ScreenLoader />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Basic Information" back={true} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Category */}
        <View style={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Category</Text>
          <Text style={styles.sectionValue}>{basicInformation?.basicInformation?.category}</Text>
          {/* Store */}
          <Text style={styles.sectionTitle}>Store</Text>
          <View style={styles.tagRow}>
            {basicInformation?.basicInformation?.mfgDrdoVendorStores?.map((store, index) => (
              <Tag key={index} label={store.storeName} />
            ))}
          </View>
        </View>
        <View style={styles.line}></View>
        {/* PRODUCT / ARTICLES */}
        <View style={styles.scrollContent}>
          <Text style={styles.bigSectionTitle}>PRODUCTS / ARTICLES DETAILS</Text>
          {basicInformation?.basicInformation?.mfgProducts?.map((product, index) => (
            <SectionRow
              key={index}
              index={index + 1}
              label={product.productName}
              value={product.productDescription}
            />
          ))}
        </View>
        <View style={styles.line}></View>
        {/* CUSTOMERS */}
        <View style={styles.scrollContent}>
          <Text style={styles.bigSectionTitle}>CUSTOMER DETAILS</Text>
          {basicInformation?.basicInformation?.customers?.map((customer, index) => (
            <SectionRow
              key={index}
              index={index + 1}
              label={customer.customerName}
              value={customer.customerDescription}
            />
          ))}
        </View>
        <View style={styles.line}></View>
        {/* PROCESSES */}
        <View style={styles.scrollContent}>
          <Text style={styles.bigSectionTitle}>PROCESSES</Text>
          <Text style={styles.subHeading}>Key Processes</Text>
          <View style={styles.tagRow}>
            {basicInformation?.basicInformation?.mfgKeyProcesses?.map((process, index) => (
              <Tag key={index} label={process.processName} />
            ))}
          </View>
          <Text style={styles.subHeading}>Outsourced Processes</Text>
          <View style={styles.tagRow}>
            {basicInformation?.basicInformation?.mfgOutsourcedProcesses?.map((process, index) => (
              <Tag key={index} label={process.processName} />
            ))}
          </View>
        </View>
        <View style={styles.line}></View>
        {/* RAW MATERIAL */}
        <View style={styles.scrollContent}>
          <Text style={styles.bigSectionTitle}>KEY RAW MATERIAL</Text>
          {basicInformation?.basicInformation?.mfgRawMaterials?.map((material, index) => (
            <SectionRow
              key={index}
              index={index + 1}
              label={material.materialName}
              value={material.materialName}
            />
          ))}
        </View>
        <View style={styles.line}></View>
        <View style={styles.scrollContent}>
          <Text style={styles.bigSectionTitle}>Bought-out Part</Text>
          {basicInformation?.basicInformation?.mfgBoughtOutParts?.map((material, index) => (
            <SectionRow
              key={index}
              index={index + 1}
              label={material.partName}
              value={material.partName}
            />
          ))}
        </View>
        <View style={styles.line}></View>
        {/* Certifications */}
        <View style={styles.scrollContent}>
          <Text style={styles.bigSectionTitle}>Third Party Certifications</Text>
          <View style={styles.tagRow}>
            {basicInformation?.basicInformation?.thirdPartyCertificationNames?.map(
              (certification, index) => (
                <Tag key={index} label={certification} />
              )
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default BasicInformation;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
    paddingVertical: Responsive.height(16)
  },
  scrollContent: {
    paddingHorizontal: Responsive.width(16)
  },
  line: { backgroundColor: COLORS.background.accent, height: Responsive.height(3), marginTop: 15 },
  bigSectionTitle: {
    marginTop: Responsive.height(16),
    fontSize: FONT_SIZE.fs13,
    fontFamily: FONTS_FAMILY.Bold700,
    color: COLORS.text.secondary
  },
  sectionTitle: {
    fontSize: FONT_SIZE.fs14,
    fontFamily: FONTS_FAMILY.SemiBold600,
    color: COLORS.text.secondary,
    marginTop: Responsive.height(16)
  },
  sectionValue: {
    fontSize: FONT_SIZE.fs16,
    fontFamily: FONTS_FAMILY.SemiBold600,
    color: COLORS.text.heading,
    marginTop: Responsive.height(4)
  },
  tagRow: {
    ...commonStyles.row,
    flexWrap: 'wrap',
    marginTop: Responsive.height(5),
    gap: SPACING.sp8
  },
  tag: {
    paddingVertical: Responsive.height(6),
    paddingHorizontal: Responsive.width(12),
    backgroundColor: COLORS.background.secondary,
    borderRadius: BORDER_RADIUS.br8
  },
  tagText: {
    fontSize: FONT_SIZE.fs12,
    fontFamily: FONTS_FAMILY.Regular400,
    color: COLORS.text.heading
  },
  row: {
    ...commonStyles.row,
    marginTop: Responsive.height(14)
  },
  index: {
    fontSize: FONT_SIZE.fs14,
    fontFamily: FONTS_FAMILY.Bold700,
    color: COLORS.text.tertiary,
    width: Responsive.width(30)
  },
  rowTextBox: {
    flex: 1
  },
  rowLabel: {
    fontSize: FONT_SIZE.fs16,
    fontFamily: FONTS_FAMILY.Regular400,
    color: COLORS.text.heading
  },
  rowValue: {
    fontSize: FONT_SIZE.fs14,
    fontFamily: FONTS_FAMILY.Regular400,
    color: COLORS.text.secondary,
    marginTop: Responsive.height(4)
  },
  subHeading: {
    fontSize: FONT_SIZE.fs13,
    marginTop: Responsive.height(12),
    fontFamily: FONTS_FAMILY.SemiBold600,
    color: COLORS.text.secondary
  }
});
