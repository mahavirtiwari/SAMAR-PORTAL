import { format, isValid } from 'date-fns';
import { Logger } from '.';

export const getCurrentDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getCurrentDateTime = () => {
  return new Date().toISOString();
};

export const formatDate = (inputDate) => {
  if (!inputDate) {
    Logger.error('Invalid date:', inputDate);
    return 'Invalid date';
  }
  const date = new Date(inputDate);
  if (!isValid(date)) {
    Logger.error('Invalid date:', inputDate);
    return 'Invalid date';
  }
  return format(date, 'd MMM, yyyy');
};

export const formatTime = (inputDate) => {
  if (!inputDate) {
    Logger.error('Invalid time input:', inputDate);
    return '';
  }
  return format(new Date(inputDate), 'hh:mm a');
};

export const isSameDay = (date1, date2) => {
  const d1 = new Date(date1).setHours(0, 0, 0, 0);
  const d2 = new Date(date2).setHours(0, 0, 0, 0);
  return d1 === d2;
};

// Punch-in and parameter allocation open a fixed number of days before the
// scheduled start of the onsite assessment (default 2). The window opens at the
// START of that day (local midnight). Returns the open Date, or null when the
// scheduled start date is missing/invalid so callers can fail open.
export const getAssessmentWindowOpenDate = (scheduledStartDate, daysBefore = 2) => {
  if (!scheduledStartDate) {
    return null;
  }
  const start = new Date(scheduledStartDate);
  if (!isValid(start)) {
    return null;
  }
  const openAt = new Date(start);
  openAt.setHours(0, 0, 0, 0);
  openAt.setDate(openAt.getDate() - daysBefore);
  return openAt;
};

// True once we are within `daysBefore` days of the scheduled start. Fails open
// (returns true) when the date is missing/invalid so a bad date never
// permanently locks an assessor out of punch-in / allocation.
export const isAssessmentWindowOpen = (scheduledStartDate, daysBefore = 2) => {
  const openAt = getAssessmentWindowOpenDate(scheduledStartDate, daysBefore);
  if (!openAt) {
    return true;
  }
  return Date.now() >= openAt.getTime();
};
