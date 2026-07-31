// Centralized timestamp utilities for FreshTrack
// All stored timestamps are in UTC ISO-8601.
// Display functions convert to local shop timezone (Asia/Kolkata / IST).

const SHOP_TIMEZONE = 'Asia/Kolkata';
const DISPLAY_LOCALE = 'en-IN';

/**
 * Generate an immutable UTC timestamp string for storing in state/DB.
 * In a real backend this would be: NOW() / CURRENT_TIMESTAMP (MySQL/Postgres)
 * Here we simulate server-side generation by calling this only in action handlers,
 * never in render functions or useEffect display logic.
 */
export function generateTimestamp() {
  return new Date().toISOString(); // Always UTC
}

/**
 * Format a frozen UTC ISO timestamp for display in the shop's local timezone.
 * The stored value is NEVER altered — only presentation changes.
 */
export function formatTimestamp(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString(DISPLAY_LOCALE, {
    timeZone: SHOP_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Format date-only portion of a frozen UTC timestamp.
 */
export function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString(DISPLAY_LOCALE, {
    timeZone: SHOP_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format time-only portion of a frozen UTC timestamp.
 */
export function formatTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString(DISPLAY_LOCALE, {
    timeZone: SHOP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Get the local date string (YYYY-MM-DD in IST) from a UTC ISO timestamp.
 * Used for grouping sales by local shop date, not UTC date.
 */
export function getLocalDateKey(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  // Use Intl to get the date parts in the shop timezone
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIMEZONE }).formatToParts(d);
  const y = parts.find(p => p.type === 'year').value;
  const mo = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${y}-${mo}-${day}`;
}

/**
 * Check if a UTC ISO timestamp falls on the same local (IST) day as today.
 */
export function isLocalToday(isoString) {
  return getLocalDateKey(isoString) === getLocalDateKey(new Date().toISOString());
}

/**
 * Check if a UTC ISO timestamp falls on the local (IST) yesterday.
 */
export function isLocalYesterday(isoString) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateKey(isoString) === getLocalDateKey(yesterday.toISOString());
}

/**
 * Check if a UTC ISO timestamp falls in the same local (IST) calendar week.
 * Week starts on Monday.
 */
export function isLocalThisWeek(isoString) {
  const now = new Date();
  const target = new Date(isoString);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);
  return target >= startOfWeek;
}

/**
 * Check if a UTC ISO timestamp falls in the same local (IST) calendar month.
 */
export function isLocalThisMonth(isoString) {
  const now = new Date();
  const target = new Date(isoString);
  const nowKey = `${now.getFullYear()}-${now.getMonth()}`;
  const targetKey = `${target.getFullYear()}-${target.getMonth()}`;
  // Compare by local IST month
  const nowLocal = getLocalDateKey(now.toISOString()).substring(0, 7);
  const targetLocal = getLocalDateKey(isoString).substring(0, 7);
  return nowLocal === targetLocal;
}

/**
 * Check if a UTC ISO timestamp falls in the same local (IST) calendar year.
 */
export function isLocalThisYear(isoString) {
  const now = new Date();
  const target = new Date(isoString);
  const nowLocal = getLocalDateKey(now.toISOString()).substring(0, 4);
  const targetLocal = getLocalDateKey(isoString).substring(0, 4);
  return nowLocal === targetLocal;
}
