export interface WebhookPayload {
  typeWebhook: string;
  instanceData: {
    idInstance: number;
    wid: string;
    typeInstance: string;
  };
  timestamp: number;
  idMessage: string;
  senderData: {
    chatId: string;
    sender: string;
    senderName: string;
  };
  messageData: {
    typeMessage: string;
    textMessageData?: { textMessage: string };
    extendedTextMessageData?: { text: string };
    audioData?: { downloadUrl: string };
    imageData?: { downloadUrl: string; caption?: string };
  };
}

export interface Reminder {
  id: string;
  chatId: string;
  message: string;
  scheduledAt: string; // ISO 8601
  createdAt: string;
  cancelled: boolean;
  fired: boolean;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type ToolName =
  | "set_reminder"
  | "list_reminders"
  | "cancel_reminder"
  | "read_emails"
  | "search_emails"
  | "send_email"
  | "list_calendar_events"
  | "create_calendar_event"
  | "find_free_time";

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface EmailSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  attendees?: string[];
  hangoutLink?: string;
}

export interface FreeSlot {
  start: string;
  end: string;
  durationMinutes: number;
}
