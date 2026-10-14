/**
 * CalmWork AI — Centralized Date & Time Utility
 * All dates and times across the platform are formatted in Indian Standard Time (IST - Asia/Kolkata)
 * using the 24-hour clock notation (HH:mm).
 */

export const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Format an ISO timestamp or Date object into 24-hour IST time: "HH:mm" (e.g., "14:30")
 * @param dateInput Date, ISO string, or timestamp
 * @param includeZone If true, appends " IST" (e.g., "14:30 IST")
 */
export function formatISTTime(
  dateInput: string | Date | number | null | undefined,
  includeZone: boolean = true
): string {
  if (!dateInput) return "";
  try {
    const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const timeStr = d.toLocaleTimeString("en-GB", {
      timeZone: IST_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    return includeZone ? `${timeStr} IST` : timeStr;
  } catch {
    return String(dateInput);
  }
}

/**
 * Format an ISO timestamp or Date object into IST date: "DD/MM/YYYY" (e.g., "14/10/2026")
 */
export function formatISTDate(
  dateInput: string | Date | number | null | undefined,
  options?: { shortMonth?: boolean }
): string {
  if (!dateInput) return "";
  try {
    const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    if (options?.shortMonth) {
      return d.toLocaleDateString("en-GB", {
        timeZone: IST_TIMEZONE,
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    }

    return d.toLocaleDateString("en-GB", {
      timeZone: IST_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return String(dateInput);
  }
}

/**
 * Format an ISO timestamp or Date object into complete IST date & 24-hour time:
 * Default: "14 Oct 2026, 14:30 IST"
 * @param dateInput Date, ISO string, or timestamp
 * @param options Custom formatting options
 */
export function formatISTDateTime(
  dateInput: string | Date | number | null | undefined,
  options?: {
    shortMonth?: boolean;
    includeSeconds?: boolean;
    includeZone?: boolean;
  }
): string {
  if (!dateInput) return "";
  try {
    const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const useShortMonth = options?.shortMonth ?? true;
    const includeSeconds = options?.includeSeconds ?? false;
    const includeZone = options?.includeZone ?? true;

    const formatted = d.toLocaleString("en-GB", {
      timeZone: IST_TIMEZONE,
      day: "2-digit",
      month: useShortMonth ? "short" : "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: includeSeconds ? "2-digit" : undefined,
      hour12: false
    });

    return includeZone ? `${formatted} IST` : formatted;
  } catch {
    return String(dateInput);
  }
}

/**
 * Returns current time in IST (24-hour format): "HH:mm IST"
 */
export function getNowISTTime(includeZone: boolean = true): string {
  return formatISTTime(new Date(), includeZone);
}

/**
 * Returns current date & time in IST (24-hour format): "DD MMM YYYY, HH:mm IST"
 */
export function getNowISTDateTime(includeZone: boolean = true): string {
  return formatISTDateTime(new Date(), { includeZone });
}
