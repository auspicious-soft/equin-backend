/**
 * Utility functions for consistent date handling across timezones
 */

/**
 * Creates a date object set to midnight UTC for the current day
 * @returns Date object set to 00:00:00.000 UTC for the current day
 */
export const getTodayUTC = (): Date => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
};

/**
 * Creates a date object set to midnight UTC for tomorrow
 * @returns Date object set to 00:00:00.000 UTC for tomorrow
 */
export const getTomorrowUTC = (): Date => {
  const tomorrow = getTodayUTC();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow;
};

/**
 * Creates a date object set to midnight UTC for a specific date
 * @param date The date to convert to midnight UTC
 * @returns Date object set to 00:00:00.000 UTC for the given date
 */
export const getDateMidnightUTC = (date: Date): Date => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

/**
 * Adds days to a date and returns a new date set to midnight UTC
 * @param date The starting date
 * @param days Number of days to add
 * @returns New date with days added, set to midnight UTC
 */
export const addDaysUTC = (date: Date, days: number): Date => {
  const newDate = new Date(date);
  newDate.setUTCDate(newDate.getUTCDate() + days);
  newDate.setUTCHours(0, 0, 0, 0);
  return newDate;
};

/**
 * Formats a date as YYYY-MM-DD string in UTC
 * @param date The date to format
 * @returns Date string in YYYY-MM-DD format
 */
export const formatDateUTC = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Utility to debug date comparison issues
 * @param userId User ID for logging
 * @param planId Plan ID for logging
 * @param startDate Plan start date
 * @param endDate Plan end date
 * @param currentDate Current date being compared
 */
export const debugDateComparison = (
  userId: string,
  planId: string,
  startDate: Date | null,
  endDate: Date | null,
  currentDate: Date
): void => {
  console.log(`[DATE DEBUG] User: ${userId}, Plan: ${planId}`);
  console.log(`[DATE DEBUG] Start: ${startDate?.toISOString() || 'null'}`);
  console.log(`[DATE DEBUG] End: ${endDate?.toISOString() || 'null'}`);
  console.log(`[DATE DEBUG] Current: ${currentDate.toISOString()}`);
  
  if (startDate && endDate) {
    console.log(`[DATE DEBUG] Is current >= start? ${currentDate >= startDate}`);
    console.log(`[DATE DEBUG] Is current <= end? ${currentDate <= endDate}`);
  }
};
