import { createStackNavigator } from '@react-navigation/stack';
import {
  AboutSamar,
  AddBasicInforamtion,
  AddServiceBasicInformation,
  AllocateParameters,
  AssessmentParametersDetails,
  AssessmentParametersList,
  AssessmentStepsList,
  AssignedParameters,
  BasicInformation,
  ChangePassword,
  ClosingMeeting,
  GuideBook,
  Home,
  OpeningMeeting,
  Profile,
  SitePictures,
  SiteTour,
  Support
} from '../screens';
import SelectParameters from '../screens/user/assessment/allocateParameter/SelectParameters';

const Stack = createStackNavigator();

export default function UserNavigator({ route }) {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="AssessmentStepsList" component={AssessmentStepsList} />
      <Stack.Screen name="SitePictures" component={SitePictures} />
      <Stack.Screen name="OpeningMeeting" component={OpeningMeeting} />
      <Stack.Screen name="AssessmentParametersList" component={AssessmentParametersList} />
      <Stack.Screen name="AssessmentParametersDetails" component={AssessmentParametersDetails} />
      <Stack.Screen name="ClosingMeeting" component={ClosingMeeting} />
      <Stack.Screen name="AllocateParameters" component={AllocateParameters} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="AddBasicInformation" component={AddBasicInforamtion} />
      <Stack.Screen name="AddServiceBasicInformation" component={AddServiceBasicInformation} />
      <Stack.Screen name="BasicInformation" component={BasicInformation} />
      <Stack.Screen name="SiteTour" component={SiteTour} />
      <Stack.Screen name="Support" component={Support} />
      <Stack.Screen name="ChangePassword" component={ChangePassword} />
      <Stack.Screen name="AssignedParameters" component={AssignedParameters} />
      <Stack.Screen name="SelectParameters" component={SelectParameters} />
      <Stack.Screen name="GuideBook" component={GuideBook} />
      <Stack.Screen name="AboutSamar" component={AboutSamar} />
    </Stack.Navigator>
  );
}
