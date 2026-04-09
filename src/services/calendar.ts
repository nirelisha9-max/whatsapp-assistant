import { google } from "googleapis";
import { startOfDay, endOfDay, addMinutes } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { getGoogleAuth } from "./googleAuth";
import { CalendarEvent, FreeSlot } from "../types";
import logger from "../utils/logger";

const TIMEZONE = process.env.TIMEZONE || "Asia/Jerusalem";

function getCalendar() {
  return google.calendar({ version: "v3", auth: getGoogleAuth() });
}

export async function listEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const cal = getCalendar();

  const res = await cal.events.list({
    calendarId: "primary",
    timeMin: new Date(startDate).toISOString(),
    timeMax: new Date(endDate).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });

  return (res.data.items ?? []).map((e) => ({
    id: e.id ?? "",
    title: e.summary ?? "(ללא כותרת)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    location: e.location ?? undefined,
    description: e.description ?? undefined,
    attendees: e.attendees?.map((a) => a.email ?? "").filter(Boolean),
    hangoutLink: e.hangoutLink ?? undefined,
  }));
}

export async function createEvent(
  title: string,
  start: string,
  end: string,
  description?: string,
  attendees?: string[]
): Promise<CalendarEvent> {
  const cal = getCalendar();

  const res = await cal.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: title,
      start: { dateTime: new Date(start).toISOString(), timeZone: TIMEZONE },
      end: { dateTime: new Date(end).toISOString(), timeZone: TIMEZONE },
      description,
      attendees: attendees?.map((email) => ({ email })),
    },
  });

  const e = res.data;
  logger.info("Calendar event created", { title, start, end });

  return {
    id: e.id ?? "",
    title: e.summary ?? title,
    start: e.start?.dateTime ?? start,
    end: e.end?.dateTime ?? end,
    location: e.location ?? undefined,
    description: e.description ?? undefined,
    attendees: e.attendees?.map((a) => a.email ?? ""),
    hangoutLink: e.hangoutLink ?? undefined,
  };
}

export async function findFreeTime(date: string, durationMinutes: number): Promise<FreeSlot[]> {
  const cal = getCalendar();
  const TIMEZONE = process.env.TIMEZONE || "Asia/Jerusalem";

  const dayStart = fromZonedTime(startOfDay(toZonedTime(new Date(date), TIMEZONE)), TIMEZONE);
  const dayEnd = fromZonedTime(endOfDay(toZonedTime(new Date(date), TIMEZONE)), TIMEZONE);

  const res = await cal.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      timeZone: TIMEZONE,
      items: [{ id: "primary" }],
    },
  });

  const busySlots = (res.data.calendars?.["primary"]?.busy ?? []).map((s) => ({
    start: new Date(s.start!),
    end: new Date(s.end!),
  }));

  // Find gaps
  const freeSlots: FreeSlot[] = [];
  let cursor = new Date(Math.max(dayStart.getTime(), Date.now())); // start from now if today

  for (const busy of busySlots) {
    if (cursor < busy.start) {
      const gapMinutes = (busy.start.getTime() - cursor.getTime()) / 60000;
      if (gapMinutes >= durationMinutes) {
        freeSlots.push({
          start: cursor.toISOString(),
          end: busy.start.toISOString(),
          durationMinutes: Math.floor(gapMinutes),
        });
      }
    }
    if (busy.end > cursor) cursor = busy.end;
  }

  // Gap after last busy slot
  if (cursor < dayEnd) {
    const gapMinutes = (dayEnd.getTime() - cursor.getTime()) / 60000;
    if (gapMinutes >= durationMinutes) {
      freeSlots.push({
        start: cursor.toISOString(),
        end: dayEnd.toISOString(),
        durationMinutes: Math.floor(gapMinutes),
      });
    }
  }

  return freeSlots;
}
