// Format mobile number as Indian style: XXXXX XXXXX
export const formatIndianMobile = digits => {
  if (!digits) {
    return '';
  }
  if (digits.length <= 5) {
    return digits;
  }
  return `${digits.slice(0, 5)} ${digits.slice(5, 10)}`;
};

// Parse formatted mobile to raw digits
export const parseIndianMobile = value => {
  if (!value) {
    return '';
  }
  // Remove all non-digit characters
  let digits = value.replace(/\D/g, '');
  // Remove leading '91' country code if user types it
  if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  }
  // First digit must be 6-9 for valid Indian mobile number
  if (digits.length > 0 && !/^[6-9]/.test(digits)) {
    digits = digits.slice(1);
  }
  // Limit to 10 digits
  return digits.slice(0, 10);
};
