import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { COLORS, FONT_SIZE, FONTS_FAMILY } from '../../../../assets/theme/Theme';
import { Header } from '../../../../components/layout';
import UserInitial from '../../../../components/shared/UserInitial';
import { getAssessmentResponsesAction } from '../../../../redux/action/assessmentResponseAction';
import { Logger } from '../../../../utils/logger';

const ViewAllComments = ({ assessmentId, type, onClose, visible }) => {
  const dispatch = useDispatch();

  const [_commentsData, _setCommentsData] = useState([]);
  const [error, _setError] = useState(null);

  useEffect(() => {
    // Force a server fetch: the punch-in-window local mirror holds only this
    // device's own responses, so co-assessor remarks would be missing here.
    dispatch(getAssessmentResponsesAction({ assessmentId, forceRemote: true }));
  }, []);
  const { assessmentResponses } = useSelector((state) => state.assessmentResponse);

  const getColorForRole = (role) => {
    const colors = {
      lead_assessor: '#7C3AED',
      co_assessor: '#2563EB',
      assessor: '#059669',
      default: '#6B7280'
    };
    return colors[role?.toLowerCase()] || colors.default;
  };

  Logger.info('Formatted Comments Data:', assessmentResponses);
  // Build a list of parameters. Within each parameter, group the remarks by
  // assessor so the assessor (avatar/name/role) is shown ONCE, with all of that
  // assessor's comments for the parameter listed beneath it.
  const parameterComments = (assessmentResponses?.parameters || [])
    .map((parameter) => {
      const assessorMap = new Map();
      (parameter.questions || [])
        .filter((q) => q?.response?.assessorRemarks && q?.response?.assessorRemarks.trim() !== '')
        .forEach((q) => {
          const user = q.response?.assessor || {};
          const name = user?.name || '';
          const role = user?.role;
          // Group by assessor id when present, else fall back to name+role.
          const key = user?.id ?? `${name}|${role}`;
          if (!assessorMap.has(key)) {
            const nameParts = name.trim().split(/\s+/).filter(Boolean);
            const firstName = nameParts[0] || '';
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
            const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
            assessorMap.set(key, {
              id: key,
              name,
              firstName,
              lastName,
              role,
              initials,
              color: getColorForRole(role),
              comments: []
            });
          }
          assessorMap.get(key).comments.push({
            id: q.id || Math.random().toString(),
            text: q.response.assessorRemarks
          });
        });
      const assessors = Array.from(assessorMap.values());
      return assessors.length > 0
        ? {
            parameterId: parameter.id,
            parameterName: parameter.name,
            assessors
          }
        : null;
    })
    .filter(Boolean);

  Logger.info('Parameter Comments:', parameterComments);
  // One assessor block: header (avatar/name/role) shown once, then every comment
  // that assessor left on this parameter.
  const CommentCard = ({ item }) => {
    return (
      <>
        <View style={styles.commentRow}>
          <UserInitial name={item?.firstName} lastName={item?.lastName} role={item.role} />
          <View style={styles.commentContent}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.role}>
              {item.role === 'Lead Assessor' || item.role === 'lead_assessor'
                ? 'Lead Assessor'
                : 'Co Assessor'}
            </Text>
          </View>
        </View>
        <View style={{ marginBottom: Responsive.height(14) }}>
          {item.comments.map((c, idx) => (
            <React.Fragment key={c.id}>
              {idx > 0 && <View style={styles.commentDivider} />}
              <Text style={styles.comment}>{c.text}</Text>
            </React.Fragment>
          ))}
        </View>
      </>
    );
  };

  const SectionItem = ({ item, index, isLast }) => {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIndex}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={styles.sectionTitle}>{item.parameterName}</Text>
          </View>
          {item.assessors && item.assessors.length > 0 ? (
            item.assessors.map((assessor, idx) => (
              <View key={assessor.id}>
                <CommentCard item={assessor} />
                {idx !== item.assessors.length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: COLORS.border.light,
                      marginBottom: Responsive.height(8),
                      marginLeft: Responsive.width(52) // aligns with comment content
                    }}
                  />
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noComments}>No comments for this parameter</Text>
          )}
        </View>
        {!isLast && (
          <View
            style={{
              height: 4,
              backgroundColor: COLORS.border.light,
              marginBottom: Responsive.height(12)
            }}
          />
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>No comments found</Text>
    </View>
  );

  if (error) {
    return (
      <View style={commonStyles.container}>
        <Header title="All Comments" close={true} onPress={onClose} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[commonStyles.container, { backgroundColor: COLORS.background.primary }]}>
      <Header title="Parameter-Wise Comments" close={true} onPress={onClose} />
      <View style={[commonStyles.container, { backgroundColor: COLORS.background.primary }]}>
        <FlatList
          data={parameterComments}
          keyExtractor={(item) => item.parameterId}
          renderItem={({ item, index }) => (
            <SectionItem
              item={item}
              index={index}
              isLast={index === parameterComments.length - 1}
            />
          )}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={{ paddingVertical: Responsive.height(20) }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: Responsive.height(2),
    paddingHorizontal: 20
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Responsive.height(12)
  },
  sectionIndex: {
    fontSize: FONT_SIZE.fs14,
    fontFamily: FONTS_FAMILY.SemiBold600,
    color: COLORS.text.secondary,
    marginRight: Responsive.width(8)
  },
  sectionTitle: {
    fontSize: FONT_SIZE.fs16,
    fontFamily: FONTS_FAMILY.SemiBold600,
    color: COLORS.text.heading,
    width: '90%'
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: Responsive.height(10),
    gap: 10
  },
  avatar: {
    width: Responsive.width(40),
    height: Responsive.height(40),
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Responsive.width(12)
  },
  avatarText: {
    fontSize: FONT_SIZE.fs14,
    fontFamily: FONTS_FAMILY.SemiBold600
  },
  commentContent: {
    flex: 1
  },
  name: {
    fontSize: FONT_SIZE.fs14,
    fontFamily: FONTS_FAMILY.SemiBold600,
    color: COLORS.text.heading
  },
  role: {
    fontSize: FONT_SIZE.fs12,
    fontFamily: FONTS_FAMILY.Medium500,
    color: COLORS.text.secondary,
    marginBottom: Responsive.height(6)
  },
  comment: {
    fontSize: FONT_SIZE.fs13,
    fontFamily: FONTS_FAMILY.Regular400,
    lineHeight: Responsive.height(20),
    color: COLORS.text.primary
  },
  commentDivider: {
    height: 1,
    backgroundColor: COLORS.border.light,
    marginVertical: Responsive.height(8)
  },
  noComments: {
    fontSize: FONT_SIZE.fs13,
    fontFamily: FONTS_FAMILY.Regular400,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
    marginLeft: Responsive.width(52)
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: Responsive.height(12),
    fontSize: FONT_SIZE.fs14,
    fontFamily: FONTS_FAMILY.Regular400,
    color: COLORS.text.secondary
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Responsive.width(20)
  },
  errorText: {
    fontSize: FONT_SIZE.fs14,
    fontFamily: FONTS_FAMILY.Regular400,
    color: COLORS.error,
    textAlign: 'center'
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Responsive.height(40)
  },
  emptyStateText: {
    fontSize: FONT_SIZE.fs14,
    fontFamily: FONTS_FAMILY.Regular400,
    color: COLORS.text.secondary
  }
});

export default ViewAllComments;
