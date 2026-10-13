import CryptoJS from 'react-native-crypto-js';

export const encrypt = (data, secretKey) => {
  const cipher = CryptoJS.AES.encrypt(data, secretKey).toString();
  return cipher;
};
