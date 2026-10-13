import { useState } from 'react';
import { Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { COLORS } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';

const PasswordInput = ({
  placeholder,
  imageSource,
  containerStyle,
  required,
  onChangeText,
  value,
  inputRef,
  onSubmitEditing
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible((prevState) => !prevState);
  };

  return (
    <View style={[styles.textInputContainer, containerStyle]}>
      <View style={styles.iconContainer}>
        <Image
          source={imageSource}
          style={[
            styles.emailIcon,
            { tintColor: isFocused ? COLORS.primary.disabled : COLORS.paraText }
          ]}
        />
        {required && <Text style={styles.requiredText}>*</Text>}
      </View>
      <View
        style={[
          styles.inputContainer,
          { borderBottomColor: isFocused ? COLORS.primary.disabled : COLORS.border.light }
        ]}>
        <TextInput
          returnKeyType="done"
          placeholder={placeholder}
          value={value}
          placeholderTextColor={COLORS.placeholderText}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={!isPasswordVisible}
          ref={inputRef}
          onSubmitEditing={onSubmitEditing}
          style={styles.textInput}
        />
        <TouchableOpacity style={styles.eyeIcon} onPress={togglePasswordVisibility}>
          <Image
            source={isPasswordVisible ? Icons.eye : Icons.closeEye}
            style={styles.eyeIconImage}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};
export default PasswordInput;
const styles = StyleSheet.create({
  textInputContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: Responsive.height(30)
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: Responsive.width(15),
    width: Responsive.width(20),
    height: Responsive.height(20)
  },
  emailIcon: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    marginTop: Platform.select({
      android: Responsive.height(4)
    })
  },
  requiredText: {
    color: COLORS.redTxt
  },
  inputContainer: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    width: '90%'
  },
  textInput: {
    ...commonStyles.sixteenWhite500,
    color: COLORS.lightBlack,
    width: '90%',
    minHeight: Platform.select({
      ios: Responsive.height(50),
      android: Responsive.height(50)
    })
  },
  eyeIcon: {
    paddingHorizontal: Responsive.width(10),
    paddingVertical: Responsive.height(10)
  },
  eyeIconImage: {
    width: Responsive.width(20),
    height: Responsive.height(20)
  }
});
