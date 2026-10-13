import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE } from '../../../../assets/theme/Theme';
import AppEmptyState from '../../../../components/base/AppEmptyState';
import { Header } from '../../../../components/layout';
import ScreenLoader from '../../../../components/shared/ScreenLoader';
import Icons from '../../../../constants/Icons';
import Images from '../../../../constants/Images';
import { getMyAssessmentsAction } from '../../../../redux/action/assessmentParameterAction';
import { getAssessmentResponsesAction } from '../../../../redux/action/assessmentResponseAction';
import { isInitialLoad } from '../../../../utils';

const AssessmentParametersList = ({ route }) => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { assessmentId, readOnly = false } = route.params || {};

  useEffect(() => {
    dispatch(getMyAssessmentsAction(assessmentId));
  }, [dispatch, assessmentId]);

  // Only the responses change while this screen is away (answering a
  // parameter). Step progress is refreshed by the steps screen on its own
  // focus, and the assessment header belongs to that screen too: nothing here
  // reads it.
  useFocusEffect(
    useCallback(() => {
      dispatch(getAssessmentResponsesAction(assessmentId));
    }, [dispatch, assessmentId])
  );

  const { myAssessments, myAssessmentsLoading, myAssessmentsError } = useSelector(
    (state) => state.assessmentParameter
  );
  const { assessmentResponses } = useSelector((state) => state.assessmentResponse);

  const handleParameterPress = useCallback(
    (parameter, IndividualParameter) => {
      navigation.navigate('AssessmentParametersDetails', {
        parameterTitle: parameter,
        parameterData: parameter,
        IndividualParameter,
        // Carried through so the answer screen knows this is the post-punch-out
        // review pass; the list itself captures nothing, so it needs no gating.
        readOnly
      });
    },
    [navigation, readOnly]
  );

  const responseStatusById = useMemo(() => {
    const byId = new Map();
    for (const resp of assessmentResponses?.parameters || []) {
      const questions = resp.questions || [];
      byId.set(resp.id, {
        count: questions.filter((q) => q.response !== null).length,
        IndividualParameter: questions
      });
    }
    return byId;
  }, [assessmentResponses]);

  const renderParameterItem = useCallback(
    ({ item }) => {
      const { count, IndividualParameter } = responseStatusById.get(item.id) || EMPTY_STATUS;
      return (
        <ParameterRow
          item={item}
          count={count}
          questions={IndividualParameter}
          onPress={handleParameterPress}
        />
      );
    },
    [responseStatusById, handleParameterPress]
  );

  return (
    <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
      <Header title="Assessment Parameters" back={true} />
      {isInitialLoad(myAssessmentsLoading, myAssessments, myAssessmentsError) ? (
        // First load still in flight (or not yet started) — show a loader
        // instead of flashing the empty state before the parameters arrive.
        <View style={styles.loaderContainer}>
          <ScreenLoader />
        </View>
      ) : !myAssessments?.parameters || myAssessments?.parameters?.length === 0 ? (
        <AppEmptyState
          EmptyImage={Images.emptyAssessmentParameters}
          heading="No Parameters Assigned"
          subHeading="No parameters have been assigned to you for this assessment"
        />
      ) : (
        // The list scrolls itself: wrapped in a ScrollView it would lose row
        // virtualization and mount every parameter before the first paint.
        <FlatList
          data={myAssessments.parameters}
          renderItem={renderParameterItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          windowSize={7}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={ItemSeparator}
        />
      )}
    </View>
  );
};

const EMPTY_STATUS = { count: 0, IndividualParameter: [] };
const keyExtractor = (item) => item.id.toString();
const ItemSeparator = () => <View style={styles.separator} />;

// Memoized so a responses refresh re-renders only the rows whose count changed.
const ParameterRow = memo(({ item, count, questions, onPress }) => {
  const total = item.questions?.length || 0;
  const isChecked = count === total && count !== 0;
  return (
    <TouchableOpacity
      style={styles.parameterItem}
      onPress={() => onPress(item, questions)}
      activeOpacity={0.6}>
      <View style={styles.rowLeft}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: isChecked ? COLORS.success.light : COLORS.warning.light }
          ]}>
          <Image
            source={isChecked ? Icons.tickGreenCircle : Icons.clock}
            style={commonStyles.iconSize20}
            tintColor={isChecked ? COLORS.success.main : COLORS.warning.main}
          />
        </View>
        <View style={commonStyles.fill}>
          <Text style={styles.parameterTitle} numberOfLines={2}>
            {item.name}
          </Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.progressText}>
          {count}/{total}
        </Text>
        <Image source={Icons.arrowSquareRight} style={commonStyles.iconSize18} />
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  rowLeft: {
    ...commonStyles.row,
    alignItems: 'center',
    flex: 1,
    gap: 12
  },
  rowRight: {
    ...commonStyles.row,
    alignItems: 'center',
    gap: 12
  },
  iconBox: {
    ...commonStyles.center,
    width: Responsive.width(36),
    height: Responsive.height(36),
    borderRadius: BORDER_RADIUS.br8
  },
  listContent: {
    ...commonStyles.paddingHorizontal16,
    paddingVertical: Responsive.height(20)
  },
  separator: {
    height: Responsive.height(8)
  },
  parameterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Responsive.width(10),
    paddingVertical: Responsive.height(10),
    borderRadius: BORDER_RADIUS.br10,
    backgroundColor: COLORS.background.primary
  },
  parameterTitle: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    ...commonStyles.FontFamily_SemiBold600
  },
  progressText: {
    fontSize: FONT_SIZE.fs12,
    ...commonStyles.FontFamily_SemiBold600,
    color: COLORS.text.secondary,
    marginLeft: Responsive.width(4)
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default AssessmentParametersList;
