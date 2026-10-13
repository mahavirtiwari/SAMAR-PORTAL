import { StyleSheet, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { COLORS } from '../../assets/theme/Theme';

const AppRenderSeparator = ({ width }) => {
  return <View style={[styles.dividerStyle, { width: width }]} />;
};

export default AppRenderSeparator;

const styles = StyleSheet.create({
  dividerStyle: {
    backgroundColor: COLORS.border.borderRegular,
    height: 1,
    alignSelf: 'flex-end',
    marginVertical: Responsive.height(8)
  }
});
