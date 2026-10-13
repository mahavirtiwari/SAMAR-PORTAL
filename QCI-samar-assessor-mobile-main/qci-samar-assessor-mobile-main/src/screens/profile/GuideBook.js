import { Platform, View } from 'react-native';
import Pdf from 'react-native-pdf';
import { commonStyles } from '../../assets/theme/Styles';
import { Header } from '../../components/layout';

const GuideBook = () => {
  // The Assessor Handbook ships inside the app. Android reads its own copy from
  // android/app/src/main/assets/pdf/, so both copies are replaced together and
  // reach users only with a new build.
  const source =
    Platform.OS === 'ios'
      ? require('../../assets/pdf/assessor-handbook.pdf')
      : { uri: 'bundle-assets://pdf/assessor-handbook.pdf', cache: true };
  return (
    <View style={commonStyles.fill}>
      <Header title="Guide Book" back={true} />
      <View style={[commonStyles.fill, { padding: 0 }]}>
        <Pdf source={source} style={{ flex: 1, width: '100%' }} onLoadComplete={() => undefined} />
      </View>
    </View>
  );
};

export default GuideBook;
