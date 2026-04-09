import Anthropic from "@anthropic-ai/sdk";

export const tools: Anthropic.Tool[] = [
  {
    name: "set_reminder",
    description:
      "Set a reminder that will send a WhatsApp message to the user at the specified time. Use this whenever the user asks to be reminded about something. The scheduled_at must be an ISO 8601 datetime string.",
    input_schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The reminder message to send to the user",
        },
        scheduled_at: {
          type: "string",
          description: "ISO 8601 datetime when the reminder should fire (e.g. 2025-04-10T09:00:00+03:00)",
        },
      },
      required: ["message", "scheduled_at"],
    },
  },
  {
    name: "list_reminders",
    description: "List all active (not yet fired, not cancelled) reminders for this user.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "cancel_reminder",
    description: "Cancel a specific reminder by its ID.",
    input_schema: {
      type: "object",
      properties: {
        reminder_id: {
          type: "string",
          description: "The ID of the reminder to cancel",
        },
      },
      required: ["reminder_id"],
    },
  },
  {
    name: "read_emails",
    description:
      "Read recent emails from Gmail. Returns subject, sender, date, and preview. Use query to filter (e.g. 'is:unread', 'from:boss@company.com', 'subject:invoice').",
    input_schema: {
      type: "object",
      properties: {
        max_results: {
          type: "number",
          description: "Maximum number of emails to return (default: 10, max: 20)",
        },
        query: {
          type: "string",
          description: "Gmail search query (default: 'is:unread')",
        },
      },
      required: [],
    },
  },
  {
    name: "search_emails",
    description: "Search emails in Gmail using a query string.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Gmail search query (e.g. 'from:person@email.com subject:meeting last week')",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "send_email",
    description: "Send an email via Gmail.",
    input_schema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient email address",
        },
        subject: {
          type: "string",
          description: "Email subject",
        },
        body: {
          type: "string",
          description: "Email body (plain text)",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "list_calendar_events",
    description: "List events from Google Calendar between two dates.",
    input_schema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date in ISO 8601 format (e.g. 2025-04-10T00:00:00+03:00)",
        },
        end_date: {
          type: "string",
          description: "End date in ISO 8601 format (e.g. 2025-04-10T23:59:59+03:00)",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "create_calendar_event",
    description: "Create a new event in Google Calendar.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Event title/summary",
        },
        start: {
          type: "string",
          description: "Start datetime in ISO 8601 format",
        },
        end: {
          type: "string",
          description: "End datetime in ISO 8601 format",
        },
        description: {
          type: "string",
          description: "Optional event description",
        },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of attendee email addresses",
        },
      },
      required: ["title", "start", "end"],
    },
  },
  {
    name: "find_free_time",
    description: "Find free time slots in Google Calendar on a specific day.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date to check in ISO 8601 format (e.g. 2025-04-10T00:00:00+03:00)",
        },
        duration_minutes: {
          type: "number",
          description: "Minimum duration in minutes for a free slot",
        },
      },
      required: ["date", "duration_minutes"],
    },
  },
];
