import { useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { Responsive } from '../../../assets/theme/Layout';
import { commonStyles } from '../../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../../assets/theme/Theme';
import { capitalizeFirstLetter } from '../../../utils';
import { useBottomSheetKeyboard } from '../../shared/bottomSheetKeyboardContext';

const AppInput = ({
  label,
  value,
  validationState,
  onChange,
  keyboardType,
  placeholderText,
  maxLength,
  addressInputStyle,
  wordCounter,
  Counter,
  inputStyle,
  labelTextStyle,
  optionalInputField,
  isEditable = true,
  onBlur,
  onFocus,
  onError,
  inputRef,
  multiline,
  heightInput,
  errors,
  InputIcon,
  textCustomAligned,
  name,
  submit,
  removeLine,
  asterisk,
  disabled,
  rightIcon,
  textTransform,
  autoComplete,
  textContentType,
  cap,
  defaultValue
}) => {
  const [focused, setFocused] = useState(false);
  const notifyKeyboardFocus = useBottomSheetKeyboard();
  const customOnBlur = (e) => {
    setFocused(false);
    onBlur ? onBlur(e) : null;
  };
  const customOnFocus = (e) => {
    setFocused(true);
    // Fires at tap time, before the keyboard animation starts, so an
    // enclosing AppBottomSheet can cap its height early (Android has no
    // keyboardWillShow). No-op outside a sheet.
    notifyKeyboardFocus?.();
    onFocus ? onFocus(e) : null;
  };
  return (
    <View style={{ ...styles.inputStyle, ...inputStyle }}>
      <View style={styles.labelTextRow}>
        {label ? (
          <Text
            style={[
              commonStyles.FontFamily_Medium500,
              {
                ...styles.labelTextStyle,
                ...labelTextStyle,
                color: COLORS.text.primary,
                fontSize: FONT_SIZE.fs14
              }
            ]}>
            {label}
            {asterisk && (
              <Text style={{ color: COLORS.error.active, fontSize: FONT_SIZE.fs14 }}>*</Text>
            )}
            {optionalInputField && (
              <Text
                optionalInputField
                style={[commonStyles.FontFamily_Medium500, styles.optionalInputField]}>
                {' '}
                (Optional)
              </Text>
            )}
          </Text>
        ) : null}

        {wordCounter && <Text>{Counter}/100</Text>}
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
                  resizeMode: 'contain'
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
                top: Responsive.height(-15)
              }}
            />
          </View>
        ) : null}
        <TextInput
          name={name}
          ref={inputRef ? inputRef : null}
          style={[
            {
              ...commonStyles.bodyMediumPrimary500,
              width: '100%',
              borderWidth: 1,
              borderColor: errors ? '#FED4DE' : focused ? '#D1E6FF' : '#EBEDF3',
              backgroundColor: !isEditable
                ? COLORS.background.primary
                : errors
                  ? COLORS.background.primary
                  : focused
                    ? COLORS.background.primary
                    : COLORS.background.primary,
              // color: !isEditable ? COLORS.disabledText : COLORS.darkBlack,
              textAlignVertical: textCustomAligned ? textCustomAligned : 'auto',
              paddingLeft: InputIcon ? Responsive.width(60) : Responsive.width(15),
              height: heightInput ? heightInput : 45,
              borderRadius: Responsive.height(10),
              textTransform: textTransform ? textTransform : '',
              paddingRight: rightIcon
                ? Responsive.width(40)
                : validationState !== null
                  ? Responsive.width(30)
                  : Responsive.width(15),
              ...addressInputStyle
            }
          ]}
          onBlur={(e) => customOnBlur(e)}
          onFocus={(e) => customOnFocus(e)}
          value={value}
          onChangeText={(text) => {
            onChange?.(cap === 'none' ? text : capitalizeFirstLetter(text));
          }}
          keyboardType={keyboardType}
          autoCorrect={false}
          autoCompleteType="off"
          placeholder={placeholderText}
          maxLength={maxLength}
          onSubmitEditing={submit}
          editable={isEditable}
          autoCapitalize={cap != undefined ? cap : 'sentences'}
          autoComplete={autoComplete}
          textContentType={textContentType}
          placeholderTextColor={COLORS.text.placeholder}
          returnKeyType={keyboardType == 'numeric' ? 'done' : undefined}
          multiline={multiline}
        />
      </View>
      {onError || errors ? (
        <View>
          <Text
            style={[
              commonStyles.FontFamily_Regular400,
              {
                color: COLORS.status.danger,
                fontSize: FONT_SIZE.fs12,
                marginTop: Responsive.height(4)
              }
            ]}>
            {onError || errors} {/* Display errors if provided */}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  inlineStyle: {
    paddingVertical: Responsive.height(8),
    fontSize: Responsive.font(16),
    color: COLORS.blackOpacity80,
    flex: 1
  },

  flexView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  optionalInputField: {
    color: COLORS.lightBlack
  },
  labelTextStyle: {
    paddingBottom: Responsive.height(6)
    // color: COLORS.text.primary
  },
  labelTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  inputIcons: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    zIndex: 9,
    position: 'absolute',
    left: Responsive.width(15),
    top: Responsive.height(-10)
  },
  line: {
    width: 1
  }
});
export default AppInput;
