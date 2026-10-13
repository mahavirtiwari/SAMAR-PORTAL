import { useState } from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../../assets/theme/Layout';
import { commonStyles } from '../../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../../assets/theme/Theme';
import Icons from '../../../constants/Icons';

const AppPasswordInput = ({
  label,
  autoCapitalize,
  onChange = () => undefined,
  keyboardType,
  placeholderText,
  maxLength,
  removeLine,
  addressInputStyle,
  wordCounter,
  inputStyle,
  labelTextStyle,
  optionalInputField,
  onError,
  onBlur,
  val,
  errors,
  InputIcon,
  asterisk,
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
}) => {
  const [focused, setFocused] = useState(false);
  const customOnBlur = e => {
    setFocused(false);
    if (onBlur) {
      onBlur(e);
    }
  };
  const customOnFocus = () => {
    setFocused(true);
  };
  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  return (
    <View style={styles.inputStyle}>
      <View style={styles.labelTextRow}>
        {label ? (
          <Text
            style={[
              commonStyles.FontFamily_Medium500,
              {
                ...styles.labelTextStyle,
                ...labelTextStyle,
                color: COLORS.text.primary,
                fontSize: FONT_SIZE.fs14,
              },
            ]}>
            {label}
            {optionalInputField && (
              <Text
                optionalInputField={optionalInputField}
                style={[commonStyles.tenGilroy500, styles.optionalInputField]}>
                {' '}
                (optional)
              </Text>
            )}
            {asterisk && <Text style={{ color: 'red' }}>*</Text>}
          </Text>
        ) : null}
        {wordCounter && <Text>32/100</Text>}
      </View>
      <View style={styles.flexView}>
        {InputIcon ? (
          <View style={{ zIndex: 1 }}>
            <View style={styles.inputIcons}>
              <Image
                source={InputIcon}
                style={{
                  width: '100%',
                  height: '100%',
                  resizeMode: 'contain',
                }}
              />
            </View>
            <View
              style={{
                ...styles.line,
                ...removeLine,
                backgroundColor: '#EBEDF3',
                height: Responsive.height(30),
                marginLeft: Responsive.width(48),
                position: 'absolute',
                top: Responsive.height(-15),
              }}
            />
          </View>
        ) : null}
        <TextInput
          style={[
            {
              ...commonStyles.bodyMediumPrimary500,
              width: '100%',
              borderWidth: 1,
              borderColor: errors ? '#FED4DE' : focused ? '#D1E6FF' : '#EBEDF3',
              backgroundColor: errors
                ? 'rgba(253, 245, 246, 1)'
                : focused
                  ? COLORS.background.primary
                  : COLORS.background.primary,
              color: COLORS.text.primary,
              textAlignVertical: 'auto',
              paddingLeft: InputIcon ? Responsive.width(60) : Responsive.width(15),
              paddingRight: Responsive.width(42),
              height: 45,
              borderRadius: Responsive.height(12),
              ...addressInputStyle,
            },
          ]}
          onBlur={e => customOnBlur(e)}
          onFocus={customOnFocus}
          value={val}
          onChangeText={text => onChange(text)}
          keyboardType={keyboardType}
          secureTextEntry={!isPasswordVisible}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholderText}
          maxLength={maxLength}
          placeholderTextColor={COLORS.text.placeholder}
        />
        <TouchableOpacity
          activeOpacity={0.6}
          style={styles.eyeIcon}
          onPress={togglePasswordVisibility}>
          <Image
            source={isPasswordVisible ? Icons.visiblePassword : Icons.nonVisiblePassword}
            style={{
              width: Responsive.width(20),
              height: Responsive.height(20),
              zIndex: 9,
              tintColor: isPasswordVisible ? COLORS.darkGreen : null, // Replace 'desiredColor' with the actual color you want
            }}
          />
        </TouchableOpacity>
      </View>
      {onError && (
        <View>
          <Text
            style={[
              commonStyles.FontFamily_Regular400,
              {
                color: COLORS.status.danger,
                fontSize: FONT_SIZE.fs12,
                marginTop: Responsive.height(4),
              },
            ]}>
            {onError}
          </Text>
        </View>
      )}
    </View>
  );
};
const styles = StyleSheet.create({
  inputIcons: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    zIndex: 9,
    position: 'absolute',
    left: Responsive.width(15),
    top: Responsive.height(-10),
  },
  inlineStyle: {
    paddingVertical: Responsive.height(8),
    fontSize: Responsive.font(16),
    color: COLORS.blackOpacity80,
    flex: 1,
  },
  labelTextStyle: {
    paddingBottom: Responsive.height(6),
    // color: COLORS.text.secondary200
  },
  flexView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  optionalInputField: {
    color: COLORS.lightBlack,
  },
  labelTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyeIcon: {
    position: 'absolute',
    right: Responsive.width(15),
  },
  inputStyle: {
    marginBottom: Responsive.height(10),
  },
  line: {
    width: 1,
  },
});
export default AppPasswordInput;
