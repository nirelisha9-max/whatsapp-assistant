import * as chrono from "chrono-node";
import { addMinutes, addHours, addDays, setHours, setMinutes, setSeconds, nextDay, getDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const TIMEZONE = process.env.TIMEZONE || "Asia/Jerusalem";

const HEBREW_WEEKDAYS: Record<string, number> = {
  ראשון: 0,
  שני: 1,
  שלישי: 2,
  רביעי: 3,
  חמישי: 4,
  שישי: 5,
  שבת: 6,
};

function nowInTZ(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

function setTime(base: Date, hours: number, minutes = 0): Date {
  let d = setSeconds(setMinutes(setHours(base, hours), minutes), 0);
  return fromZonedTime(d, TIMEZONE);
}

function parseHebrew(text: string): Date | null {
  const now = nowInTZ();

  // "בעוד X דקות"
  const minutesMatch = text.match(/בעוד\s+(\d+)\s+דקות?/);
  if (minutesMatch) return addMinutes(new Date(), parseInt(minutesMatch[1]));

  // "בעוד שעה"
  if (/בעוד\s+שעה/.test(text)) return addHours(new Date(), 1);

  // "בעוד X שעות"
  const hoursMatch = text.match(/בעוד\s+(\d+)\s+שעות?/);
  if (hoursMatch) return addHours(new Date(), parseInt(hoursMatch[1]));

  // "מחר ב-H(:mm)?" or "מחר בשעה H"
  const tomorrowMatch = text.match(/מחר\s+(?:ב[ה-]?|בשעה\s*)(\d{1,2})(?::(\d{2}))?/);
  if (tomorrowMatch) {
    const tomorrow = addDays(now, 1);
    return setTime(tomorrow, parseInt(tomorrowMatch[1]), parseInt(tomorrowMatch[2] || "0"));
  }

  // "מחר" (no time) → tomorrow at 9am
  if (/מחר/.test(text) && !/בעוד/.test(text)) {
    return setTime(addDays(now, 1), 9, 0);
  }

  // "היום ב-H(:mm)?" or "הערב ב-H"
  const todayMatch = text.match(/(?:היום|הערב)\s+(?:ב[ה-]?|בשעה\s*)(\d{1,2})(?::(\d{2}))?/);
  if (todayMatch) {
    return setTime(now, parseInt(todayMatch[1]), parseInt(todayMatch[2] || "0"));
  }

  // "ב-H(:mm)" standalone (today at that time)
  const timeMatch = text.match(/\bב[ה-]?(\d{1,2})(?::(\d{2}))?\b/);
  if (timeMatch) {
    const candidate = setTime(now, parseInt(timeMatch[1]), parseInt(timeMatch[2] || "0"));
    // If time already passed today, schedule for tomorrow
    if (candidate <= new Date()) return addDays(candidate, 1);
    return candidate;
  }

  // "ביום ראשון/שני/..." → next occurrence of that weekday
  for (const [name, dayIndex] of Object.entries(HEBREW_WEEKDAYS)) {
    if (text.includes(name)) {
      const currentDay = getDay(now);
      let daysUntil = (dayIndex - currentDay + 7) % 7;
      if (daysUntil === 0) daysUntil = 7; // next week
      return setTime(addDays(now, daysUntil), 9, 0);
    }
  }

  // "בסוף השבוע" → Friday at 18:00
  if (/סוף.{0,4}שבוע/.test(text)) {
    const friday = 5;
    const currentDay = getDay(now);
    let daysUntil = (friday - currentDay + 7) % 7;
    if (daysUntil === 0) daysUntil = 7;
    return setTime(addDays(now, daysUntil), 18, 0);
  }

  return null;
}

export function parseDateTime(text: string): Date | null {
  // Pass 1: Hebrew patterns
  const hebrewResult = parseHebrew(text);
  if (hebrewResult) return hebrewResult;

  // Pass 2: chrono-node (English + some Hebrew numbers)
  const chronoResult = chrono.parseDate(text, new Date(), { forwardDate: true });
  if (chronoResult) return chronoResult;

  return null;
}

export function formatDateHebrew(date: Date): string {
  const zoned = toZonedTime(date, TIMEZONE);
  const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const dayName = days[getDay(zoned)];
  const pad = (n: number) => String(n).padStart(2, "0");

  const day = zoned.getDate();
  const month = zoned.getMonth() + 1;
  const year = zoned.getFullYear();
  const hours = pad(zoned.getHours());
  const minutes = pad(zoned.getMinutes());

  return `יום ${dayName}, ${day}/${month}/${year} בשעה ${hours}:${minutes}`;
}
