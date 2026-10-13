export const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;

export const gstNumberRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;

export const panNumberRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const udyamNumberRegex = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

// DPIIT: e.g., DPIIT2022AB1234 (DPIIT + 4-digit year + 2 letters + 4 digits)
export const dpiitNumberRegex = /^DPIIT\d{4}[A-Z]{2}\d{4}$/;

export const drdoRegistrationNumberRegex = /^DRDO-[A-Z]{5}-\d{5}$/;

// CIN: e.g., L01631KA2010PTC096843
export const cinNumberRegex = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

export const feeValidationRegex = /^\d{0,6}(\.\d{0,2})?$/;
