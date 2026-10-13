import { useNavigation } from '@react-navigation/native';
import { useFormik } from 'formik';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as yup from 'yup';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { COLORS } from '../../assets/theme/Theme';
import AppButton from '../../components/base/AppButton';
import AppPasswordInput from '../../components/base/textInput/AppPasswordInput';
import Header from '../../components/layout/Header';
import { AppCommonModal } from '../../components/modals';
import ApplicationLoader from '../../components/shared/Loader';
import Icons from '../../constants/Icons';
import { changePasswordAction } from '../../redux/action/accountAction';
import { resetChangePasswordState } from '../../redux/slices/accountSlice';
import { Logger } from '../../utils/logger';

// Password validation rules for security compliance
const passwordValidationRules = {
  minLength: 8,
  maxLength: 16,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /\d/,
  hasSymbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/
};

// Enhanced validation schema with comprehensive password security requirements
const ChangePasswordValidationSchema = yup.object().shape({
  oldPassword: yup
    .string()
    .min(
      passwordValidationRules.minLength,
      ({ min }) => `Password should be at least ${min} characters`
    )
    .max(passwordValidationRules.maxLength, ({ max }) => `Password cannot exceed ${max} characters`)
    .required('Please enter your current password to continue'),

  newPassword: yup
    .string()
    .min(
      passwordValidationRules.minLength,
      ({ min }) => `New password should be at least ${min} characters for security`
    )
    .max(
      passwordValidationRules.maxLength,
      ({ max }) => `New password cannot exceed ${max} characters`
    )
    .matches(
      passwordValidationRules.hasUppercase,
      'Password must contain at least one uppercase letter (A-Z)'
    )
    .matches(
      passwordValidationRules.hasLowercase,
      'Password must contain at least one lowercase letter (a-z)'
    )
    .matches(passwordValidationRules.hasNumber, 'Password must contain at least one number (0-9)')
    .matches(
      passwordValidationRules.hasSymbol,
      'Password must contain at least one special character (!@#$%^&*)'
    )
    .notOneOf([yup.ref('oldPassword')], 'New password must be different from current password')
    .required('Please enter a new password')
});

const ChangePassword = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const [_focusedInput, setFocusedInput] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { changePassword, changePasswordLoading, changePasswordError } = useSelector(
    (state) => state.account
  );

  const formik = useFormik({
    validationSchema: ChangePasswordValidationSchema,
    initialValues: {
      oldPassword: '',
      newPassword: ''
    },
    onSubmit: (values) => {
      dispatch(
        changePasswordAction({
          oldPassword: values.oldPassword,
          newPassword: values.newPassword
        })
      );
    }
  });

  useEffect(() => {
    if (changePasswordLoading) {
      ApplicationLoader.show('changePassword');
      return;
    }
    ApplicationLoader.hide('changePassword');

    if (changePassword) {
      Logger.info('Password changed successfully');
      dispatch(resetChangePasswordState());
      navigation.goBack();
    } else if (changePasswordError) {
      setErrorMessage(
        typeof changePasswordError === 'string' ? changePasswordError : 'Could not change password.'
      );
      setShowErrorModal(true);
      setTimeout(() => {
        setShowErrorModal(false);
        dispatch(resetChangePasswordState());
      }, 2500);
    }
  }, [changePassword, changePasswordError, changePasswordLoading, dispatch, navigation]);

  return (
    <View style={styles.container}>
      <Header title={'Change password'} noback={!true} headerBottomStyle={true} />
      <View style={styles.changePasswordContainer}>
        <View>
          {/* Current Password Field */}
          <AppPasswordInput
            name="oldPassword"
            label="Current Password"
            InputIcon={Icons.key}
            placeholderText="Enter your current password"
            value={formik.values.oldPassword}
            onChange={formik.handleChange('oldPassword')}
            onBlur={(e) => {
              formik.handleBlur('oldPassword')(e);
              setFocusedInput(null);
            }}
            onFocus={() => setFocusedInput('oldPassword')}
          />

          <View style={{ paddingTop: Responsive.height(5) }}>
            <AppPasswordInput
              name="newPassword"
              label="New Password"
              InputIcon={Icons.key}
              placeholderText="Enter new password"
              value={formik.values.newPassword}
              onChange={formik.handleChange('newPassword')}
              onBlur={(e) => {
                formik.handleBlur('newPassword')(e);
                setFocusedInput(null);
              }}
            />
          </View>
          <View>
            <Text
              style={{
                ...commonStyles.bodyXSmall500,
                color: COLORS.text.grey400,
                fontStyle: 'italic'
              }}>
              Create a strong password using at least 8 characters, including uppercase, lowercase,
              a number, and a symbol.
            </Text>
          </View>
        </View>
        <View style={{ paddingTop: Responsive.height(20) }}>
          <AppButton
            title={'Save'}
            size={'large'}
            onPress={formik.handleSubmit}
            disabled={
              !(
                formik.values.oldPassword &&
                formik.values.newPassword &&
                formik.errors.newPassword === undefined
              )
            }
            loading={changePasswordLoading}
          />
        </View>
      </View>
      <AppCommonModal
        title={"Couldn't update password"}
        imgsrc={Icons.error}
        showmodal={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        type="error"
        subTitle={errorMessage}
      />
    </View>
  );
};

export default ChangePassword;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary
  },
  changePasswordContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingHorizontal: Responsive.width(20),
    paddingVertical: Responsive.height(20)
  },
  inputContainer: {
    paddingTop: Responsive.height(15)
  },
  passwordRequirements: {
    paddingTop: Responsive.height(10),
    paddingHorizontal: Responsive.width(5)
  },
  requirementsText: {
    ...commonStyles.bodyXSmall500,
    color: COLORS.text.secondary200,
    fontStyle: 'italic',
    lineHeight: 18
  }
});
