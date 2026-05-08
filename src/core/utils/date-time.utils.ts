import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TIMEZONE = "America/Tijuana";

/**
 * Validates if the current time is within the specified shift.
 * Handles shifts that cross midnight.
 */
export const isInShift = (startTime: string, endTime: string, tz: string = DEFAULT_TIMEZONE): boolean => {
  if (!startTime || !endTime) return true;

  const now = dayjs().tz(tz);
  const currentMinutes = now.hour() * 60 + now.minute();

  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (endMinutes < startMinutes) {
    // Nocturnal shift (e.g., 22:00 to 06:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  // Normal shift (e.g., 08:00 to 17:00)
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

export const getStartOfDay = (date: string | Date, tz: string = DEFAULT_TIMEZONE): Date => {
  return dayjs(date).tz(tz).startOf("day").toDate();
};

export const getEndOfDay = (date: string | Date, tz: string = DEFAULT_TIMEZONE): Date => {
  return dayjs(date).tz(tz).endOf("day").toDate();
};

export const formatDate = (date: Date | string, format: string = "YYYY-MM-DD HH:mm:ss", tz: string = DEFAULT_TIMEZONE): string => {
  return dayjs(date).tz(tz).format(format);
};

export const now = (tz: string = DEFAULT_TIMEZONE): Date => {
  return dayjs().tz(tz).toDate();
};
