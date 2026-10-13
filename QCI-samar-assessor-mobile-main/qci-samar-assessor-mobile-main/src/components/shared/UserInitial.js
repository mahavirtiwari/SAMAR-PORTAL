import { Text, View } from 'react-native';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../assets/theme/Theme';

const UserInitial = ({ name, lastName, role }) => {
  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: role === 'lead_assessor' ? '#7239EA' : COLORS.button.primary,
        borderRadius: 100,
        width: 44,
        height: 44
      }}>
      <View
        style={[
          styles.participantAvatar,
          { backgroundColor: role == 'lead_assessor' ? '#F1ECFD' : '#E6F4FF' }
        ]}>
        <Text
          style={[
            styles.avatarText,
            { color: role === 'lead_assessor' ? '#7239EA' : COLORS.button.primary }
          ]}>
          {name?.charAt(0)}
          {lastName?.charAt(0)}
        </Text>
      </View>
    </View>
  );
};
const styles = {
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.br20,
    backgroundColor: COLORS.primary.soft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sp12,
    borderWidth: 2,
    borderColor: COLORS.background.primary
  },
  avatarText: {
    color: COLORS.primary.main,
    fontSize: FONT_SIZE.fs16,
    ...commonStyles.FontFamily_SemiBold600
  }
};

export default UserInitial;
