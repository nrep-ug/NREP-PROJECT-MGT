/**
 * Date and timezone utilities using moment-timezone
 * Default timezone: Africa/Kampala
 */

import moment from 'moment-timezone';

export const DEFAULT_TIMEZONE = 'Africa/Kampala';

/**
 * Format date in Kampala timezone
 * @param {string|Date} date - Date to format
 * @param {string} format - Moment format string
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = 'YYYY-MM-DD') {
  if (!date) return '';
  return moment(date).tz(DEFAULT_TIMEZONE).format(format);
}

/**
 * Format datetime in Kampala timezone
 * @param {string|Date} date - Date to format
 * @param {string} format - Moment format string
 * @returns {string} Formatted datetime string
 */
export function formatDateTime(date, format = 'YYYY-MM-DD HH:mm') {
  if (!date) return '';
  return moment(date).tz(DEFAULT_TIMEZONE).format(format);
}

/**
 * Get current date in UTC as ISO string (for Appwrite)
 * @returns {string} ISO datetime string
 */
export function nowUTC() {
  return moment.utc().toISOString();
}

/**
 * Get start of week (Monday) in UTC for timesheet grouping
 * @param {string|Date} date - Date to get week start from
 * @returns {string} ISO datetime string of Monday 00:00:00 UTC
 */
export function getWeekStart(date) {
  return moment(date).utc().startOf('isoWeek').toISOString();
}

/**
 * Get end of week (Sunday) in UTC
 * @param {string|Date} date - Date to get week end from
 * @returns {string} ISO datetime string of Sunday 23:59:59 UTC
 */
export function getWeekEnd(date) {
  return moment(date).utc().endOf('isoWeek').toISOString();
}

/**
 * Convert local date to UTC ISO string
 * @param {string|Date} date - Local date
 * @returns {string} ISO datetime string in UTC
 */
export function toUTC(date) {
  if (!date) return null;
  return moment(date).utc().toISOString();
}

/**
 * Get relative time (e.g., "2 hours ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export function fromNow(date) {
  if (!date) return '';
  return moment(date).tz(DEFAULT_TIMEZONE).fromNow();
}

/**
 * Check if date is overdue
 * @param {string|Date} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export function isOverdue(date) {
  if (!date) return false;
  return moment(date).isBefore(moment());
}

/**
 * Get array of dates for a week
 * @param {string|Date} weekStart - Start of week
 * @returns {Array<string>} Array of ISO date strings (7 days)
 */
export function getWeekDates(weekStart) {
  const start = moment(weekStart).utc().startOf('isoWeek');
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(start.clone().add(i, 'days').toISOString());
  }
  return dates;
}

/**
 * Format time duration in hours
 * @param {number} hours - Number of hours
 * @returns {string} Formatted string (e.g., "2.5h")
 */
export function formatHours(hours) {
  if (!hours) return '0h';
  return `${hours.toFixed(1)}h`;
}

/**
 * Add days to a date
 * @param {string|Date} date - Date to add days to
 * @param {number} days - Number of days to add
 * @returns {Date} New date with days added
 */
export function addDays(date, days) {
  return moment(date).add(days, 'days').toDate();
}
