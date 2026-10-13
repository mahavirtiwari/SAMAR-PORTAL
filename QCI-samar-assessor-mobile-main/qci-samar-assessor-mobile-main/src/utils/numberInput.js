// Sanitizes free-typed input for a percentage field so invalid values can't be
// entered at all, instead of only failing validation on submit. Keeps digits and
// a single decimal point, caps the number of decimal places, and returns null
// when the value would exceed `max` — the caller rejects that keystroke and keeps
// the last valid value.
export const sanitizePercentInput = (text, { maxDecimals = 2, max = 100 } = {}) => {
  let value = String(text ?? '').replace(/[^0-9.]/g, '');

  // Collapse extra decimal points into one.
  const parts = value.split('.');
  if (parts.length > 2) {
    value = `${parts[0]}.${parts.slice(1).join('')}`;
  }

  // Limit decimal places.
  const [intPart, decPart] = value.split('.');
  if (decPart !== undefined) {
    value = `${intPart}.${decPart.slice(0, maxDecimals)}`;
  }

  // Reject anything above the max so the caller keeps the last valid value.
  if (value !== '' && value !== '.' && parseFloat(value) > max) {
    return null;
  }

  return value;
};
