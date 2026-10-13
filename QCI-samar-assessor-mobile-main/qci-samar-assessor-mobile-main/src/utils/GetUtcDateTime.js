import { Logger } from '.';

const getUtcDateTime = (selectedDate, selectedTime) => {
  if (!selectedDate) {
    return null;
  } // Ensure selectedDate is provided

  // Convert selectedDate to a Date object and extract only the UTC date components
  const dateObj = new Date(selectedDate);
  if (isNaN(dateObj.getTime())) {
    Logger.error('Invalid selectedDate:', selectedDate);
    return null;
  }

  let hours = 0,
    minutes = 0,
    seconds = 0;

  // If selectedTime is provided, extract UTC time components
  if (selectedTime) {
    const timeObj = new Date(selectedTime);
    if (!isNaN(timeObj.getTime())) {
      hours = timeObj.getUTCHours();
      minutes = timeObj.getUTCMinutes();
      seconds = timeObj.getUTCSeconds();
    } else {
      Logger.error('Invalid selectedTime:', selectedTime);
      return null;
    }
  }

  // Construct the UTC Date object properly
  const utcDateTime = new Date(
    Date.UTC(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate(),
      selectedTime ? hours : 0, // Only use time if selectedTime is provided
      selectedTime ? minutes : 0,
      selectedTime ? seconds : 0
    )
  );

  // If no selectedTime, return only YYYY-MM-DD
  return selectedTime ? utcDateTime.toISOString() : utcDateTime.toISOString().split('T')[0];
};
export default getUtcDateTime;
