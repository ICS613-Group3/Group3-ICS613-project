/**
 * Shared Hawaii Standard Time utilities for Issue #136.
 *
 * Browser and operating-system timezone settings must not determine how
 * application timestamps are displayed. All timestamp formatting uses the
 * Pacific/Honolulu IANA timezone explicitly.
 */

export const HST_TIME_ZONE = 'Pacific/Honolulu';
export const HST_ABBREVIATION = 'HST';

export const HST_UI_NOTE =
  'All date and time inputs and displays use Hawaii Standard Time (HST).';

type HstDateValue = string | number | Date;

/**
 * Parse a date or timestamp safely.
 *
 * A YYYY-MM-DD date is normalized to noon UTC before HST formatting. This
 * prevents a date-only value from displaying as the previous calendar day.
 */
function parseHstDateValue(value: HstDateValue): Date | null {
  const normalizedValue =
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value + 'T12:00:00Z'
      : value;

  const parsedDate =
    normalizedValue instanceof Date
      ? new Date(normalizedValue.getTime())
      : new Date(normalizedValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

/**
 * Format an API timestamp in Hawaii Standard Time.
 */
export function formatHstDateTime(
  value: HstDateValue,
): string {
  const parsedDate = parseHstDateValue(value);

  if (!parsedDate) {
    return '\u2014';
  }

  const formattedValue = new Intl.DateTimeFormat('en-US', {
    timeZone: HST_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);

  return formattedValue + ' ' + HST_ABBREVIATION;
}

/**
 * Format a date-only or timestamp value as an HST calendar date.
 */
export function formatHstDate(value: HstDateValue): string {
  const parsedDate = parseHstDateValue(value);

  if (!parsedDate) {
    return typeof value === 'string' ? value : '\u2014';
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: HST_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parsedDate);
}

/**
 * Return the current timestamp formatted for HST UI messages.
 */
export function getCurrentHstTimestamp(): string {
  return formatHstDateTime(new Date());
}
