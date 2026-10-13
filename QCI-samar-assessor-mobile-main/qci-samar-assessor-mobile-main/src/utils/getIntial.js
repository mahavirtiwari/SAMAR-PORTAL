/**
 * Get initials from a full name
 * @param {string} fullName - The full name (e.g., "Assessor User")
 * @returns {string} - The initials in uppercase (e.g., "AU")
 */
const getInitials = (fullName) => {
  if (!fullName || typeof fullName !== 'string') {
    return '';
  }

  const names = fullName
    .trim()
    .split(' ')
    .filter((name) => name.length > 0);

  if (names.length === 0) {
    return '';
  }

  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }

  // Get first letter of first name and first letter of last name
  const firstInitial = names[0].charAt(0).toUpperCase();
  const lastInitial = names[names.length - 1].charAt(0).toUpperCase();

  return firstInitial + lastInitial;
};
export default getInitials;
