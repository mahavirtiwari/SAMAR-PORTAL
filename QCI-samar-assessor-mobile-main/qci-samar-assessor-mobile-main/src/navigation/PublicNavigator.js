import { createStackNavigator } from '@react-navigation/stack';
import { Login } from '../screens/index';

const Stack = createStackNavigator();

export default function PublicNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false
      }}
      initialRouteName={'Login'}>
      <Stack.Screen name="Login" component={Login} />
    </Stack.Navigator>
  );
}
