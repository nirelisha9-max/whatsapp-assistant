import Anthropic from "@anthropic-ai/sdk";
import { toZonedTime } from "date-fns-tz";
import { getHistory, addMessages } from "../services/history";
import { sendMessage } from "../services/whatsapp";
import { tools } from "./tools";
import { executeToolCall } from "./toolHandlers";
import { ConversationMessage } from "../types";
import logger from "../utils/logger";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const TIMEZONE = process.env.TIMEZONE || "Asia/Jerusalem";
const OWNER_NAME = process.env.OWNER_NAME || "המשתמש";

function getSystemPrompt(): string {
  const now = toZonedTime(new Date(), TIMEZONE);
  const dateStr = now.toLocaleString("he-IL", {
    timeZone: TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `אתה עוזר אישי חכם של ${OWNER_NAME} שפועל דרך WhatsApp.

הזמן הנוכחי: ${dateStr} (אזור זמן: ${TIMEZONE})

היכולות שלך:
- תזכורות: הגדרה, רשימה, ביטול של תזכורות שנשלחות בחזרה ב-WhatsApp
- אימייל: קריאת מיילים, חיפוש, שליחה (Gmail)
- יומן: צפייה בלוח זמנים, יצירת אירועים, מציאת זמן פנוי (Google Calendar)
- עוזר כללי: מענה לשאלות, עזרה במשימות

הנחיות:
- ענה תמיד בשפה שבה המשתמש כתב (עברית או אנגלית)
- השתמש בסגנון טבעי ומזדמן המתאים ל-WhatsApp
- תשובות קצרות וממוקדות — אין צורך בהסברים ארוכים
- כשמגדירים תזכורת, אשר את הזמן המדויק
- כשמציגים מיילים או אירועים, פרמט בצורה קריאה ונוחה
- אל תדפיס JSON — תרגם לעברית/אנגלית קריאה
- אם המשתמש אומר "תמחק שיחה" או "תאפס" — אמור לו לשלוח /clear`;
}

export async function processMessage(chatId: string, senderName: string, text: string): Promise<void> {
  // Special command: clear history
  if (text.trim() === "/clear") {
    const { clearHistory } = await import("../services/history");
    clearHistory(chatId);
    await sendMessage(chatId, "✅ היסטוריית השיחה נמחקה.");
    return;
  }

  const history = getHistory(chatId);

  // Build messages array for Claude
  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: text },
  ];

  let response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: getSystemPrompt(),
    tools,
    messages,
  });

  logger.debug("Claude initial response", { stop_reason: response.stop_reason });

  // Tool-use loop
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    // Build assistant message with all content
    messages.push({ role: "assistant", content: response.content });

    // Execute all tool calls and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      logger.info(`Calling tool: ${toolUse.name}`, { input: toolUse.input });
      const result = await executeToolCall(chatId, toolUse.name, toolUse.input as Record<string, unknown>);
      logger.debug(`Tool result: ${toolUse.name}`, { success: result.success });

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result.success ? result.data : { error: result.error }),
        is_error: !result.success,
      });
    }

    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: getSystemPrompt(),
      tools,
      messages,
    });

    logger.debug("Claude follow-up response", { stop_reason: response.stop_reason });
  }

  // Extract final text response
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  const replyText = textBlock?.text ?? "סיימתי.";

  // Send reply via WhatsApp
  await sendMessage(chatId, replyText);

  // Save to history
  const newMessages: ConversationMessage[] = [
    { role: "user", content: text, timestamp: Date.now() },
    { role: "assistant", content: replyText, timestamp: Date.now() },
  ];
  addMessages(chatId, newMessages);
}
