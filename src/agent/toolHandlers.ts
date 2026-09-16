import { ToolResult } from "../types";
import { formatDateHebrew } from "../utils/dateParser";
import * as remindersService from "../services/reminders";
import * as gmailService from "../services/gmail";
import * as calendarService from "../services/calendar";
import * as faultsService from "../services/faults";
import logger from "../utils/logger";

export async function executeToolCall(
  chatId: string,
  toolName: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "set_reminder": {
        const message = input.message as string;
        const scheduledAt = input.scheduled_at as string;
        const fireDate = new Date(scheduledAt);

        if (isNaN(fireDate.getTime())) {
          return { success: false, error: "Invalid datetime format" };
        }
        if (fireDate <= new Date()) {
          return { success: false, error: "Scheduled time is in the past" };
        }

        const reminder = remindersService.setReminder(chatId, message, fireDate.toISOString());
        return {
          success: true,
          data: {
            id: reminder.id,
            message: reminder.message,
            scheduled_at: reminder.scheduledAt,
            formatted_time: formatDateHebrew(fireDate),
          },
        };
      }

      case "list_reminders": {
        const list = remindersService.listReminders(chatId);
        return {
          success: true,
          data: list.map((r) => ({
            id: r.id,
            message: r.message,
            scheduled_at: r.scheduledAt,
            formatted_time: formatDateHebrew(new Date(r.scheduledAt)),
          })),
        };
      }

      case "cancel_reminder": {
        const reminderId = input.reminder_id as string;
        const cancelled = remindersService.cancelReminder(chatId, reminderId);
        if (!cancelled) {
          return { success: false, error: "Reminder not found or already cancelled" };
        }
        return { success: true, data: { cancelled: true } };
      }

      case "read_emails": {
        const maxResults = (input.max_results as number) || 10;
        const query = (input.query as string) || "is:unread";
        const emails = await gmailService.readEmails(query, maxResults);
        return { success: true, data: emails };
      }

      case "search_emails": {
        const query = input.query as string;
        const maxResults = (input.max_results as number) || 10;
        const emails = await gmailService.searchEmails(query, maxResults);
        return { success: true, data: emails };
      }

      case "send_email": {
        const to = input.to as string;
        const subject = input.subject as string;
        const body = input.body as string;
        await gmailService.sendEmail(to, subject, body);
        return { success: true, data: { sent: true, to, subject } };
      }

      case "list_calendar_events": {
        const startDate = input.start_date as string;
        const endDate = input.end_date as string;
        const events = await calendarService.listEvents(startDate, endDate);
        return { success: true, data: events };
      }

      case "create_calendar_event": {
        const title = input.title as string;
        const start = input.start as string;
        const end = input.end as string;
        const description = input.description as string | undefined;
        const attendees = input.attendees as string[] | undefined;
        const event = await calendarService.createEvent(title, start, end, description, attendees);
        return { success: true, data: event };
      }

      case "find_free_time": {
        const date = input.date as string;
        const durationMinutes = input.duration_minutes as number;
        const slots = await calendarService.findFreeTime(date, durationMinutes);
        return { success: true, data: slots };
      }

      case "log_fault": {
        const description = input.description as string;
        const reporterName = input.reporter_name as string;
        const location = input.location as string | undefined;
        const fault = faultsService.logFault(chatId, description, reporterName, location);
        return {
          success: true,
          data: {
            id: fault.id,
            description: fault.description,
            reporter_name: fault.reporterName,
            location: fault.location,
            created_at: fault.createdAt,
          },
        };
      }

      case "list_faults": {
        const list = faultsService.listFaults(chatId);
        return {
          success: true,
          data: list.map((f) => ({
            id: f.id,
            description: f.description,
            reporter_name: f.reporterName,
            location: f.location,
            created_at: f.createdAt,
          })),
        };
      }

      default:
        logger.warn(`Unknown tool: ${toolName}`);
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Tool ${toolName} failed`, { err: message });
    return { success: false, error: message };
  }
}
