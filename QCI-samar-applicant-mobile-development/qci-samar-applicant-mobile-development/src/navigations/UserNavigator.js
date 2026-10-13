import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ApplicationDetail, Home, Profile, SitePictures, SiteTour, Support } from '../screens';

const Stack = createNativeStackNavigator();

const UserNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="Support" component={Support} />
      <Stack.Screen name="ApplicationDetail" component={ApplicationDetail} />
      <Stack.Screen name="SitePictures" component={SitePictures} />
      <Stack.Screen name="SiteTour" component={SiteTour} />
    </Stack.Navigator>
  );
};

export default UserNavigator;
